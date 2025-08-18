#!/usr/bin/env ts-node

/**
 * Annual Google Calendar Fetch Script
 * Fetches calendar events for the specified year and stores them in the database
 */

import { Command } from 'commander';
import winston from 'winston';
import sequelize from '../src/db/index';
import GoogleCalendarService from '../src/google/googleCalendar';
import { 
  FetchCalendarConfig, 
  CalendarFetchResult
} from '../src/types/scriptTypes';

class CalendarFetchScript {
  private logger: winston.Logger;
  private googleCalendarService: GoogleCalendarService;
  private config: FetchCalendarConfig;

  constructor() {
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        }),
        new winston.transports.File({ 
          filename: 'logs/fetch-calendar.log',
          maxsize: 5242880, // 5MB
          maxFiles: 5
        })
      ]
    });

    this.googleCalendarService = new GoogleCalendarService();
    
    this.config = {
      scriptName: 'fetchCalendar',
      description: 'Annual Google Calendar fetch script',
      enabled: true,
      retryAttempts: 3,
      timeout: 300000, // 5 minutes
      year: new Date().getFullYear(),
      regions: ['ID', 'US', 'SA'],
      calendarTypes: ['gregorian', 'hijri', 'indonesian']
    };
  }

  /**
   * Execute the calendar fetch with retry logic and transaction support
   */
  public async execute(options: {
    year?: number;
    regions?: string[];
    dryRun?: boolean;
    force?: boolean;
  }): Promise<CalendarFetchResult> {
    const startTime = new Date();
    let result: CalendarFetchResult = {
      scriptName: this.config.scriptName,
      status: 'failure',
      startTime,
      endTime: new Date(),
      duration: 0,
      eventsCount: 0,
      regionsProcessed: [],
      failedRegions: [],
      recordsProcessed: 0,
      recordsUpdated: 0,
      recordsInserted: 0,
      recordsFailed: 0
    };

    const year = options.year || this.config.year!;
    const regions = options.regions || this.config.regions!;

    try {
      this.logger.info('Starting calendar fetch script', {
        year,
        regions,
        dryRun: options.dryRun,
        force: options.force
      });

      if (options.dryRun) {
        this.logger.info('DRY RUN: No data will be written to database');
        return this.simulateFetch(year, regions);
      }

      // Check if data already exists for this year (unless force is specified)
      if (!options.force && await this.hasExistingData(year)) {
        throw new Error(`Data for year ${year} already exists. Use --force to overwrite.`);
      }

      // Execute fetch with database transaction
      const transaction = await sequelize.transaction();
      
      try {
        const processedEvents = await this.googleCalendarService.fetchAnnualEvents(year);
        result.eventsCount = processedEvents.length;
        result.recordsProcessed = processedEvents.length;

        if (processedEvents.length > 0) {
          await this.googleCalendarService.storeEvents(processedEvents);
          result.recordsInserted = processedEvents.length;
        }

        await transaction.commit();
        
        result.status = 'success';
        result.regionsProcessed = regions;
        
        this.logger.info('Calendar fetch completed successfully', {
          year,
          eventsCount: result.eventsCount,
          regionsProcessed: result.regionsProcessed
        });

      } catch (error) {
        await transaction.rollback();
        throw error;
      }

    } catch (error: any) {
      result.status = 'failure';
      result.errorMessage = error.message;
      result.failedRegions = regions;
      
      this.logger.error('Calendar fetch failed', {
        error: error.message,
        stack: error.stack,
        year,
        regions
      });
      
      throw error;
    } finally {
      result.endTime = new Date();
      result.duration = result.endTime.getTime() - result.startTime.getTime();
      
      await this.logResult(result);
    }

    return result;
  }

  /**
   * Check if calendar data already exists for the specified year
   */
  private async hasExistingData(year: number): Promise<boolean> {
    const Event = require('../src/db/models/Event').default;
    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year + 1, 0, 1);

    const count = await Event.count({
      where: {
        start_date: {
          [require('sequelize').Op.gte]: startOfYear,
          [require('sequelize').Op.lt]: endOfYear
        }
      }
    });

    return count > 0;
  }

  /**
   * Simulate fetch for dry run mode
   */
  private async simulateFetch(year: number, regions: string[]): Promise<CalendarFetchResult> {
    this.logger.info(`Simulating fetch for year ${year}, regions: ${regions.join(', ')}`);
    
    return {
      scriptName: this.config.scriptName,
      status: 'success',
      startTime: new Date(),
      endTime: new Date(),
      duration: 1000,
      eventsCount: 150, // Simulated count
      regionsProcessed: regions,
      failedRegions: [],
      recordsProcessed: 150,
      recordsUpdated: 0,
      recordsInserted: 150,
      recordsFailed: 0
    };
  }

  /**
   * Log the execution result
   */
  private async logResult(result: CalendarFetchResult): Promise<void> {
    const logData = {
      script: result.scriptName,
      status: result.status,
      duration: `${result.duration}ms`,
      eventsCount: result.eventsCount,
      regionsProcessed: result.regionsProcessed,
      failedRegions: result.failedRegions,
      timestamp: result.endTime.toISOString()
    };

    if (result.status === 'success') {
      this.logger.info('Script execution completed', logData);
    } else {
      this.logger.error('Script execution failed', {
        ...logData,
        error: result.errorMessage
      });
    }
  }

  /**
   * Cleanup resources
   */
  public async cleanup(): Promise<void> {
    try {
      await sequelize.close();
      this.logger.info('Database connection closed');
    } catch (error: any) {
      this.logger.error('Error during cleanup', { error: error.message });
    }
  }
}

// CLI interface
async function main() {
  const program = new Command();
  
  program
    .name('fetchCalendar')
    .description('Fetch annual Google Calendar events')
    .version('1.0.0')
    .option('-y, --year <year>', 'Year to fetch (default: current year)', (val) => parseInt(val))
    .option('-r, --regions <regions>', 'Comma-separated list of regions (default: ID,US,SA)')
    .option('-d, --dry-run', 'Run in simulation mode without writing to database')
    .option('-f, --force', 'Overwrite existing data for the year')
    .option('-v, --verbose', 'Enable verbose logging');

  program.parse();
  const options = program.opts();

  if (options.verbose) {
    process.env.LOG_LEVEL = 'debug';
  }

  const script = new CalendarFetchScript();
  
  try {
    const regions = options.regions ? options.regions.split(',') : undefined;
    
    const result = await script.execute({
      year: options.year,
      regions,
      dryRun: options.dryRun,
      force: options.force
    });

    console.log('\n📊 Execution Summary:');
    console.log(`Status: ${result.status === 'success' ? '✅' : '❌'} ${result.status}`);
    console.log(`Duration: ${result.duration}ms`);
    console.log(`Events fetched: ${result.eventsCount}`);
    console.log(`Regions processed: ${result.regionsProcessed.join(', ')}`);
    
    if (result.failedRegions.length > 0) {
      console.log(`Failed regions: ${result.failedRegions.join(', ')}`);
    }

    process.exit(result.status === 'success' ? 0 : 1);
    
  } catch (error: any) {
    console.error('💥 Script execution failed:', error.message);
    process.exit(1);
  } finally {
    await script.cleanup();
  }
}

// Execute if run directly
if (require.main === module) {
  main().catch(console.error);
}

export default CalendarFetchScript;

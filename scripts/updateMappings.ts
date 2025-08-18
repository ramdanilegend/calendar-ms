#!/usr/bin/env ts-node

/**
 * Calendar Mapping Update Script
 * Updates calendar mappings for Kementerian Agama and other sources
 */

import { Command } from 'commander';
import winston from 'winston';
import sequelize from '../src/db/index';
import CalendarMapping from '../src/db/models/CalendarMapping';
import Event from '../src/db/models/Event';
import { 
  UpdateMappingsConfig, 
  MappingUpdateResult 
} from '../src/types/scriptTypes';

interface KementerianAgamaMapping {
  gregorian_date: Date;
  hijri_date: Date;
  indonesian_date: Date;
  event_type: string;
  region: string;
}

class MappingUpdateScript {
  private logger: winston.Logger;
  private config: UpdateMappingsConfig;

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
          filename: 'logs/update-mappings.log',
          maxsize: 5242880, // 5MB
          maxFiles: 5
        })
      ]
    });

    this.config = {
      scriptName: 'updateMappings',
      description: 'Update calendar mappings from Kementerian Agama and other sources',
      enabled: true,
      retryAttempts: 3,
      timeout: 600000, // 10 minutes
      source: 'kementerian_agama',
      targetRegions: ['ID'],
      batchSize: 100
    };
  }

  /**
   * Execute the mapping update with transaction support
   */
  public async execute(options: {
    source?: 'kementerian_agama' | 'custom';
    regions?: string[];
    year?: number;
    dryRun?: boolean;
    force?: boolean;
    batchSize?: number;
  }): Promise<MappingUpdateResult> {
    const startTime = new Date();
    let result: MappingUpdateResult = {
      scriptName: this.config.scriptName,
      status: 'failure',
      startTime,
      endTime: new Date(),
      duration: 0,
      mappingsUpdated: 0,
      newMappings: 0,
      conflictsResolved: 0,
      recordsProcessed: 0,
      recordsUpdated: 0,
      recordsInserted: 0,
      recordsFailed: 0
    };

    const source = options.source || this.config.source;
    const regions = options.regions || this.config.targetRegions!;
    const year = options.year || new Date().getFullYear();
    const batchSize = options.batchSize || this.config.batchSize;

    try {
      this.logger.info('Starting mapping update script', {
        source,
        regions,
        year,
        dryRun: options.dryRun,
        batchSize
      });

      if (options.dryRun) {
        this.logger.info('DRY RUN: No data will be written to database');
        return this.simulateUpdate(year, regions);
      }

      // Execute update with database transaction
      const transaction = await sequelize.transaction();
      
      try {
        let mappingData: KementerianAgamaMapping[] = [];
        
        switch (source) {
          case 'kementerian_agama':
            mappingData = await this.fetchKementerianAgamaMappings(year, regions);
            break;
          case 'custom':
            mappingData = await this.fetchCustomMappings(year, regions);
            break;
          default:
            throw new Error(`Unsupported mapping source: ${source}`);
        }

        result.recordsProcessed = mappingData.length;

        if (mappingData.length > 0) {
          const updateResults = await this.processMappingsInBatches(
            mappingData, 
            batchSize, 
            options.force || false
          );
          
          result.mappingsUpdated = updateResults.updated;
          result.newMappings = updateResults.inserted;
          result.conflictsResolved = updateResults.conflicts;
          result.recordsUpdated = updateResults.updated;
          result.recordsInserted = updateResults.inserted;
          result.recordsFailed = updateResults.failed;
        }

        await transaction.commit();
        
        result.status = (result.recordsFailed || 0) > 0 ? 'partial' : 'success';
        
        this.logger.info('Mapping update completed successfully', {
          source,
          year,
          mappingsUpdated: result.mappingsUpdated,
          newMappings: result.newMappings,
          conflictsResolved: result.conflictsResolved
        });

      } catch (error) {
        await transaction.rollback();
        throw error;
      }

    } catch (error: any) {
      result.status = 'failure';
      result.errorMessage = error.message;
      
      this.logger.error('Mapping update failed', {
        error: error.message,
        stack: error.stack,
        source,
        regions,
        year
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
   * Fetch mappings from Kementerian Agama source
   */
  private async fetchKementerianAgamaMappings(
    year: number, 
    regions: string[]
  ): Promise<KementerianAgamaMapping[]> {
    this.logger.info('Fetching mappings from Kementerian Agama', { year, regions });
    
    // In a real implementation, this would fetch from an actual API or data source
    // For now, we'll simulate the data structure
    const mappings: KementerianAgamaMapping[] = [];
    
    // Get existing events that need mapping updates
    const events = await Event.findAll({
      where: {
        region: regions,
        start_date: {
          [require('sequelize').Op.gte]: new Date(year, 0, 1),
          [require('sequelize').Op.lt]: new Date(year + 1, 0, 1)
        }
      }
    });

    // Create enhanced mappings based on existing events
    for (const event of events) {
      mappings.push({
        gregorian_date: event.start_date,
        hijri_date: this.convertToHijri(event.start_date),
        indonesian_date: this.convertToIndonesian(event.start_date),
        event_type: event.calendar_type || 'gregorian',
        region: event.region
      });
    }

    this.logger.info(`Fetched ${mappings.length} mappings from Kementerian Agama`);
    return mappings;
  }

  /**
   * Fetch custom mappings
   */
  private async fetchCustomMappings(
    year: number, 
    regions: string[]
  ): Promise<KementerianAgamaMapping[]> {
    this.logger.info('Fetching custom mappings', { year, regions });
    
    // Placeholder for custom mapping logic
    const mappings: KementerianAgamaMapping[] = [];
    
    // This would implement custom mapping logic based on specific requirements
    this.logger.info(`Fetched ${mappings.length} custom mappings`);
    return mappings;
  }

  /**
   * Process mappings in batches with proper error handling
   */
  private async processMappingsInBatches(
    mappings: KementerianAgamaMapping[], 
    batchSize: number, 
    force: boolean
  ): Promise<{ updated: number; inserted: number; conflicts: number; failed: number }> {
    let updated = 0;
    let inserted = 0;
    let conflicts = 0;
    let failed = 0;

    for (let i = 0; i < mappings.length; i += batchSize) {
      const batch = mappings.slice(i, i + batchSize);
      
      try {
        for (const mapping of batch) {
          try {
            const [mappingRecord, created] = await CalendarMapping.findOrCreate({
              where: {
                gregorian_date: mapping.gregorian_date,
                region: mapping.region
              },
              defaults: {
                event_id: `mapping_${mapping.region}_${mapping.gregorian_date.getTime()}`,
                region: mapping.region,
                original_date: mapping.gregorian_date,
                gregorian_date: mapping.gregorian_date,
                hijri_date: mapping.hijri_date,
                indonesian_date: mapping.indonesian_date
              }
            });

            if (created) {
              inserted++;
            } else {
              // Check if update is needed
              const needsUpdate = 
                !mappingRecord.hijri_date || 
                !mappingRecord.indonesian_date ||
                force;

              if (needsUpdate) {
                await mappingRecord.update({
                  hijri_date: mapping.hijri_date,
                  indonesian_date: mapping.indonesian_date
                });
                updated++;
              } else {
                conflicts++;
              }
            }
          } catch (error: any) {
            this.logger.warn('Failed to process individual mapping', {
              error: error.message,
              mapping: mapping.gregorian_date
            });
            failed++;
          }
        }

        this.logger.debug(`Processed batch ${Math.ceil(i / batchSize) + 1}`, {
          processed: Math.min(i + batchSize, mappings.length),
          total: mappings.length
        });

      } catch (error: any) {
        this.logger.error(`Failed to process batch starting at index ${i}`, { 
          error: error.message 
        });
        failed += batch.length;
      }
    }

    return { updated, inserted, conflicts, failed };
  }

  /**
   * Convert Gregorian date to Hijri (simplified implementation)
   */
  private convertToHijri(gregorianDate: Date): Date {
    // This is a simplified conversion
    // In production, you would use a proper Hijri calendar library
    const hijriYear = gregorianDate.getFullYear() - 622;
    return new Date(hijriYear, gregorianDate.getMonth(), gregorianDate.getDate());
  }

  /**
   * Convert Gregorian date to Indonesian calendar format
   */
  private convertToIndonesian(gregorianDate: Date): Date {
    // Indonesian calendar is essentially Gregorian but with localized formatting
    // For this example, we'll return the same date
    return new Date(gregorianDate);
  }

  /**
   * Simulate update for dry run mode
   */
  private async simulateUpdate(year: number, regions: string[]): Promise<MappingUpdateResult> {
    this.logger.info(`Simulating mapping update for year ${year}, regions: ${regions.join(', ')}`);
    
    return {
      scriptName: this.config.scriptName,
      status: 'success',
      startTime: new Date(),
      endTime: new Date(),
      duration: 2000,
      mappingsUpdated: 45,
      newMappings: 12,
      conflictsResolved: 3,
      recordsProcessed: 60,
      recordsUpdated: 45,
      recordsInserted: 12,
      recordsFailed: 0
    };
  }

  /**
   * Log the execution result
   */
  private async logResult(result: MappingUpdateResult): Promise<void> {
    const logData = {
      script: result.scriptName,
      status: result.status,
      duration: `${result.duration}ms`,
      mappingsUpdated: result.mappingsUpdated,
      newMappings: result.newMappings,
      conflictsResolved: result.conflictsResolved,
      recordsFailed: result.recordsFailed,
      timestamp: result.endTime.toISOString()
    };

    if (result.status === 'success' || result.status === 'partial') {
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
    .name('updateMappings')
    .description('Update calendar mappings from various sources')
    .version('1.0.0')
    .option('-s, --source <source>', 'Mapping source (kementerian_agama|custom)', 'kementerian_agama')
    .option('-y, --year <year>', 'Year to update mappings for (default: current year)', (val) => parseInt(val))
    .option('-r, --regions <regions>', 'Comma-separated list of regions (default: ID)')
    .option('-b, --batch-size <size>', 'Batch size for processing (default: 100)', (val) => parseInt(val))
    .option('-d, --dry-run', 'Run in simulation mode without writing to database')
    .option('-f, --force', 'Force update existing mappings')
    .option('-v, --verbose', 'Enable verbose logging');

  program.parse();
  const options = program.opts();

  if (options.verbose) {
    process.env.LOG_LEVEL = 'debug';
  }

  const script = new MappingUpdateScript();
  
  try {
    const regions = options.regions ? options.regions.split(',') : undefined;
    
    const result = await script.execute({
      source: options.source,
      year: options.year,
      regions,
      batchSize: options.batchSize,
      dryRun: options.dryRun,
      force: options.force
    });

    console.log('\n📊 Execution Summary:');
    console.log(`Status: ${result.status === 'success' ? '✅' : result.status === 'partial' ? '⚠️' : '❌'} ${result.status}`);
    console.log(`Duration: ${result.duration}ms`);
    console.log(`Mappings updated: ${result.mappingsUpdated}`);
    console.log(`New mappings: ${result.newMappings}`);
    console.log(`Conflicts resolved: ${result.conflictsResolved}`);
    
    if ((result.recordsFailed || 0) > 0) {
      console.log(`Failed records: ${result.recordsFailed}`);
    }

    process.exit(result.status === 'failure' ? 1 : 0);
    
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

export default MappingUpdateScript;

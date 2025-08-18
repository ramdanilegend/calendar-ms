/**
 * Scheduled Task Manager Service
 * Manages cron jobs for calendar fetch and mapping updates
 */

import * as cron from 'node-cron';
import winston from 'winston';
// Import scripts dynamically to avoid TypeScript path issues
// CalendarFetchScript and MappingUpdateScript will be imported at runtime
import { 
  ScheduledJobConfig, 
  ScriptResult,
  NotificationChannel 
} from '../types/scriptTypes';

interface ScheduledJob {
  name: string;
  task: cron.ScheduledTask | null;
  config: any;
  lastRun?: Date;
  lastResult?: ScriptResult;
  isRunning: boolean;
}

export class SchedulerService {
  private logger: winston.Logger;
  private jobs: Map<string, ScheduledJob> = new Map();
  private config: ScheduledJobConfig;
  private isInitialized = false;

  constructor(config?: Partial<ScheduledJobConfig>) {
    this.logger = winston.createLogger({
      level: config?.globalSettings?.logLevel || 'info',
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
          filename: 'logs/scheduler.log',
          maxsize: 5242880, // 5MB
          maxFiles: 5
        })
      ]
    });

    // Default configuration
    this.config = {
      jobs: {
        fetchCalendar: {
          scriptName: 'fetchCalendar',
          description: 'Annual Google Calendar fetch',
          schedule: '0 2 1 1 *', // Run at 2 AM on January 1st every year
          enabled: true,
          retryAttempts: 3,
          timeout: 900000, // 15 minutes
          year: new Date().getFullYear(),
          regions: ['ID', 'US', 'SA'],
          calendarTypes: ['gregorian', 'hijri', 'indonesian']
        },
        updateMappings: {
          scriptName: 'updateMappings',
          description: 'Update calendar mappings from Kementerian Agama',
          schedule: '0 3 1 * *', // Run at 3 AM on the 1st day of every month
          enabled: true,
          retryAttempts: 3,
          timeout: 600000, // 10 minutes
          source: 'kementerian_agama',
          targetRegions: ['ID'],
          batchSize: 100
        }
      },
      globalSettings: {
        timezone: 'Asia/Jakarta',
        logLevel: 'info',
        maxConcurrentJobs: 2
      },
      ...config
    };
  }

  /**
   * Initialize the scheduler and start all enabled jobs
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      this.logger.warn('Scheduler already initialized');
      return;
    }

    try {
      this.logger.info('Initializing scheduler service', {
        timezone: this.config.globalSettings.timezone,
        jobCount: Object.keys(this.config.jobs).length
      });

      // Initialize calendar fetch job
      if (this.config.jobs.fetchCalendar.enabled) {
        await this.scheduleCalendarFetch();
      }

      // Initialize mapping update job
      if (this.config.jobs.updateMappings.enabled) {
        await this.scheduleMappingUpdate();
      }

      this.isInitialized = true;
      this.logger.info('Scheduler service initialized successfully', {
        activeJobs: Array.from(this.jobs.keys())
      });

    } catch (error: any) {
      this.logger.error('Failed to initialize scheduler service', { 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Schedule the calendar fetch job
   */
  private async scheduleCalendarFetch(): Promise<void> {
    const jobConfig = this.config.jobs.fetchCalendar;
    const jobName = 'fetchCalendar';

    try {
      const task = cron.schedule(
        jobConfig.schedule!,
        async () => {
          await this.executeCalendarFetch();
        },
        {
          timezone: this.config.globalSettings.timezone
        }
      );

      this.jobs.set(jobName, {
        name: jobName,
        task,
        config: jobConfig,
        isRunning: false
      });

      task.start();
      
      this.logger.info('Calendar fetch job scheduled', {
        schedule: jobConfig.schedule,
        timezone: this.config.globalSettings.timezone
      });

    } catch (error: any) {
      this.logger.error('Failed to schedule calendar fetch job', { 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Schedule the mapping update job
   */
  private async scheduleMappingUpdate(): Promise<void> {
    const jobConfig = this.config.jobs.updateMappings;
    const jobName = 'updateMappings';

    try {
      const task = cron.schedule(
        jobConfig.schedule!,
        async () => {
          await this.executeMappingUpdate();
        },
        {
          timezone: this.config.globalSettings.timezone
        }
      );

      this.jobs.set(jobName, {
        name: jobName,
        task,
        config: jobConfig,
        isRunning: false
      });

      task.start();

      this.logger.info('Mapping update job scheduled', {
        schedule: jobConfig.schedule,
        timezone: this.config.globalSettings.timezone
      });

    } catch (error: any) {
      this.logger.error('Failed to schedule mapping update job', { 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Execute calendar fetch job with error handling and retry logic
   */
  private async executeCalendarFetch(): Promise<void> {
    const jobName = 'fetchCalendar';
    const job = this.jobs.get(jobName);
    
    if (!job || job.isRunning) {
      this.logger.warn(`Job ${jobName} is already running or not found`);
      return;
    }

    job.isRunning = true;
    job.lastRun = new Date();

    let attempt = 0;
    const maxAttempts = job.config.retryAttempts;

    while (attempt < maxAttempts) {
      try {
        this.logger.info(`Executing calendar fetch job (attempt ${attempt + 1}/${maxAttempts})`);

        // Dynamic import to avoid TypeScript path issues
        const { default: CalendarFetchScript } = await import('../../scripts/fetchCalendar');
        const script = new CalendarFetchScript();
        const result = await Promise.race([
          script.execute({
            year: job.config.year || new Date().getFullYear(),
            regions: job.config.regions
          }),
          this.createTimeoutPromise(job.config.timeout)
        ]);

        job.lastResult = result;
        
        if (result.status === 'success') {
          this.logger.info('Calendar fetch job completed successfully', {
            eventsCount: result.eventsCount,
            duration: result.duration
          });
          break;
        } else {
          throw new Error(result.errorMessage || 'Calendar fetch failed');
        }

      } catch (error: any) {
        attempt++;
        this.logger.error(`Calendar fetch job failed (attempt ${attempt}/${maxAttempts})`, {
          error: error.message
        });

        if (attempt < maxAttempts) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          job.lastResult = {
            scriptName: jobName,
            status: 'failure',
            startTime: job.lastRun,
            endTime: new Date(),
            duration: Date.now() - job.lastRun.getTime(),
            errorMessage: error.message
          };
          
          await this.handleJobFailure(jobName, error);
        }
      }
    }

    job.isRunning = false;
  }

  /**
   * Execute mapping update job with error handling and retry logic
   */
  private async executeMappingUpdate(): Promise<void> {
    const jobName = 'updateMappings';
    const job = this.jobs.get(jobName);
    
    if (!job || job.isRunning) {
      this.logger.warn(`Job ${jobName} is already running or not found`);
      return;
    }

    job.isRunning = true;
    job.lastRun = new Date();

    let attempt = 0;
    const maxAttempts = job.config.retryAttempts;

    while (attempt < maxAttempts) {
      try {
        this.logger.info(`Executing mapping update job (attempt ${attempt + 1}/${maxAttempts})`);

        // Dynamic import to avoid TypeScript path issues
        const { default: MappingUpdateScript } = await import('../../scripts/updateMappings');
        const script = new MappingUpdateScript();
        const result = await Promise.race([
          script.execute({
            source: job.config.source,
            regions: job.config.targetRegions,
            batchSize: job.config.batchSize
          }),
          this.createTimeoutPromise(job.config.timeout)
        ]);

        job.lastResult = result;
        
        if (result.status === 'success' || result.status === 'partial') {
          this.logger.info('Mapping update job completed', {
            status: result.status,
            mappingsUpdated: result.mappingsUpdated,
            duration: result.duration
          });
          break;
        } else {
          throw new Error(result.errorMessage || 'Mapping update failed');
        }

      } catch (error: any) {
        attempt++;
        this.logger.error(`Mapping update job failed (attempt ${attempt}/${maxAttempts})`, {
          error: error.message
        });

        if (attempt < maxAttempts) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          job.lastResult = {
            scriptName: jobName,
            status: 'failure',
            startTime: job.lastRun,
            endTime: new Date(),
            duration: Date.now() - job.lastRun.getTime(),
            errorMessage: error.message
          };
          
          await this.handleJobFailure(jobName, error);
        }
      }
    }

    job.isRunning = false;
  }

  /**
   * Create a timeout promise for job execution
   */
  private createTimeoutPromise(timeoutMs: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Job execution timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });
  }

  /**
   * Handle job failure and send notifications
   */
  private async handleJobFailure(jobName: string, error: Error): Promise<void> {
    const job = this.jobs.get(jobName);
    if (!job) return;

    this.logger.error(`Job ${jobName} failed after all retry attempts`, {
      error: error.message,
      maxAttempts: job.config.retryAttempts,
      lastRun: job.lastRun
    });

    // Send notifications if configured
    if (job.config.notificationChannels) {
      for (const channel of job.config.notificationChannels) {
        await this.sendNotification(channel, jobName, error);
      }
    }
  }

  /**
   * Send notification through configured channels
   */
  private async sendNotification(
    channel: NotificationChannel, 
    jobName: string, 
    error: Error
  ): Promise<void> {
    try {
      switch (channel.type) {
        case 'log':
          this.logger.error(`Job notification: ${jobName} failed`, {
            error: error.message,
            channel: channel.type
          });
          break;
        case 'email':
          // Implement email notification
          this.logger.info(`Email notification sent for failed job ${jobName}`);
          break;
        case 'webhook':
          // Implement webhook notification
          this.logger.info(`Webhook notification sent for failed job ${jobName}`);
          break;
      }
    } catch (notificationError: any) {
      this.logger.error('Failed to send notification', {
        error: notificationError.message,
        jobName,
        channelType: channel.type
      });
    }
  }

  /**
   * Manually trigger a job
   */
  public async triggerJob(jobName: string, options?: any): Promise<ScriptResult> {
    const job = this.jobs.get(jobName);
    if (!job) {
      throw new Error(`Job ${jobName} not found`);
    }

    if (job.isRunning) {
      throw new Error(`Job ${jobName} is already running`);
    }

    this.logger.info(`Manually triggering job ${jobName}`, options);

    switch (jobName) {
      case 'fetchCalendar':
        await this.executeCalendarFetch();
        break;
      case 'updateMappings':
        await this.executeMappingUpdate();
        break;
      default:
        throw new Error(`Unknown job: ${jobName}`);
    }

    return job.lastResult!;
  }

  /**
   * Get job status and information
   */
  public getJobStatus(jobName?: string): any {
    if (jobName) {
      const job = this.jobs.get(jobName);
      if (!job) return null;

      return {
        name: job.name,
        isRunning: job.isRunning,
        lastRun: job.lastRun,
        lastResult: job.lastResult,
        config: job.config
      };
    }

    // Return all jobs status
    const status: any = {};
    for (const [name, job] of this.jobs) {
      status[name] = {
        name: job.name,
        isRunning: job.isRunning,
        lastRun: job.lastRun,
        lastResult: job.lastResult ? {
          status: job.lastResult.status,
          duration: job.lastResult.duration,
          endTime: job.lastResult.endTime
        } : null
      };
    }

    return status;
  }

  /**
   * Stop a specific job
   */
  public stopJob(jobName: string): boolean {
    const job = this.jobs.get(jobName);
    if (!job || !job.task) {
      return false;
    }

    job.task.stop();
    this.logger.info(`Job ${jobName} stopped`);
    return true;
  }

  /**
   * Start a specific job
   */
  public startJob(jobName: string): boolean {
    const job = this.jobs.get(jobName);
    if (!job || !job.task) {
      return false;
    }

    job.task.start();
    this.logger.info(`Job ${jobName} started`);
    return true;
  }

  /**
   * Shutdown the scheduler and stop all jobs
   */
  public async shutdown(): Promise<void> {
    this.logger.info('Shutting down scheduler service');

    for (const [jobName, job] of this.jobs) {
      if (job.task) {
        job.task.stop();
        this.logger.info(`Stopped job: ${jobName}`);
      }
    }

    this.jobs.clear();
    this.isInitialized = false;
    this.logger.info('Scheduler service shutdown completed');
  }
}

export default SchedulerService;

import * as cron from 'node-cron';
import winston from 'winston';
import GoogleCalendarService from './googleCalendar';

export class CalendarScheduler {
  private logger: winston.Logger;
  private googleCalendarService: GoogleCalendarService;
  private scheduledTasks: Map<string, cron.ScheduledTask> = new Map();

  constructor() {
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'scheduler.log' })
      ]
    });

    this.googleCalendarService = new GoogleCalendarService();
  }

  /**
   * Schedule annual calendar data fetch
   * Default: runs on January 1st at 2:00 AM
   */
  public scheduleAnnualSync(cronExpression: string = '0 2 1 1 *'): void {
    const taskName = 'annual-calendar-sync';

    // Stop existing task if it exists
    this.stopScheduledTask(taskName);

    const task = cron.schedule(cronExpression, async () => {
      const currentYear = new Date().getFullYear();
      
      try {
        this.logger.info(`Starting scheduled annual calendar sync for year ${currentYear}`);
        await this.googleCalendarService.syncAnnualData(currentYear);
        
        // Also sync next year's data to prepare in advance
        await this.googleCalendarService.syncAnnualData(currentYear + 1);
        
        this.logger.info(`Completed scheduled annual calendar sync for years ${currentYear} and ${currentYear + 1}`);
      } catch (error) {
        this.logger.error('Scheduled annual calendar sync failed', { 
          error, 
          year: currentYear 
        });
      }
    }, {
      timezone: 'UTC'
    });

    this.scheduledTasks.set(taskName, task);
    task.start();

    this.logger.info(`Scheduled annual calendar sync with cron expression: ${cronExpression}`);
  }

  /**
   * Schedule monthly incremental sync
   * Default: runs on the 1st of each month at 3:00 AM
   */
  public scheduleMonthlySync(cronExpression: string = '0 3 1 * *'): void {
    const taskName = 'monthly-calendar-sync';

    // Stop existing task if it exists
    this.stopScheduledTask(taskName);

    const task = cron.schedule(cronExpression, async () => {
      const currentYear = new Date().getFullYear();
      
      try {
        this.logger.info(`Starting scheduled monthly calendar sync for year ${currentYear}`);
        await this.googleCalendarService.syncAnnualData(currentYear);
        this.logger.info(`Completed scheduled monthly calendar sync for year ${currentYear}`);
      } catch (error) {
        this.logger.error('Scheduled monthly calendar sync failed', { 
          error, 
          year: currentYear 
        });
      }
    }, {
      timezone: 'UTC'
    });

    this.scheduledTasks.set(taskName, task);
    task.start();

    this.logger.info(`Scheduled monthly calendar sync with cron expression: ${cronExpression}`);
  }

  /**
   * Schedule weekly sync for current year
   * Default: runs every Sunday at 4:00 AM
   */
  public scheduleWeeklySync(cronExpression: string = '0 4 * * 0'): void {
    const taskName = 'weekly-calendar-sync';

    // Stop existing task if it exists
    this.stopScheduledTask(taskName);

    const task = cron.schedule(cronExpression, async () => {
      const currentYear = new Date().getFullYear();
      
      try {
        this.logger.info(`Starting scheduled weekly calendar sync for year ${currentYear}`);
        await this.googleCalendarService.syncAnnualData(currentYear);
        this.logger.info(`Completed scheduled weekly calendar sync for year ${currentYear}`);
      } catch (error) {
        this.logger.error('Scheduled weekly calendar sync failed', { 
          error, 
          year: currentYear 
        });
      }
    }, {
      timezone: 'UTC'
    });

    this.scheduledTasks.set(taskName, task);
    task.start();

    this.logger.info(`Scheduled weekly calendar sync with cron expression: ${cronExpression}`);
  }

  /**
   * Start all default scheduled tasks
   */
  public startAllScheduledTasks(): void {
    this.logger.info('Starting all scheduled calendar sync tasks');
    
    // Schedule annual sync (January 1st at 2 AM)
    this.scheduleAnnualSync();
    
    // Schedule monthly sync (1st of each month at 3 AM)
    this.scheduleMonthlySync();
    
    // For production, you might want to disable weekly sync to reduce API calls
    if (process.env.NODE_ENV !== 'production') {
      this.scheduleWeeklySync();
    }

    this.logger.info('All scheduled calendar sync tasks have been started');
  }

  /**
   * Stop a specific scheduled task
   */
  public stopScheduledTask(taskName: string): void {
    const task = this.scheduledTasks.get(taskName);
    if (task) {
      task.stop();
      this.scheduledTasks.delete(taskName);
      this.logger.info(`Stopped scheduled task: ${taskName}`);
    }
  }

  /**
   * Stop all scheduled tasks
   */
  public stopAllScheduledTasks(): void {
    this.logger.info('Stopping all scheduled calendar sync tasks');
    
    this.scheduledTasks.forEach((task, taskName) => {
      task.stop();
      this.logger.info(`Stopped scheduled task: ${taskName}`);
    });
    
    this.scheduledTasks.clear();
    this.logger.info('All scheduled calendar sync tasks have been stopped');
  }

  /**
   * Get status of all scheduled tasks
   */
  public getScheduledTasksStatus(): { [taskName: string]: boolean } {
    const status: { [taskName: string]: boolean } = {};
    
    this.scheduledTasks.forEach((task, taskName) => {
      status[taskName] = task.getStatus() === 'scheduled';
    });
    
    return status;
  }

  /**
   * Manually trigger calendar sync for a specific year
   */
  public async manualSync(year?: number): Promise<void> {
    const targetYear = year || new Date().getFullYear();
    
    try {
      this.logger.info(`Starting manual calendar sync for year ${targetYear}`);
      await this.googleCalendarService.syncAnnualData(targetYear);
      this.logger.info(`Completed manual calendar sync for year ${targetYear}`);
    } catch (error) {
      this.logger.error('Manual calendar sync failed', { 
        error, 
        year: targetYear 
      });
      throw error;
    }
  }

  /**
   * Get the next scheduled run times for all tasks
   */
  public getNextRunTimes(): { [taskName: string]: Date | null } {
    const nextRuns: { [taskName: string]: Date | null } = {};
    
    this.scheduledTasks.forEach((_task, taskName) => {
      try {
        // Note: node-cron doesn't expose next execution time directly
        // This is a simplified approach
        nextRuns[taskName] = null; // Could be enhanced with a proper cron parser
      } catch (error) {
        nextRuns[taskName] = null;
      }
    });
    
    return nextRuns;
  }
}

export default CalendarScheduler;

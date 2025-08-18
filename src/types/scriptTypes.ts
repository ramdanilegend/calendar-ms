/**
 * TypeScript interfaces for scheduled tasks and script configurations
 */

export interface ScriptConfig {
  scriptName: string;
  description: string;
  schedule?: string; // Cron expression
  enabled: boolean;
  retryAttempts: number;
  timeout: number; // in milliseconds
  notificationChannels?: NotificationChannel[];
}

export interface ScriptResult {
  scriptName: string;
  status: 'success' | 'failure' | 'partial';
  startTime: Date;
  endTime: Date;
  duration: number; // in milliseconds
  recordsProcessed?: number;
  recordsUpdated?: number;
  recordsInserted?: number;
  recordsFailed?: number;
  errorMessage?: string;
  details?: any;
}

export interface NotificationChannel {
  type: 'email' | 'webhook' | 'log';
  config: {
    recipient?: string;
    url?: string;
    level?: 'error' | 'warning' | 'info';
  };
}

export interface FetchCalendarConfig extends ScriptConfig {
  year?: number;
  regions?: string[];
  calendarTypes?: ('gregorian' | 'hijri' | 'indonesian')[];
}

export interface UpdateMappingsConfig extends ScriptConfig {
  source: 'kementerian_agama' | 'custom';
  targetRegions?: string[];
  batchSize: number;
}

export interface CalendarFetchResult extends ScriptResult {
  eventsCount: number;
  regionsProcessed: string[];
  failedRegions: string[];
}

export interface MappingUpdateResult extends ScriptResult {
  mappingsUpdated: number;
  newMappings: number;
  conflictsResolved: number;
}

export interface ScheduledJobConfig {
  jobs: {
    fetchCalendar: FetchCalendarConfig;
    updateMappings: UpdateMappingsConfig;
  };
  globalSettings: {
    timezone: string;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
    maxConcurrentJobs: number;
  };
}

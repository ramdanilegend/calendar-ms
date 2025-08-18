import { google } from 'googleapis';
import { JWT } from 'google-auth-library';
import winston from 'winston';
import config from '../config/config';
import {
  GoogleCalendarEvent,
  GoogleCalendarListResponse,
  CalendarRegion,
  FetchEventsOptions,
  ProcessedEvent,
  RateLimitConfig
} from './types';
import Event from '../db/models/Event';
import CalendarMapping from '../db/models/CalendarMapping';

export class GoogleCalendarService {
  private auth: JWT | null = null;
  private calendar: any = null;
  private logger: winston.Logger;
  private rateLimitConfig: RateLimitConfig;

  // Predefined calendar regions and their configurations
  private calendarRegions: CalendarRegion[] = [
    {
      region: 'ID',
      calendarId: 'id.indonesian#holiday@group.v.calendar.google.com',
      timeZone: 'Asia/Jakarta'
    },
    {
      region: 'US',
      calendarId: 'en.usa#holiday@group.v.calendar.google.com',
      timeZone: 'America/New_York'
    },
    {
      region: 'SA',
      calendarId: 'ar.sa#holiday@group.v.calendar.google.com',
      timeZone: 'Asia/Riyadh'
    }
  ];

  constructor() {
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'google-calendar.log' })
      ]
    });

    this.rateLimitConfig = {
      maxRetries: 3,
      initialDelay: 1000,
      maxDelay: 10000,
      backoffMultiplier: 2
    };

    this.initializeAuth();
  }

  /**
   * Initialize Google API authentication
   * Uses service account credentials if available, otherwise falls back to API key
   */
  private async initializeAuth(): Promise<void> {
    try {
      // Check if service account credentials are available
      const serviceAccountPath = process.env.GOOGLE_SERVICE_ACCOUNT_PATH;
      const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

      if (serviceAccountPath || serviceAccountKey) {
        // Use service account authentication
        let credentials;
        if (serviceAccountPath) {
          credentials = require(serviceAccountPath);
        } else if (serviceAccountKey) {
          credentials = JSON.parse(serviceAccountKey);
        }

        this.auth = new JWT({
          email: credentials.client_email,
          key: credentials.private_key,
          scopes: ['https://www.googleapis.com/auth/calendar.readonly']
        });

        await this.auth.authorize();
        this.logger.info('Google Calendar service account authentication successful');
      } else if (config.googleCalendar.apiKey) {
        // Use API key authentication for public calendars
        this.logger.info('Using API key authentication for public calendars');
      } else {
        throw new Error('No Google Calendar authentication method configured');
      }

      // Initialize Calendar API client
      this.calendar = google.calendar({
        version: 'v3',
        auth: this.auth || config.googleCalendar.apiKey
      });

    } catch (error) {
      this.logger.error('Failed to initialize Google Calendar authentication', { error });
      throw error;
    }
  }

  /**
   * Retry wrapper with exponential backoff for rate limiting
   */
  private async retryWithBackoff<T>(
    operation: () => Promise<T>,
    retries: number = this.rateLimitConfig.maxRetries
  ): Promise<T> {
    try {
      return await operation();
    } catch (error: any) {
      if (retries > 0 && this.isRetryableError(error)) {
        const delay = Math.min(
          this.rateLimitConfig.initialDelay * 
          Math.pow(this.rateLimitConfig.backoffMultiplier, this.rateLimitConfig.maxRetries - retries),
          this.rateLimitConfig.maxDelay
        );

        this.logger.warn(`Rate limit hit, retrying in ${delay}ms. Retries left: ${retries}`, {
          error: error.message
        });

        await new Promise(resolve => setTimeout(resolve, delay));
        return this.retryWithBackoff(operation, retries - 1);
      }
      throw error;
    }
  }

  /**
   * Check if error is retryable (rate limiting or temporary issues)
   */
  private isRetryableError(error: any): boolean {
    return error.code === 429 || // Rate limit
           error.code === 500 || // Internal server error
           error.code === 502 || // Bad gateway
           error.code === 503;   // Service unavailable
  }

  /**
   * Fetch events from a specific Google Calendar
   */
  private async fetchCalendarEvents(options: FetchEventsOptions): Promise<GoogleCalendarEvent[]> {
    const operation = async () => {
      const response = await this.calendar.events.list({
        calendarId: options.calendarId,
        timeMin: options.timeMin,
        timeMax: options.timeMax,
        maxResults: options.maxResults || 250,
        singleEvents: true,
        orderBy: 'startTime',
        pageToken: options.pageToken
      });

      return response.data as GoogleCalendarListResponse;
    };

    try {
      const result = await this.retryWithBackoff(operation);
      let allEvents: GoogleCalendarEvent[] = result.items || [];

      // Handle pagination if there are more events
      if (result.nextPageToken) {
        const nextPageEvents = await this.fetchCalendarEvents({
          ...options,
          pageToken: result.nextPageToken
        });
        allEvents = allEvents.concat(nextPageEvents);
      }

      return allEvents;
    } catch (error) {
      this.logger.error(`Failed to fetch events from calendar ${options.calendarId}`, { error });
      throw error;
    }
  }

  /**
   * Process Google Calendar event into our standard format
   */
  private processGoogleEvent(
    event: GoogleCalendarEvent, 
    region: string, 
    calendarType: 'gregorian' | 'hijri' | 'indonesian'
  ): ProcessedEvent {
    // Determine if it's an all-day event
    const isAllDay = !!event.start.date;
    
    // Parse start and end dates
    const startDate = new Date(event.start.dateTime || event.start.date!);
    const endDate = new Date(event.end.dateTime || event.end.date!);

    // Handle recurrence rules
    let recurrenceRule = null;
    if (event.recurrence && event.recurrence.length > 0) {
      recurrenceRule = event.recurrence.join(';');
    }

    return {
      event_id: event.id,
      region,
      calendar_type: calendarType,
      start_date: startDate,
      end_date: endDate,
      is_all_day: isAllDay,
      recurrence_rule: recurrenceRule,
      status: event.status,
      title: event.summary,
      description: event.description
    };
  }

  /**
   * Fetch events for all configured regions and calendar types
   */
  public async fetchAnnualEvents(year: number): Promise<ProcessedEvent[]> {
    const startOfYear = new Date(year, 0, 1).toISOString();
    const endOfYear = new Date(year + 1, 0, 1).toISOString();

    this.logger.info(`Fetching annual events for year ${year}`, {
      timeMin: startOfYear,
      timeMax: endOfYear
    });

    const allProcessedEvents: ProcessedEvent[] = [];

    // Fetch events from each configured region
    for (const regionConfig of this.calendarRegions) {
      try {
        this.logger.info(`Fetching events for region: ${regionConfig.region}`);

        const events = await this.fetchCalendarEvents({
          calendarId: regionConfig.calendarId,
          timeMin: startOfYear,
          timeMax: endOfYear
        });

        // Process events and determine calendar type based on region
        const calendarType = this.getCalendarTypeForRegion(regionConfig.region);
        const processedEvents = events.map(event => 
          this.processGoogleEvent(event, regionConfig.region, calendarType)
        );

        allProcessedEvents.push(...processedEvents);

        this.logger.info(`Fetched ${events.length} events for region ${regionConfig.region}`);
      } catch (error) {
        this.logger.error(`Failed to fetch events for region ${regionConfig.region}`, { error });
        // Continue with other regions even if one fails
      }
    }

    this.logger.info(`Total events fetched: ${allProcessedEvents.length}`);
    return allProcessedEvents;
  }

  /**
   * Determine calendar type based on region
   */
  private getCalendarTypeForRegion(region: string): 'gregorian' | 'hijri' | 'indonesian' {
    switch (region) {
      case 'SA':
        return 'hijri';
      case 'ID':
        return 'indonesian';
      default:
        return 'gregorian';
    }
  }

  /**
   * Store fetched events in the database
   */
  public async storeEvents(processedEvents: ProcessedEvent[]): Promise<void> {
    this.logger.info(`Storing ${processedEvents.length} events in database`);

    const batchSize = 100;
    let stored = 0;

    for (let i = 0; i < processedEvents.length; i += batchSize) {
      const batch = processedEvents.slice(i, i + batchSize);
      
      try {
        // Use upsert to handle duplicates
        for (const eventData of batch) {
          await Event.upsert({
            event_id: eventData.event_id,
            region: eventData.region,
            calendar_type: eventData.calendar_type,
            start_date: eventData.start_date,
            end_date: eventData.end_date,
            is_all_day: eventData.is_all_day,
            recurrence_rule: eventData.recurrence_rule,
            status: eventData.status
          });

          // Create calendar mapping entry
          await CalendarMapping.upsert({
            event_id: eventData.event_id,
            region: eventData.region,
            original_date: eventData.start_date,
            gregorian_date: eventData.start_date,
            hijri_date: eventData.calendar_type === 'hijri' ? eventData.start_date : null,
            indonesian_date: eventData.calendar_type === 'indonesian' ? eventData.start_date : null
          });
        }

        stored += batch.length;
        this.logger.info(`Stored batch ${Math.ceil(i / batchSize) + 1}, total stored: ${stored}`);
      } catch (error) {
        this.logger.error(`Failed to store batch starting at index ${i}`, { error });
      }
    }

    this.logger.info(`Successfully stored ${stored} events`);
  }

  /**
   * Main method to fetch and store annual calendar data
   */
  public async syncAnnualData(year: number = new Date().getFullYear()): Promise<void> {
    try {
      this.logger.info(`Starting annual calendar data sync for year ${year}`);

      const processedEvents = await this.fetchAnnualEvents(year);
      await this.storeEvents(processedEvents);

      this.logger.info(`Annual calendar data sync completed for year ${year}`);
    } catch (error) {
      this.logger.error(`Annual calendar data sync failed for year ${year}`, { error });
      throw error;
    }
  }
}

export default GoogleCalendarService;

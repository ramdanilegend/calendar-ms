// Google Calendar API response types and interfaces

export interface GoogleCalendarEvent {
  id: string;
  summary?: string;
  description?: string;
  start: {
    date?: string;        // For all-day events
    dateTime?: string;    // For timed events
    timeZone?: string;
  };
  end: {
    date?: string;
    dateTime?: string;
    timeZone?: string;
  };
  status: 'confirmed' | 'tentative' | 'cancelled';
  recurrence?: string[];
  created: string;
  updated: string;
}

export interface GoogleCalendarListResponse {
  kind: string;
  etag: string;
  nextPageToken?: string;
  items: GoogleCalendarEvent[];
}

export interface CalendarRegion {
  region: string;
  calendarId: string;
  timeZone: string;
}

export interface FetchEventsOptions {
  calendarId: string;
  timeMin: string;
  timeMax: string;
  maxResults?: number;
  pageToken?: string;
}

export interface ProcessedEvent {
  event_id: string;
  region: string;
  calendar_type: 'gregorian' | 'hijri' | 'indonesian';
  start_date: Date;
  end_date: Date;
  is_all_day: boolean;
  recurrence_rule: string | null;
  status: string;
  title?: string;
  description?: string;
}

export interface RateLimitConfig {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

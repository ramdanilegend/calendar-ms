// API Request and Response Types
export interface ApiResponse<T = any> {
  status: 'success' | 'error';
  data?: T;
  message?: string;
  timestamp: string;
}

export interface PaginationQuery {
  page?: string;
  limit?: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// Update Check Types
export interface UpdateCheckResponse {
  last_update: string;
  source: string;
  region: string;
  status: string;
}

// Events Types
export interface EventQuery extends PaginationQuery {
  region?: string;
  language?: string;
  updated_after?: string;
  calendar_type?: string;
  start_date?: string;
  end_date?: string;
  status?: string;
}

export interface EventResponse {
  id: number;
  event_id: string;
  region: string;
  calendar_type: string;
  start_date: string;
  end_date: string;
  is_all_day: boolean;
  recurrence_rule: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  translations?: EventTranslationResponse[];
  calendar_mappings?: CalendarMappingResponse[];
}

export interface EventTranslationResponse {
  id: number;
  language: string;
  title: string;
  description: string | null;
  location: string | null;
}

export interface CalendarMappingResponse {
  id: number;
  original_date: string;
  gregorian_date: string;
  hijri_date: string | null;
  indonesian_date: string | null;
}

export interface EventsListResponse {
  events: EventResponse[];
  pagination: PaginationMeta;
}

// Events Sync Types
export interface EventsSyncRequest {
  region?: string;
  force_refresh?: boolean;
}

export interface EventsSyncResponse {
  message: string;
  synced_events: number;
  region: string;
  sync_status: 'completed' | 'in_progress' | 'failed';
}

// Calendar Mappings Types
export interface CalendarMappingsRequest {
  mappings: CalendarMappingUpdate[];
}

export interface CalendarMappingUpdate {
  event_id: string;
  region: string;
  original_date: string;
  gregorian_date: string;
  hijri_date?: string;
  indonesian_date?: string;
}

export interface CalendarMappingsResponse {
  message: string;
  updated_mappings: number;
  failed_mappings: CalendarMappingError[];
}

export interface CalendarMappingError {
  event_id: string;
  region: string;
  error: string;
}

// Validation Types
export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

// Common Constants
export const SUPPORTED_REGIONS = ['id', 'my', 'sg', 'th', 'ph'] as const;
export const SUPPORTED_LANGUAGES = ['id', 'en', 'ms', 'th', 'tl'] as const;
export const SUPPORTED_CALENDAR_TYPES = ['gregorian', 'hijri', 'indonesian'] as const;
export const SUPPORTED_EVENT_STATUSES = ['confirmed', 'tentative', 'cancelled'] as const;

export type SupportedRegion = typeof SUPPORTED_REGIONS[number];
export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];
export type SupportedCalendarType = typeof SUPPORTED_CALENDAR_TYPES[number];
export type SupportedEventStatus = typeof SUPPORTED_EVENT_STATUSES[number];

-- Initialize database for Calendar Microservice
-- This script runs when the PostgreSQL container starts for the first time

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_events_event_id ON events(event_id);
CREATE INDEX IF NOT EXISTS idx_events_region ON events(region);
CREATE INDEX IF NOT EXISTS idx_events_calendar_type ON events(calendar_type);
CREATE INDEX IF NOT EXISTS idx_events_start_date ON events(start_date);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);

CREATE INDEX IF NOT EXISTS idx_event_translations_event_id ON event_translations(event_id);
CREATE INDEX IF NOT EXISTS idx_event_translations_language ON event_translations(language);

CREATE INDEX IF NOT EXISTS idx_calendar_mappings_event_id ON calendar_mappings(event_id);
CREATE INDEX IF NOT EXISTS idx_calendar_mappings_region ON calendar_mappings(region);

CREATE INDEX IF NOT EXISTS idx_update_metadata_source ON update_metadata(source);
CREATE INDEX IF NOT EXISTS idx_update_metadata_region ON update_metadata(region);

-- Create full-text search indexes
CREATE INDEX IF NOT EXISTS idx_event_translations_title_search ON event_translations USING gin(to_tsvector('english', title));
CREATE INDEX IF NOT EXISTS idx_event_translations_description_search ON event_translations USING gin(to_tsvector('english', description));

COMMIT;

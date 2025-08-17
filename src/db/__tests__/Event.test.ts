import { Event } from '../models/test-models';
import { cleanupTestTables } from './test-helpers';

describe('Event Model', () => {
  // Database is already set up and managed in jest.setup.js
  // No need to open/close connections here

  // Clean up data after each test
  afterEach(async () => {
    await cleanupTestTables();
  });

  it('should create an event successfully', async () => {
    // Create test event data
    const eventData = {
      event_id: 'test-event-123',
      region: 'US',
      calendar_type: 'gregorian',
      start_date: new Date('2023-01-01T10:00:00Z'),
      end_date: new Date('2023-01-01T11:00:00Z'),
      is_all_day: false,
      status: 'confirmed'
    };

    // Create the event in the database
    const event = await Event.create(eventData);
    
    // Verify event was created with correct data
    expect(event).toBeDefined();
    expect(event.event_id).toBe(eventData.event_id);
    expect(event.region).toBe(eventData.region);
    expect(event.calendar_type).toBe(eventData.calendar_type);
    expect(event.status).toBe(eventData.status);
  });

  it('should enforce unique constraint on event_id, region, and calendar_type', async () => {
    // Create first event
    const eventData = {
      event_id: 'unique-test-event',
      region: 'EU',
      calendar_type: 'gregorian',
      start_date: new Date('2023-02-01T10:00:00Z'),
      end_date: new Date('2023-02-01T11:00:00Z'),
      is_all_day: false,
      status: 'confirmed'
    };
    
    await Event.create(eventData);
    
    // Attempt to create duplicate event (same event_id, region, calendar_type)
    try {
      await Event.create(eventData);
      // If we get here, the test fails because the create should have thrown an error
      fail('Should have thrown UniqueConstraintError');
    } catch (error: any) {
      // Verify that the error is due to unique constraint violation
      expect(error.name).toBe('SequelizeUniqueConstraintError');
    }
    
    // Different calendar_type should work
    const differentCalendarEvent = {
      ...eventData,
      calendar_type: 'hijri'
    };
    const newEvent = await Event.create(differentCalendarEvent);
    expect(newEvent).toBeDefined();
    expect(newEvent.calendar_type).toBe('hijri');
  });
});

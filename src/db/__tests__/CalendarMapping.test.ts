import { Event, CalendarMapping } from '../models/test-models';
import { cleanupTestTables } from './test-helpers';

describe('CalendarMapping Model', () => {
  // Database is already set up and managed in jest.setup.js
  // No need to open/close connections here

  // Clean up data after each test
  afterEach(async () => {
    await cleanupTestTables();
  });

  it('should create a calendar mapping successfully', async () => {
    // Create a parent event first
    const eventData = {
      event_id: 'mapping-test-event',
      region: 'ME',
      calendar_type: 'gregorian',
      start_date: new Date('2023-05-01T10:00:00Z'),
      end_date: new Date('2023-05-01T11:00:00Z'),
      is_all_day: false,
      status: 'confirmed'
    };
    
    await Event.create(eventData);
    
    // Create test calendar mapping data
    const mappingData = {
      event_id: 'mapping-test-event',
      region: 'ME',
      original_date: new Date('2023-05-01T10:00:00Z'),
      gregorian_date: new Date('2023-05-01T10:00:00Z'),
      hijri_date: new Date('1444-10-11T10:00:00Z'), // Example Hijri date
      indonesian_date: null
    };

    // Create the calendar mapping in the database
    const mapping = await CalendarMapping.create(mappingData);
    
    // Verify mapping was created with correct data
    expect(mapping).toBeDefined();
    expect(mapping.event_id).toBe(mappingData.event_id);
    expect(mapping.region).toBe(mappingData.region);
    expect(mapping.original_date.toISOString()).toBe(mappingData.original_date.toISOString());
    expect(mapping.gregorian_date.toISOString()).toBe(mappingData.gregorian_date.toISOString());
    expect(mapping.hijri_date?.toISOString()).toBe(mappingData.hijri_date.toISOString());
    expect(mapping.indonesian_date).toBeNull();
  });

  it('should allow multiple mappings for the same event with different dates', async () => {
    // Create a parent event first
    const eventData = {
      event_id: 'multiple-mapping-event',
      region: 'ID',
      calendar_type: 'gregorian',
      start_date: new Date('2023-06-01T10:00:00Z'),
      end_date: new Date('2023-06-01T11:00:00Z'),
      is_all_day: false,
      status: 'confirmed'
    };
    
    await Event.create(eventData);
    
    // Create first mapping
    const mapping1Data = {
      event_id: 'multiple-mapping-event',
      region: 'ID',
      original_date: new Date('2023-06-01T10:00:00Z'),
      gregorian_date: new Date('2023-06-01T10:00:00Z'),
      hijri_date: null,
      indonesian_date: new Date('2023-06-01T10:00:00Z') // Same as Gregorian for simplicity
    };
    
    const mapping1 = await CalendarMapping.create(mapping1Data);
    expect(mapping1).toBeDefined();
    
    // Create second mapping for same event but different date
    const mapping2Data = {
      event_id: 'multiple-mapping-event',
      region: 'ID',
      original_date: new Date('2023-06-02T10:00:00Z'), // Different date
      gregorian_date: new Date('2023-06-02T10:00:00Z'),
      hijri_date: null,
      indonesian_date: new Date('2023-06-02T10:00:00Z')
    };
    
    const mapping2 = await CalendarMapping.create(mapping2Data);
    expect(mapping2).toBeDefined();
    
    // Verify we can retrieve both mappings
    const mappings = await CalendarMapping.findAll({
      where: {
        event_id: 'multiple-mapping-event'
      }
    });
    
    expect(mappings.length).toBe(2);
  });
});

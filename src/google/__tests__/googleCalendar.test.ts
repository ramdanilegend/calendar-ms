// Mock the dependencies
jest.mock('googleapis');
jest.mock('google-auth-library');
jest.mock('../../db/models/Event');
jest.mock('../../db/models/CalendarMapping');

// Mock config completely
jest.mock('../../config/config', () => {
  return {
    __esModule: true,
    default: {
      googleCalendar: {
        apiKey: 'test-api-key',
        serviceAccountPath: undefined,
        serviceAccountKey: undefined
      }
    }
  };
});

import { GoogleCalendarService } from '../googleCalendar';
import { CalendarScheduler } from '../scheduler';
import Event from '../../db/models/Event';
import CalendarMapping from '../../db/models/CalendarMapping';

const mockGoogleCalendarEvent = {
  id: 'test-event-1',
  summary: 'Test Event',
  description: 'Test Description',
  start: {
    dateTime: '2024-01-01T10:00:00Z',
    timeZone: 'UTC'
  },
  end: {
    dateTime: '2024-01-01T11:00:00Z',
    timeZone: 'UTC'
  },
  status: 'confirmed' as const,
  created: '2024-01-01T00:00:00Z',
  updated: '2024-01-01T00:00:00Z'
};

describe('GoogleCalendarService', () => {
  let googleCalendarService: GoogleCalendarService;
  let mockCalendarEventsListFn: jest.Mock;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Mock the Google Calendar API
    mockCalendarEventsListFn = jest.fn();
    
    const mockGoogle = {
      calendar: jest.fn(() => ({
        events: {
          list: mockCalendarEventsListFn
        }
      }))
    };
    
    require('googleapis').google = mockGoogle;
    
    // Mock JWT authentication
    const mockJWT = {
      authorize: jest.fn().mockResolvedValue(true)
    };
    
    require('google-auth-library').JWT = jest.fn(() => mockJWT);
    
    googleCalendarService = new GoogleCalendarService();
  });

  describe('fetchAnnualEvents', () => {
    it('should fetch events for all configured regions', async () => {
      // Mock API response
      mockCalendarEventsListFn.mockResolvedValue({
        data: {
          items: [mockGoogleCalendarEvent],
          nextPageToken: undefined
        }
      });

      const events = await googleCalendarService.fetchAnnualEvents(2024);

      // Should return processed events
      expect(events).toBeDefined();
      expect(events.length).toBeGreaterThan(0);
      expect(events[0]).toHaveProperty('event_id');
      expect(events[0]).toHaveProperty('region');
      expect(events[0]).toHaveProperty('calendar_type');
    });

    it('should handle API errors gracefully', async () => {
      // Mock API error
      mockCalendarEventsListFn.mockRejectedValue(new Error('API Error'));

      const events = await googleCalendarService.fetchAnnualEvents(2024);

      // Should return empty array on error
      expect(events).toEqual([]);
    });

    it('should handle pagination correctly', async () => {
      // Mock paginated response
      mockCalendarEventsListFn
        .mockResolvedValueOnce({
          data: {
            items: [mockGoogleCalendarEvent],
            nextPageToken: 'token123'
          }
        })
        .mockResolvedValueOnce({
          data: {
            items: [{ ...mockGoogleCalendarEvent, id: 'test-event-2' }],
            nextPageToken: undefined
          }
        });

      const events = await googleCalendarService.fetchAnnualEvents(2024);

      // Should fetch from multiple pages
      expect(events.length).toBeGreaterThan(0);
      expect(mockCalendarEventsListFn).toHaveBeenCalledWith(expect.objectContaining({
        pageToken: 'token123'
      }));
    });
  });

  describe('storeEvents', () => {
    it('should store events in database', async () => {
      const mockEventUpsert = jest.fn().mockResolvedValue({});
      const mockMappingUpsert = jest.fn().mockResolvedValue({});
      
      (Event.upsert as jest.Mock) = mockEventUpsert;
      (CalendarMapping.upsert as jest.Mock) = mockMappingUpsert;

      const processedEvents = [{
        event_id: 'test-1',
        region: 'US',
        calendar_type: 'gregorian' as const,
        start_date: new Date('2024-01-01'),
        end_date: new Date('2024-01-01'),
        is_all_day: false,
        recurrence_rule: null,
        status: 'confirmed'
      }];

      await googleCalendarService.storeEvents(processedEvents);

      expect(mockEventUpsert).toHaveBeenCalledWith({
        event_id: 'test-1',
        region: 'US',
        calendar_type: 'gregorian',
        start_date: new Date('2024-01-01'),
        end_date: new Date('2024-01-01'),
        is_all_day: false,
        recurrence_rule: null,
        status: 'confirmed'
      });

      expect(mockMappingUpsert).toHaveBeenCalledWith({
        event_id: 'test-1',
        region: 'US',
        original_date: new Date('2024-01-01'),
        gregorian_date: new Date('2024-01-01'),
        hijri_date: null,
        indonesian_date: null
      });
    });

    it('should handle database errors gracefully', async () => {
      const mockEventUpsert = jest.fn().mockRejectedValue(new Error('DB Error'));
      (Event.upsert as jest.Mock) = mockEventUpsert;

      const processedEvents = [{
        event_id: 'test-1',
        region: 'US',
        calendar_type: 'gregorian' as const,
        start_date: new Date('2024-01-01'),
        end_date: new Date('2024-01-01'),
        is_all_day: false,
        recurrence_rule: null,
        status: 'confirmed'
      }];

      // Should not throw error
      await expect(googleCalendarService.storeEvents(processedEvents)).resolves.not.toThrow();
    });
  });

  describe('syncAnnualData', () => {
    it('should fetch and store annual data successfully', async () => {
      // Mock successful API calls
      mockCalendarEventsListFn.mockResolvedValue({
        data: {
          items: [mockGoogleCalendarEvent],
          nextPageToken: undefined
        }
      });

      const mockEventUpsert = jest.fn().mockResolvedValue({});
      const mockMappingUpsert = jest.fn().mockResolvedValue({});
      
      (Event.upsert as jest.Mock) = mockEventUpsert;
      (CalendarMapping.upsert as jest.Mock) = mockMappingUpsert;

      await googleCalendarService.syncAnnualData(2024);

      // Should have called database operations
      expect(mockEventUpsert).toHaveBeenCalled();
      expect(mockMappingUpsert).toHaveBeenCalled();
    });
  });
});

describe('CalendarScheduler', () => {
  let scheduler: CalendarScheduler;

  beforeEach(() => {
    scheduler = new CalendarScheduler();
  });

  afterEach(() => {
    // Ensure all scheduled tasks are stopped to prevent hanging
    if (scheduler) {
      scheduler.stopAllScheduledTasks();
    }
  });

  describe('scheduleAnnualSync', () => {
    it('should schedule annual sync task', () => {
      scheduler.scheduleAnnualSync();
      
      const status = scheduler.getScheduledTasksStatus();
      expect(status['annual-calendar-sync']).toBeDefined();
    });

    it('should use custom cron expression', () => {
      const customCron = '0 3 1 1 *'; // Different time
      scheduler.scheduleAnnualSync(customCron);
      
      const status = scheduler.getScheduledTasksStatus();
      expect(status['annual-calendar-sync']).toBeDefined();
    });
  });

  describe('scheduleMonthlySync', () => {
    it('should schedule monthly sync task', () => {
      scheduler.scheduleMonthlySync();
      
      const status = scheduler.getScheduledTasksStatus();
      expect(status['monthly-calendar-sync']).toBeDefined();
    });
  });

  describe('scheduleWeeklySync', () => {
    it('should schedule weekly sync task', () => {
      scheduler.scheduleWeeklySync();
      
      const status = scheduler.getScheduledTasksStatus();
      expect(status['weekly-calendar-sync']).toBeDefined();
    });
  });

  describe('stopScheduledTask', () => {
    it('should stop specific task', () => {
      scheduler.scheduleAnnualSync();
      scheduler.stopScheduledTask('annual-calendar-sync');
      
      const status = scheduler.getScheduledTasksStatus();
      expect(status['annual-calendar-sync']).toBeUndefined();
    });
  });

  describe('stopAllScheduledTasks', () => {
    it('should stop all tasks', () => {
      scheduler.startAllScheduledTasks();
      scheduler.stopAllScheduledTasks();
      
      const status = scheduler.getScheduledTasksStatus();
      expect(Object.keys(status)).toHaveLength(0);
    });
  });

  describe('manualSync', () => {
    it('should run manual sync for current year', async () => {
      // Mock the Google Calendar service
      const mockSyncAnnualData = jest.fn().mockResolvedValue(undefined);
      scheduler['googleCalendarService'].syncAnnualData = mockSyncAnnualData;

      await scheduler.manualSync();

      expect(mockSyncAnnualData).toHaveBeenCalledWith(new Date().getFullYear());
    });

    it('should run manual sync for specified year', async () => {
      const mockSyncAnnualData = jest.fn().mockResolvedValue(undefined);
      scheduler['googleCalendarService'].syncAnnualData = mockSyncAnnualData;

      await scheduler.manualSync(2025);

      expect(mockSyncAnnualData).toHaveBeenCalledWith(2025);
    });

    it('should handle sync errors', async () => {
      const mockSyncAnnualData = jest.fn().mockRejectedValue(new Error('Sync failed'));
      scheduler['googleCalendarService'].syncAnnualData = mockSyncAnnualData;

      await expect(scheduler.manualSync()).rejects.toThrow('Sync failed');
    });
  });
});

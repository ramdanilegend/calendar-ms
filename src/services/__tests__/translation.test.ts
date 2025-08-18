import { TranslationService, LanguageCode, CreateTranslationInput } from '../translation';
import EventTranslation from '../../db/models/EventTranslation';
import Event from '../../db/models/Event';

// Mock the database models
jest.mock('../../db/models/EventTranslation');
jest.mock('../../db/models/Event');

const MockedEventTranslation = EventTranslation as jest.Mocked<typeof EventTranslation>;
const MockedEvent = Event as jest.Mocked<typeof Event>;

describe('TranslationService', () => {
  let translationService: TranslationService;

  beforeEach(() => {
    // Create fresh instance for each test
    translationService = new TranslationService({
      cacheEnabled: true,
      cacheTTL: 1000, // 1 second for testing
      maxCacheSize: 10,
      enableLogging: false // Disable logging in tests
    });

    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    translationService.destroy();
  });

  describe('Language Code Validation', () => {
    it('should validate correct language codes', () => {
      expect(translationService.isValidLanguageCode('en')).toBe(true);
      expect(translationService.isValidLanguageCode('id')).toBe(true);
      expect(translationService.isValidLanguageCode('ar')).toBe(true);
    });

    it('should reject invalid language codes', () => {
      expect(translationService.isValidLanguageCode('fr')).toBe(false);
      expect(translationService.isValidLanguageCode('es')).toBe(false);
      expect(translationService.isValidLanguageCode('')).toBe(false);
      expect(translationService.isValidLanguageCode('invalid')).toBe(false);
    });
  });

  describe('getTranslation', () => {
    const mockTranslation = {
      id: 1,
      event_id: 'event123',
      language: 'en',
      title: 'Test Event',
      description: 'Test Description',
      location: 'Test Location',
      created_at: new Date(),
      updated_at: new Date()
    };

    it('should fetch translation successfully', async () => {
      MockedEventTranslation.findOne.mockResolvedValue(mockTranslation as any);

      const result = await translationService.getTranslation('event123', LanguageCode.ENGLISH);

      expect(result).toEqual({
        eventId: 'event123',
        language: LanguageCode.ENGLISH,
        data: {
          title: 'Test Event',
          description: 'Test Description',
          location: 'Test Location'
        },
        fallbackUsed: false,
        cached: false,
        updatedAt: mockTranslation.updated_at
      });

      expect(MockedEventTranslation.findOne).toHaveBeenCalledWith({
        where: {
          event_id: 'event123',
          language: 'en'
        }
      });
    });

    it('should return null when translation not found and no fallback available', async () => {
      MockedEventTranslation.findOne.mockResolvedValue(null);

      const result = await translationService.getTranslation('event123', LanguageCode.ENGLISH);

      expect(result).toBeNull();
    });

    it('should use fallback language when primary language not available', async () => {
      const fallbackTranslation = {
        ...mockTranslation,
        language: 'en',
        title: 'Fallback Title'
      };

      MockedEventTranslation.findOne
        .mockResolvedValueOnce(null) // First call for Indonesian
        .mockResolvedValueOnce(fallbackTranslation as any); // Second call for English fallback

      const result = await translationService.getTranslation('event123', LanguageCode.INDONESIAN);

      expect(result).toEqual({
        eventId: 'event123',
        language: LanguageCode.INDONESIAN,
        data: {
          title: 'Fallback Title',
          description: 'Test Description',
          location: 'Test Location'
        },
        fallbackUsed: true,
        cached: false,
        updatedAt: fallbackTranslation.updated_at
      });
    });

    it('should throw error for invalid inputs', async () => {
      await expect(
        translationService.getTranslation('', LanguageCode.ENGLISH)
      ).rejects.toThrow('Invalid eventId or language code');

      await expect(
        translationService.getTranslation('event123', 'invalid' as LanguageCode)
      ).rejects.toThrow('Invalid eventId or language code');
    });

    it('should use cache when available', async () => {
      MockedEventTranslation.findOne.mockResolvedValue(mockTranslation as any);

      // First call should hit database
      await translationService.getTranslation('event123', LanguageCode.ENGLISH);
      expect(MockedEventTranslation.findOne).toHaveBeenCalledTimes(1);

      // Second call should use cache
      const result2 = await translationService.getTranslation('event123', LanguageCode.ENGLISH);
      expect(MockedEventTranslation.findOne).toHaveBeenCalledTimes(1); // Still only 1 call
      expect(result2?.cached).toBe(true);
    });
  });

  describe('getAllTranslations', () => {
    it('should fetch all translations for an event', async () => {
      const mockTranslations = [
        {
          id: 1,
          event_id: 'event123',
          language: 'en',
          title: 'English Title',
          description: 'English Description',
          location: 'English Location',
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          id: 2,
          event_id: 'event123',
          language: 'id',
          title: 'Judul Indonesia',
          description: 'Deskripsi Indonesia',
          location: 'Lokasi Indonesia',
          created_at: new Date(),
          updated_at: new Date()
        }
      ];

      MockedEventTranslation.findAll.mockResolvedValue(mockTranslations as any);

      const results = await translationService.getAllTranslations('event123');

      expect(results).toHaveLength(2);
      expect(results[0].language).toBe(LanguageCode.ENGLISH);
      expect(results[1].language).toBe(LanguageCode.INDONESIAN);
      expect(MockedEventTranslation.findAll).toHaveBeenCalledWith({
        where: { event_id: 'event123' }
      });
    });
  });

  describe('upsertTranslation', () => {
    const createInput: CreateTranslationInput = {
      eventId: 'event123',
      language: LanguageCode.ENGLISH,
      title: 'New Title',
      description: 'New Description',
      location: 'New Location'
    };

    it('should create translation successfully', async () => {
      const mockEvent = { event_id: 'event123' };
      const mockTranslation = {
        id: 1,
        event_id: 'event123',
        language: 'en',
        title: 'New Title',
        description: 'New Description',
        location: 'New Location',
        created_at: new Date(),
        updated_at: new Date()
      };

      MockedEvent.findOne.mockResolvedValue(mockEvent as any);
      MockedEventTranslation.upsert.mockResolvedValue([mockTranslation as any, true]);

      const result = await translationService.upsertTranslation(createInput);

      expect(result.data.title).toBe('New Title');
      expect(result.fallbackUsed).toBe(false);
      expect(MockedEvent.findOne).toHaveBeenCalledWith({
        where: { event_id: 'event123' }
      });
      expect(MockedEventTranslation.upsert).toHaveBeenCalledWith({
        event_id: 'event123',
        language: 'en',
        title: 'New Title',
        description: 'New Description',
        location: 'New Location'
      });
    });

    it('should throw error when event does not exist', async () => {
      MockedEvent.findOne.mockResolvedValue(null);

      await expect(
        translationService.upsertTranslation(createInput)
      ).rejects.toThrow('Event event123 not found');
    });

    it('should throw error for invalid inputs', async () => {
      await expect(
        translationService.upsertTranslation({
          ...createInput,
          eventId: ''
        })
      ).rejects.toThrow('Invalid input: eventId, language, and title are required');

      await expect(
        translationService.upsertTranslation({
          ...createInput,
          title: ''
        })
      ).rejects.toThrow('Invalid input: eventId, language, and title are required');
    });
  });

  describe('deleteTranslation', () => {
    it('should delete translation successfully', async () => {
      MockedEventTranslation.destroy.mockResolvedValue(1);

      const result = await translationService.deleteTranslation('event123', LanguageCode.ENGLISH);

      expect(result).toBe(true);
      expect(MockedEventTranslation.destroy).toHaveBeenCalledWith({
        where: {
          event_id: 'event123',
          language: 'en'
        }
      });
    });

    it('should return false when no translation found to delete', async () => {
      MockedEventTranslation.destroy.mockResolvedValue(0);

      const result = await translationService.deleteTranslation('event123', LanguageCode.ENGLISH);

      expect(result).toBe(false);
    });
  });

  describe('formatText', () => {
    it('should format text correctly for different languages', () => {
      const text = '  Test Text  ';

      expect(translationService.formatText(text, LanguageCode.ENGLISH)).toBe('Test Text');
      expect(translationService.formatText(text, LanguageCode.INDONESIAN)).toBe('Test Text');
      expect(translationService.formatText(text, LanguageCode.ARABIC)).toBe('Test Text');
    });

    it('should handle empty text', () => {
      expect(translationService.formatText('', LanguageCode.ENGLISH)).toBe('');
      expect(translationService.formatText('   ', LanguageCode.ENGLISH)).toBe('');
    });
  });

  describe('Cache Management', () => {
    it('should provide cache statistics', () => {
      const stats = translationService.getCacheStats();

      expect(stats).toEqual({
        size: 0,
        maxSize: 10,
        enabled: true,
        ttl: 1000
      });
    });

    it('should clear cache', () => {
      translationService.clearCache();
      const stats = translationService.getCacheStats();
      expect(stats.size).toBe(0);
    });

    it('should expire cache entries after TTL', async () => {
      const mockTranslation = {
        id: 1,
        event_id: 'event123',
        language: 'en',
        title: 'Test Event',
        description: 'Test Description',
        location: 'Test Location',
        created_at: new Date(),
        updated_at: new Date()
      };

      MockedEventTranslation.findOne.mockResolvedValue(mockTranslation as any);

      // First call should cache the result
      await translationService.getTranslation('event123', LanguageCode.ENGLISH);
      expect(MockedEventTranslation.findOne).toHaveBeenCalledTimes(1);

      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Second call should hit database again
      await translationService.getTranslation('event123', LanguageCode.ENGLISH);
      expect(MockedEventTranslation.findOne).toHaveBeenCalledTimes(2);
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      const dbError = new Error('Database connection failed');
      MockedEventTranslation.findOne.mockRejectedValue(dbError);

      await expect(
        translationService.getTranslation('event123', LanguageCode.ENGLISH)
      ).rejects.toThrow('Database connection failed');
    });

    it('should handle upsert errors gracefully', async () => {
      const mockEvent = { event_id: 'event123' };
      const dbError = new Error('Upsert failed');

      MockedEvent.findOne.mockResolvedValue(mockEvent as any);
      MockedEventTranslation.upsert.mockRejectedValue(dbError);

      await expect(
        translationService.upsertTranslation({
          eventId: 'event123',
          language: LanguageCode.ENGLISH,
          title: 'Test Title'
        })
      ).rejects.toThrow('Upsert failed');
    });
  });
});

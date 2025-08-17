import { Event, EventTranslation } from '../models/test-models';
import { cleanupTestTables } from './test-helpers';

describe('EventTranslation Model', () => {
  // Database is already set up and managed in jest.setup.js
  // No need to open/close connections here

  // Clean up data after each test
  afterEach(async () => {
    await cleanupTestTables();
  });

  it('should create an event translation successfully', async () => {
    // Create a parent event first
    const eventData = {
      event_id: 'translation-test-event',
      region: 'GLOBAL',
      calendar_type: 'gregorian',
      start_date: new Date('2023-03-01T10:00:00Z'),
      end_date: new Date('2023-03-01T11:00:00Z'),
      is_all_day: false,
      status: 'confirmed'
    };
    
    await Event.create(eventData);
    
    // Create test event translation data
    const translationData = {
      event_id: 'translation-test-event',
      language: 'en',
      title: 'Test Event Title',
      description: 'This is a test event description',
      location: 'Virtual'
    };

    // Create the event translation in the database
    const translation = await EventTranslation.create(translationData);
    
    // Verify translation was created with correct data
    expect(translation).toBeDefined();
    expect(translation.event_id).toBe(translationData.event_id);
    expect(translation.language).toBe(translationData.language);
    expect(translation.title).toBe(translationData.title);
    expect(translation.description).toBe(translationData.description);
    expect(translation.location).toBe(translationData.location);
  });

  it('should enforce unique constraint on event_id and language', async () => {
    // Create a parent event first
    const eventData = {
      event_id: 'unique-translation-event',
      region: 'GLOBAL',
      calendar_type: 'gregorian',
      start_date: new Date('2023-04-01T10:00:00Z'),
      end_date: new Date('2023-04-01T11:00:00Z'),
      is_all_day: false,
      status: 'confirmed'
    };
    
    await Event.create(eventData);
    
    // Create first translation
    const translationData = {
      event_id: 'unique-translation-event',
      language: 'fr',
      title: 'Titre de l\'événement de test',
      description: 'Ceci est une description d\'événement de test',
      location: 'Virtuel'
    };
    
    await EventTranslation.create(translationData);
    
    // Attempt to create duplicate translation (same event_id and language)
    try {
      await EventTranslation.create(translationData);
      // If we get here, the test fails because the create should have thrown an error
      fail('Should have thrown UniqueConstraintError');
    } catch (error: any) {
      // Verify that the error is due to unique constraint violation
      expect(error.name).toBe('SequelizeUniqueConstraintError');
    }
    
    // Different language should work
    const differentLanguageTranslation = {
      ...translationData,
      language: 'es',
      title: 'Título del evento de prueba',
      description: 'Esta es una descripción de evento de prueba'
    };
    const newTranslation = await EventTranslation.create(differentLanguageTranslation);
    expect(newTranslation).toBeDefined();
    expect(newTranslation.language).toBe('es');
  });
});

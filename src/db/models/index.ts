import Event from './Event';
import EventTranslation from './EventTranslation';
import CalendarMapping from './CalendarMapping';
import UpdateMetadata from './UpdateMetadata';
import sequelize from '../index';

// Define associations between models
Event.hasMany(EventTranslation, {
  sourceKey: 'event_id',
  foreignKey: 'event_id',
  as: 'translations'
});

EventTranslation.belongsTo(Event, {
  targetKey: 'event_id',
  foreignKey: 'event_id',
  as: 'event'
});

Event.hasMany(CalendarMapping, {
  sourceKey: 'event_id',
  foreignKey: 'event_id',
  as: 'calendarMappings'
});

CalendarMapping.belongsTo(Event, {
  targetKey: 'event_id',
  foreignKey: 'event_id',
  as: 'event'
});

// Export models and sequelize instance
export {
  sequelize,
  Event,
  EventTranslation,
  CalendarMapping,
  UpdateMetadata
};

// Export default as a function that synchronizes all models with the database
export default async function syncModels(force = false): Promise<void> {
  try {
    await sequelize.sync({ force });
    console.log('All models were synchronized successfully.');
  } catch (error) {
    console.error('Failed to synchronize models:', error);
    throw error;
  }
}

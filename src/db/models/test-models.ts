import { DataTypes, Model } from 'sequelize';
import testSequelize from '../test-connection';

// Event model definition for tests
class Event extends Model {
  declare id: number;
  declare event_id: string;
  declare region: string;
  declare calendar_type: string;
  declare start_date: Date;
  declare end_date: Date;
  declare is_all_day: boolean;
  declare status: string;
  declare created_at: Date;
  declare updated_at: Date;
}

// Event Translation model definition for tests
class EventTranslation extends Model {
  declare id: number;
  declare event_id: string;
  declare language: string;
  declare title: string;
  declare description: string | null;
  declare location: string | null;
  declare created_at: Date;
  declare updated_at: Date;
}

// Calendar Mapping model definition for tests
class CalendarMapping extends Model {
  declare id: number;
  declare event_id: string;
  declare region: string;
  declare original_date: Date;
  declare gregorian_date: Date;
  declare hijri_date: Date | null;
  declare indonesian_date: Date | null;
  declare created_at: Date;
  declare updated_at: Date;
}

// Update Metadata model definition for tests
class UpdateMetadata extends Model {
  declare id: number;
  declare source: string;
  declare region: string;
  declare last_successful_update: Date;
  declare status: string;
  declare error_details: string | null;
  declare created_at: Date;
  declare updated_at: Date;
}

// Initialize models with test database connection
Event.init({
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  event_id: {
    type: DataTypes.STRING,
    allowNull: false
  },
  region: {
    type: DataTypes.STRING,
    allowNull: false
  },
  calendar_type: {
    type: DataTypes.STRING,
    allowNull: false
  },
  start_date: {
    type: DataTypes.DATE,
    allowNull: false
  },
  end_date: {
    type: DataTypes.DATE,
    allowNull: false
  },
  is_all_day: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  status: {
    type: DataTypes.STRING,
    allowNull: false
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  updated_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  sequelize: testSequelize,
  modelName: 'Event',
  tableName: 'events',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      unique: true,
      fields: ['event_id', 'region', 'calendar_type']
    }
  ]
});

EventTranslation.init({
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  event_id: {
    type: DataTypes.STRING,
    allowNull: false,
    references: {
      model: 'events',
      key: 'event_id'
    }
  },
  language: {
    type: DataTypes.STRING(5),
    allowNull: false
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  location: {
    type: DataTypes.STRING,
    allowNull: true
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  updated_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  sequelize: testSequelize,
  modelName: 'EventTranslation',
  tableName: 'event_translations',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      unique: true,
      fields: ['event_id', 'language']
    }
  ]
});

CalendarMapping.init({
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  event_id: {
    type: DataTypes.STRING,
    allowNull: false,
    references: {
      model: 'events',
      key: 'event_id'
    }
  },
  region: {
    type: DataTypes.STRING,
    allowNull: false
  },
  original_date: {
    type: DataTypes.DATE,
    allowNull: false
  },
  gregorian_date: {
    type: DataTypes.DATE,
    allowNull: false
  },
  hijri_date: {
    type: DataTypes.DATE,
    allowNull: true
  },
  indonesian_date: {
    type: DataTypes.DATE,
    allowNull: true
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  updated_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  sequelize: testSequelize,
  modelName: 'CalendarMapping',
  tableName: 'calendar_mappings',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      unique: true,
      fields: ['event_id', 'region', 'original_date']
    }
  ]
});

UpdateMetadata.init({
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  source: {
    type: DataTypes.STRING,
    allowNull: false
  },
  region: {
    type: DataTypes.STRING,
    allowNull: false
  },
  last_successful_update: {
    type: DataTypes.DATE,
    allowNull: false
  },
  status: {
    type: DataTypes.STRING,
    allowNull: false
  },
  error_details: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  updated_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  sequelize: testSequelize,
  modelName: 'UpdateMetadata',
  tableName: 'update_metadata',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      unique: true,
      fields: ['source', 'region']
    }
  ]
});

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
  testSequelize,
  Event,
  EventTranslation,
  CalendarMapping,
  UpdateMetadata
};

// Export default as a function that synchronizes all models with the database
export default async function syncTestModels(force = false): Promise<void> {
  try {
    await testSequelize.sync({ force });
    console.log('All test models were synchronized successfully.');
  } catch (error) {
    console.error('Failed to synchronize test models:', error);
    throw error;
  }
}

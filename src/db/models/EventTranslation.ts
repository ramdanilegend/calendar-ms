import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../index';

// Interface defining EventTranslation attributes
interface EventTranslationAttributes {
  id: number;
  event_id: string;  // Foreign key to events table
  language: string;  // Language code (e.g., en, ar, id)
  title: string;
  description: string | null;
  location: string | null;
  created_at: Date;
  updated_at: Date;
}

// Interface for EventTranslation creation attributes
interface EventTranslationCreationAttributes extends Optional<EventTranslationAttributes, 'id' | 'created_at' | 'updated_at'> {}

// EventTranslation model class definition
class EventTranslation extends Model<EventTranslationAttributes, EventTranslationCreationAttributes> implements EventTranslationAttributes {
  public id!: number;
  public event_id!: string;
  public language!: string;
  public title!: string;
  public description!: string | null;
  public location!: string | null;
  public created_at!: Date;
  public updated_at!: Date;

  // Timestamps
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

// Initialize the model with its attributes and options
EventTranslation.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    event_id: {
      type: DataTypes.STRING,
      allowNull: false,
      references: {
        model: 'events',
        key: 'event_id',
      },
    },
    language: {
      type: DataTypes.STRING(5),
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    location: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    modelName: 'EventTranslation',
    tableName: 'event_translations',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['event_id', 'language'],
        name: 'event_translations_event_id_language_unique',
      },
      {
        fields: ['event_id'],
        name: 'event_translations_event_id_idx',
      },
      {
        fields: ['language'],
        name: 'event_translations_language_idx',
      },
    ],
  }
);

export default EventTranslation;

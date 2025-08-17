import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../index';

// Interface defining Event attributes
interface EventAttributes {
  id: number;
  event_id: string;  // Unique identifier from the source system
  region: string;    // Geographic region code
  calendar_type: string;  // Type of calendar (gregorian, hijri, indonesian)
  start_date: Date;
  end_date: Date;
  is_all_day: boolean;
  recurrence_rule: string | null;
  status: string;    // confirmed, tentative, cancelled
  created_at: Date;
  updated_at: Date;
}

// Interface for Event creation attributes (optional fields during creation)
interface EventCreationAttributes extends Optional<EventAttributes, 'id' | 'created_at' | 'updated_at'> {}

// Event model class definition
class Event extends Model<EventAttributes, EventCreationAttributes> implements EventAttributes {
  public id!: number;
  public event_id!: string;
  public region!: string;
  public calendar_type!: string;
  public start_date!: Date;
  public end_date!: Date;
  public is_all_day!: boolean;
  public recurrence_rule!: string | null;
  public status!: string;
  public created_at!: Date;
  public updated_at!: Date;

  // Timestamps
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

// Initialize the model with its attributes and options
Event.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    event_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    region: {
      type: DataTypes.STRING(10),
      allowNull: false,
    },
    calendar_type: {
      type: DataTypes.STRING(15),
      allowNull: false,
    },
    start_date: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    end_date: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    is_all_day: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    recurrence_rule: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING(15),
      allowNull: false,
      defaultValue: 'confirmed',
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
    modelName: 'Event',
    tableName: 'events',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['event_id', 'region', 'calendar_type'],
        name: 'events_event_id_region_calendar_type_unique',
      },
      {
        fields: ['event_id'],
        name: 'events_event_id_idx',
      },
      {
        fields: ['region'],
        name: 'events_region_idx',
      },
      {
        fields: ['calendar_type'],
        name: 'events_calendar_type_idx',
      },
      {
        fields: ['start_date'],
        name: 'events_start_date_idx',
      },
      {
        fields: ['updated_at'],
        name: 'events_updated_at_idx',
      },
    ],
  }
);

export default Event;

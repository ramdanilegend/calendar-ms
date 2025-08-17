import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../index';

// Interface defining CalendarMapping attributes
interface CalendarMappingAttributes {
  id: number;
  event_id: string;  // Foreign key to events table
  region: string;
  original_date: Date;
  gregorian_date: Date;
  hijri_date: Date | null;
  indonesian_date: Date | null;
  created_at: Date;
  updated_at: Date;
}

// Interface for CalendarMapping creation attributes
interface CalendarMappingCreationAttributes extends Optional<CalendarMappingAttributes, 'id' | 'created_at' | 'updated_at' | 'hijri_date' | 'indonesian_date'> {}

// CalendarMapping model class definition
class CalendarMapping extends Model<CalendarMappingAttributes, CalendarMappingCreationAttributes> implements CalendarMappingAttributes {
  public id!: number;
  public event_id!: string;
  public region!: string;
  public original_date!: Date;
  public gregorian_date!: Date;
  public hijri_date!: Date | null;
  public indonesian_date!: Date | null;
  public created_at!: Date;
  public updated_at!: Date;

  // Timestamps
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

// Initialize the model with its attributes and options
CalendarMapping.init(
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
    region: {
      type: DataTypes.STRING(10),
      allowNull: false,
    },
    original_date: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    gregorian_date: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    hijri_date: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    indonesian_date: {
      type: DataTypes.DATE,
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
    modelName: 'CalendarMapping',
    tableName: 'calendar_mappings',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        fields: ['event_id', 'region'],
        name: 'calendar_mappings_event_id_region_idx',
      },
      {
        fields: ['original_date'],
        name: 'calendar_mappings_original_date_idx',
      },
      {
        fields: ['gregorian_date'],
        name: 'calendar_mappings_gregorian_date_idx',
      },
      {
        fields: ['hijri_date'],
        name: 'calendar_mappings_hijri_date_idx',
      },
      {
        fields: ['indonesian_date'],
        name: 'calendar_mappings_indonesian_date_idx',
      },
    ],
  }
);

export default CalendarMapping;

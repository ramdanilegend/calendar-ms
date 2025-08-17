import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../index';

// Interface defining UpdateMetadata attributes
interface UpdateMetadataAttributes {
  id: number;
  source: string;  // Source of update (e.g., 'google_calendar', 'manual')
  region: string;
  last_successful_update: Date;
  status: string;  // success, failed, in_progress
  error_details: string | null;
  created_at: Date;
  updated_at: Date;
}

// Interface for UpdateMetadata creation attributes
interface UpdateMetadataCreationAttributes extends Optional<UpdateMetadataAttributes, 'id' | 'created_at' | 'updated_at' | 'error_details'> {}

// UpdateMetadata model class definition
class UpdateMetadata extends Model<UpdateMetadataAttributes, UpdateMetadataCreationAttributes> implements UpdateMetadataAttributes {
  public id!: number;
  public source!: string;
  public region!: string;
  public last_successful_update!: Date;
  public status!: string;
  public error_details!: string | null;
  public created_at!: Date;
  public updated_at!: Date;

  // Timestamps
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

// Initialize the model with its attributes and options
UpdateMetadata.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    source: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    region: {
      type: DataTypes.STRING(10),
      allowNull: false,
    },
    last_successful_update: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'success',
    },
    error_details: {
      type: DataTypes.TEXT,
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
    modelName: 'UpdateMetadata',
    tableName: 'update_metadata',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['source', 'region'],
        name: 'update_metadata_source_region_unique',
      },
      {
        fields: ['last_successful_update'],
        name: 'update_metadata_last_successful_update_idx',
      },
      {
        fields: ['status'],
        name: 'update_metadata_status_idx',
      },
    ],
  }
);

export default UpdateMetadata;

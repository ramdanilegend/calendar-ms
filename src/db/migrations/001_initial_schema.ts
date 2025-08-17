import { QueryInterface, DataTypes } from 'sequelize';

/**
 * Helper function to safely run SQL with error handling for specific error codes
 */
async function executeSafely(queryInterface: QueryInterface, sql: string, errorCodesToIgnore: string[] = ['42P07', '42P01']) {
  try {
    await queryInterface.sequelize.query(sql, { raw: true });
    return true;
  } catch (error: any) {
    if (error.parent && errorCodesToIgnore.includes(error.parent.code)) {
      console.log(`Ignoring error ${error.parent.code}: ${error.parent.message}`);
      return false;
    }
    throw error;
  }
}

/**
 * Migration for initial schema creation
 * This creates all the tables needed for the calendar microservice
 */
const migration = {
  up: async (queryInterface: QueryInterface, Sequelize: typeof DataTypes): Promise<void> => {
    console.log('Starting migration: Create initial schema');
    
    try {
      // First attempt to cleanup any existing partial migrations
      console.log('Cleaning up any existing objects...');
      
      // Try to drop foreign key constraints first (to avoid dependency errors)
      await executeSafely(queryInterface, 'ALTER TABLE IF EXISTS event_translations DROP CONSTRAINT IF EXISTS event_translations_event_id_fkey');
      await executeSafely(queryInterface, 'ALTER TABLE IF EXISTS calendar_mappings DROP CONSTRAINT IF EXISTS calendar_mappings_event_id_fkey');
      await executeSafely(queryInterface, 'ALTER TABLE IF EXISTS update_metadata DROP CONSTRAINT IF EXISTS update_metadata_event_id_fkey');
      
      // Drop indexes that may exist
      await executeSafely(queryInterface, 'DROP INDEX IF EXISTS events_calendar_type_idx');
      await executeSafely(queryInterface, 'DROP INDEX IF EXISTS events_region_idx');
      await executeSafely(queryInterface, 'DROP INDEX IF EXISTS events_external_id_idx');
      await executeSafely(queryInterface, 'DROP INDEX IF EXISTS events_start_date_idx');
      await executeSafely(queryInterface, 'DROP INDEX IF EXISTS event_translations_language_idx');
      await executeSafely(queryInterface, 'DROP INDEX IF EXISTS event_translations_event_id_language_key');
      await executeSafely(queryInterface, 'DROP INDEX IF EXISTS calendar_mappings_source_system_idx');
      await executeSafely(queryInterface, 'DROP INDEX IF EXISTS calendar_mappings_external_id_idx');
      await executeSafely(queryInterface, 'DROP INDEX IF EXISTS calendar_mappings_event_id_calendar_id_source_system_key');
      await executeSafely(queryInterface, 'DROP INDEX IF EXISTS update_metadata_event_id_idx');
      await executeSafely(queryInterface, 'DROP INDEX IF EXISTS update_metadata_update_source_idx');

      // Drop existing tables if they exist (in reverse dependency order)
      await executeSafely(queryInterface, 'DROP TABLE IF EXISTS update_metadata');
      await executeSafely(queryInterface, 'DROP TABLE IF EXISTS calendar_mappings');
      await executeSafely(queryInterface, 'DROP TABLE IF EXISTS event_translations');
      await executeSafely(queryInterface, 'DROP TABLE IF EXISTS events');
      
      console.log('Phase 1: Creating tables...');
      
      // Create events table
      await queryInterface.createTable('events', {
        id: {
          type: Sequelize.INTEGER,
          autoIncrement: true,
          primaryKey: true,
        },
        event_id: {
          type: Sequelize.STRING,
          allowNull: false,
          unique: true,
        },
        region: {
          type: Sequelize.STRING(10),
          allowNull: false,
        },
        calendar_type: {
          type: Sequelize.STRING(15),
          allowNull: false,
        },
        start_date: {
          type: Sequelize.DATE,
          allowNull: false,
        },
        end_date: {
          type: Sequelize.DATE,
          allowNull: false,
        },
        is_active: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true,
        },
        external_id: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW,
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW,
        }
      });
      
      console.log('Created events table');
      
      // Create event_translations table
      await queryInterface.createTable('event_translations', {
        id: {
          type: Sequelize.INTEGER,
          autoIncrement: true,
          primaryKey: true,
        },
        event_id: {
          type: Sequelize.STRING,
          allowNull: false,
          references: {
            model: 'events',
            key: 'event_id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE'
        },
        language: {
          type: Sequelize.STRING(5),
          allowNull: false,
        },
        title: {
          type: Sequelize.STRING(255),
          allowNull: false,
        },
        description: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        location: {
          type: Sequelize.STRING(255),
          allowNull: true,
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW,
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW,
        }
      });
      
      console.log('Created event_translations table');
      
      // Create calendar_mappings table
      await queryInterface.createTable('calendar_mappings', {
        id: {
          type: Sequelize.INTEGER,
          autoIncrement: true,
          primaryKey: true,
        },
        event_id: {
          type: Sequelize.STRING,
          allowNull: false,
          references: {
            model: 'events',
            key: 'event_id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE'
        },
        calendar_id: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        source_system: {
          type: Sequelize.STRING(50),
          allowNull: false,
        },
        external_id: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        sync_token: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW,
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW,
        }
      });
      
      console.log('Created calendar_mappings table');
      
      // Create update_metadata table
      await queryInterface.createTable('update_metadata', {
        id: {
          type: Sequelize.INTEGER,
          autoIncrement: true,
          primaryKey: true,
        },
        event_id: {
          type: Sequelize.STRING,
          allowNull: false,
          references: {
            model: 'events',
            key: 'event_id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE'
        },
        updated_by: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        update_source: {
          type: Sequelize.STRING(50),
          allowNull: false,
        },
        previous_values: {
          type: Sequelize.JSONB,
          allowNull: true,
        },
        new_values: {
          type: Sequelize.JSONB,
          allowNull: true,
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW,
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW,
        }
      });
      
      console.log('Created update_metadata table');
      
      // Add unique constraints and indexes
      console.log('Adding unique constraints and indexes...');
      
      // Add unique constraint for event_translations
      await queryInterface.addIndex(
        'event_translations',
        ['event_id', 'language'],
        { 
          unique: true, 
          name: 'event_translations_event_id_language_key'
        }
      );
      
      // Add unique constraint for calendar_mappings
      await queryInterface.addIndex(
        'calendar_mappings',
        ['event_id', 'calendar_id', 'source_system'],
        { 
          unique: true, 
          name: 'calendar_mappings_event_id_calendar_id_source_system_key'
        }
      );
      
      // Add indexes for common query fields
      await queryInterface.addIndex('events', ['calendar_type'], { name: 'events_calendar_type_idx' });
      await queryInterface.addIndex('events', ['region'], { name: 'events_region_idx' });
      await queryInterface.addIndex('events', ['external_id'], { name: 'events_external_id_idx' });
      await queryInterface.addIndex('events', ['start_date'], { name: 'events_start_date_idx' });
      
      await queryInterface.addIndex('event_translations', ['language'], { name: 'event_translations_language_idx' });
      
      await queryInterface.addIndex('calendar_mappings', ['source_system'], { name: 'calendar_mappings_source_system_idx' });
      await queryInterface.addIndex('calendar_mappings', ['external_id'], { name: 'calendar_mappings_external_id_idx' });
      
      await queryInterface.addIndex('update_metadata', ['event_id'], { name: 'update_metadata_event_id_idx' });
      await queryInterface.addIndex('update_metadata', ['update_source'], { name: 'update_metadata_update_source_idx' });
      
      console.log('Migration completed successfully');
    } catch (error) {
      console.error('Migration failed:', error);
      throw error;
    }
  },

  down: async (queryInterface: QueryInterface): Promise<void> => {
    try {
      // Drop tables in reverse order to respect foreign key constraints
      console.log('Reverting migration: Dropping tables...');
      
      // Drop update_metadata table
      await queryInterface.dropTable('update_metadata');
      console.log('Dropped update_metadata table');
      
      // Drop calendar_mappings table
      await queryInterface.dropTable('calendar_mappings');
      console.log('Dropped calendar_mappings table');
      
      // Drop event_translations table
      await queryInterface.dropTable('event_translations');
      console.log('Dropped event_translations table');
      
      // Drop events table
      await queryInterface.dropTable('events');
      console.log('Dropped events table');
      
      console.log('Revert migration completed successfully');
    } catch (error) {
      console.error('Revert migration failed:', error);
      throw error;
    }
  }
};

export default migration;

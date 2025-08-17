import { Sequelize, QueryInterface, DataTypes } from 'sequelize';
import fs from 'fs';
import path from 'path';

// Interface for migration file
interface Migration {
  up: (queryInterface: QueryInterface, DataTypes: typeof import('sequelize').DataTypes) => Promise<void>;
  down: (queryInterface: QueryInterface, DataTypes: typeof import('sequelize').DataTypes) => Promise<void>;
}

// Create a table to track migrations
async function createMigrationsTable(sequelize: Sequelize): Promise<void> {
  const queryInterface = sequelize.getQueryInterface();
  
  try {
    // Check if the migrations table already exists
    await sequelize.query(`SELECT 1 FROM information_schema.tables WHERE table_name = 'migrations'`);
  } catch (error) {
    // If table doesn't exist, create it
    await queryInterface.createTable('migrations', {
      id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
      },
      name: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true
      },
      executed_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
      }
    });
    
    console.log('Migrations table created.');
  }
}

// Get all migrations that have been executed
async function getExecutedMigrations(sequelize: Sequelize): Promise<string[]> {
  try {
    const [migrations] = await sequelize.query('SELECT name FROM migrations ORDER BY id ASC');
    return (migrations as Array<{ name: string }>).map(migration => migration.name);
  } catch (error) {
    console.error('Error fetching executed migrations:', error);
    return [];
  }
}

// Get all migration files
function getMigrationFiles(): string[] {
  const migrationsDir = __dirname;
  return fs.readdirSync(migrationsDir)
    .filter(file => file.endsWith('.js') || file.endsWith('.ts'))
    .filter(file => file !== 'migrationManager.ts' && file !== 'migrationManager.js' && !file.includes('.map'))
    .sort();
}

// Record a migration as executed
async function recordMigration(sequelize: Sequelize, migrationName: string): Promise<void> {
  await sequelize.query('INSERT INTO migrations (name, executed_at) VALUES (?, current_timestamp)', {
    replacements: [migrationName]
  });
}

// Remove a migration record
async function removeMigration(sequelize: Sequelize, migrationName: string): Promise<void> {
  await sequelize.query('DELETE FROM migrations WHERE name = ?', {
    replacements: [migrationName]
  });
}

// Run migrations
export async function migrate(sequelize: Sequelize): Promise<void> {
  console.log('Starting migrations...');
  
  await createMigrationsTable(sequelize);
  
  const executedMigrations = await getExecutedMigrations(sequelize);
  const migrationFiles = getMigrationFiles();
  
  const pendingMigrations = migrationFiles.filter(file => !executedMigrations.includes(file));
  
  if (pendingMigrations.length === 0) {
    console.log('No pending migrations to execute.');
    return;
  }
  
  console.log(`Found ${pendingMigrations.length} pending migrations.`);
  
  const queryInterface = sequelize.getQueryInterface();
  
  for (const migrationFile of pendingMigrations) {
    console.log(`Running migration: ${migrationFile}`);
    
    try {
      // Import the migration file
      const migration = require(path.join(__dirname, migrationFile)).default as Migration;
      
      // Run the up migration
      await migration.up(queryInterface, DataTypes);
      
      // Record the migration
      await recordMigration(sequelize, migrationFile);
      
      console.log(`Migration ${migrationFile} executed successfully.`);
    } catch (error) {
      console.error(`Error running migration ${migrationFile}:`, error);
      throw error;
    }
  }
  
  console.log('All migrations completed successfully.');
}

// Rollback migrations
export async function rollback(sequelize: Sequelize, steps = 1): Promise<void> {
  console.log(`Rolling back ${steps} migrations...`);
  
  await createMigrationsTable(sequelize);
  
  const executedMigrations = await getExecutedMigrations(sequelize);
  
  if (executedMigrations.length === 0) {
    console.log('No migrations to roll back.');
    return;
  }
  
  const migrationsToRollback = executedMigrations.slice(-steps);
  
  console.log(`Rolling back ${migrationsToRollback.length} migrations.`);
  
  const queryInterface = sequelize.getQueryInterface();
  
  for (const migrationFile of migrationsToRollback.reverse()) {
    console.log(`Rolling back migration: ${migrationFile}`);
    
    try {
      // Import the migration file
      const migration = require(path.join(__dirname, migrationFile)).default as Migration;
      
      // Run the down migration
      await migration.down(queryInterface, DataTypes);
      
      // Remove the migration record
      await removeMigration(sequelize, migrationFile);
      
      console.log(`Migration ${migrationFile} rolled back successfully.`);
    } catch (error) {
      console.error(`Error rolling back migration ${migrationFile}:`, error);
      throw error;
    }
  }
  
  console.log('Rollback completed successfully.');
}

// Export migration functions
export default {
  migrate,
  rollback
};

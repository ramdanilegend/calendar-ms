/**
 * Script to setup the test database with schema
 */
import dotenv from 'dotenv';
import { spawn } from 'child_process';
import { promisify } from 'util';
import { exec } from 'child_process';
import { QueryTypes } from 'sequelize';
import { testSequelize } from '../src/db/models/test-models';
import syncModels from './sync-test-models';

// Load environment variables
dotenv.config();

// Promisify exec
const execPromise = promisify(exec);

/**
 * Verify that database tables exist and have correct structure
 */
async function verifyTables(sequelize: any): Promise<boolean> {
  const tables = ['events', 'event_translations', 'calendar_mappings', 'update_metadata', 'SequelizeMeta'];
  const existingTables: string[] = [];
  
  for (const table of tables) {
    const result = await sequelize.query(
      `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = :tableName)`,
      {
        replacements: { tableName: table },
        type: QueryTypes.SELECT
      }
    ) as Array<{exists: boolean}>;
    
    if (result[0].exists) {
      existingTables.push(table);
    }
  }
  
  console.log('Existing tables:', existingTables);
  return existingTables.length === tables.length;
}

/**
 * Run the migration scripts directly with logging
 */
async function runMigrations(): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const migrateProcess = spawn('npx', ['ts-node', 'scripts/migrate.ts', 'fresh'], {
      stdio: ['inherit', 'pipe', 'pipe'],
      env: process.env
    });
    
    let output = '';
    
    migrateProcess.stdout.on('data', (data) => {
      const message = data.toString();
      output += message;
      console.log(message.trim());
    });
    
    migrateProcess.stderr.on('data', (data) => {
      const message = data.toString();
      output += message;
      console.error(message.trim());
    });
    
    migrateProcess.on('close', (code) => {
      if (code === 0) {
        console.log('Migration completed successfully');
        resolve(true);
      } else {
        console.error(`Migration failed with code ${code}`);
        console.error('Output:', output);
        reject(new Error(`Migration process exited with code ${code}`));
      }
    });
  });
}

/**
 * Setup test database by creating it if it doesn't exist
 * and running migrations
 */
export async function setupTestDatabase(): Promise<boolean> {
  // Save original DB_NAME
  const originalDbName = process.env.DB_NAME;
  
  try {
    // Set database name to test database
    if (process.env.TEST_DB_NAME) {
      process.env.DB_NAME = process.env.TEST_DB_NAME;
    } else if (!process.env.DB_NAME?.includes('test')) {
      process.env.DB_NAME = `${process.env.DB_NAME || 'calendar_ms'}_test`;
    }
    
    console.log(`Setting up test database: ${process.env.DB_NAME}`);
    
    // Test connection
    await testSequelize.authenticate();
    console.log('Test database connection established successfully.');
    
    // Check if tables exist
    const tablesExist = await verifyTables(testSequelize);
    
    if (!tablesExist) {
      console.log('Tables missing, creating migrations table and running migrations...');
      
      // Create migrations table first
      try {
        await execPromise('npx ts-node scripts/create-migrations-table.ts');
        console.log('Migrations table created or already exists.');
      } catch (err) {
        console.error('Error creating migrations table:', err);
      }
      
      // Run migrations with detailed logging
      await runMigrations();
      
      // Verify tables again
      const tablesExistNow = await verifyTables(testSequelize);
      if (!tablesExistNow) {
        console.log('Tables still missing after migration, trying direct model synchronization as fallback...');
        
        // Try to sync models directly as a fallback
        try {
          await syncModels();
          console.log('Direct model synchronization completed successfully');
          
          // Verify again after model sync
          const tablesExistAfterSync = await verifyTables(testSequelize);
          if (!tablesExistAfterSync) {
            console.error('Tables still missing after direct sync!');
            throw new Error('Failed to create database tables after all attempts');
          }
        } catch (syncError) {
          console.error('Error during model synchronization:', syncError);
          throw new Error('Failed to create database tables');
        }
      }
    } else {
      console.log('All required tables exist.');
    }
    
    // Close sequelize connection
    await testSequelize.close();
    
    console.log('Test database setup completed successfully.');
    return true;
  } catch (error) {
    console.error('Test database setup failed:', error);
    if (testSequelize) {
      await testSequelize.close().catch(() => console.error('Error closing connection'));
    }
    throw error;
  } finally {
    // Restore original environment variable
    if (originalDbName) {
      process.env.DB_NAME = originalDbName;
    }
  }
}

// Run the function
setupTestDatabase()
  .then((success) => {
    if (success) {
      console.log('Test database setup completed successfully.');
      process.exit(0);
    } else {
      console.error('Test database setup failed.');
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });

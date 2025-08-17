/**
 * Script to create the test database if it doesn't exist
 */
import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Creates the test database if it doesn't exist
 */
async function createTestDatabase() {
  try {
    console.log('Connecting to PostgreSQL to create test database...');
    
    // Use the default postgres database to connect
    const adminDb = new Sequelize({
      dialect: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      database: 'postgres', // Connect to default postgres database
      username: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || undefined,
      logging: false
    });

    // Try to connect
    await adminDb.authenticate();
    console.log('Connected to PostgreSQL successfully.');

    // Check if test database exists
    const testDbName = process.env.TEST_DB_NAME || 'calendar_ms_test';
    
    try {
      const [results] = await adminDb.query(
        `SELECT 1 FROM pg_database WHERE datname = '${testDbName}'`
      );
      
      // @ts-ignore
      if (results.length === 0) {
        console.log(`Test database "${testDbName}" does not exist. Creating it now...`);
        await adminDb.query(`CREATE DATABASE ${testDbName}`);
        console.log(`Test database "${testDbName}" created successfully.`);
      } else {
        console.log(`Test database "${testDbName}" already exists.`);
      }
    } catch (error) {
      console.error('Error checking or creating database:', error);
      throw error;
    }

    await adminDb.close();
    console.log('Database connection closed.');
    
    // Now connect to the test database to create the migrations table
    const testDb = new Sequelize({
      dialect: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      database: testDbName,
      username: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || undefined,
      logging: console.log
    });
    
    // Create migrations table if it doesn't exist
    try {
      await testDb.query(`
        CREATE TABLE IF NOT EXISTS "SequelizeMeta" (
          "name" VARCHAR(255) NOT NULL PRIMARY KEY
        );
      `);
      console.log('Migrations table created or already exists.');
    } catch (error) {
      console.error('Error creating migrations table:', error);
    }
    
    await testDb.close();
    
    return true;
  } catch (error) {
    console.error('Error creating test database:', error);
    return false;
  }
}

// Run the function
createTestDatabase()
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

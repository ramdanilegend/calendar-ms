/**
 * Dedicated database connection for tests
 */
import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Get test database configuration
const getTestDbConfig = () => {
  // Use TEST_DB_NAME if available, otherwise check if DB_NAME already has _test suffix
  let dbName = process.env.TEST_DB_NAME;
  if (!dbName) {
    dbName = process.env.DB_NAME || 'calendar_ms';
    // Only append _test if it doesn't already end with it
    if (!dbName.endsWith('_test')) {
      dbName = `${dbName}_test`;
    }
  }
  
  return {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: dbName,
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || undefined
  };
};

// Create a dedicated Sequelize instance for tests
const testSequelize = new Sequelize({
  dialect: 'postgres',
  ...getTestDbConfig(),
  logging: false, // Disable logging for tests
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
});

// Test database connection function
export const testConnection = async (): Promise<boolean> => {
  try {
    await testSequelize.authenticate();
    console.log('Test database connection has been established successfully.');
    return true;
  } catch (error) {
    console.error('Unable to connect to the test database:', error);
    return false;
  }
};

// Export test sequelize instance
export default testSequelize;

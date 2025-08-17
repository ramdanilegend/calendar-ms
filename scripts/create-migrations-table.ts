import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Get database connection parameters from environment
const {
  DB_NAME = 'calendar_db',
  DB_USER = 'postgres',
  DB_PASSWORD = 'postgres',
  DB_HOST = 'localhost',
  DB_PORT = '5432'
} = process.env;

// Create Sequelize instance
const sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASSWORD, {
  host: DB_HOST,
  port: parseInt(DB_PORT, 10),
  dialect: 'postgres',
  logging: console.log
});

async function createMigrationsTable() {
  try {
    console.log('Checking connection to database...');
    await sequelize.authenticate();
    console.log('Database connection has been established successfully.');

    // Check if migrations table exists
    const [results] = await sequelize.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'migrations'
      );
    `);
    
    // @ts-ignore
    const tableExists = results[0].exists;
    
    if (tableExists) {
      console.log('Migrations table already exists');
    } else {
      console.log('Creating migrations table...');
      await sequelize.query(`
        CREATE TABLE "migrations" (
          "id" SERIAL PRIMARY KEY,
          "name" VARCHAR(255) NOT NULL UNIQUE,
          "executed_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log('Migrations table created successfully');
    }
  } catch (error) {
    console.error('Unable to connect to the database or create migrations table:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

// Execute the function
createMigrationsTable()
  .then(() => {
    console.log('Process completed');
    process.exit(0);
  })
  .catch(err => {
    console.error('Process failed:', err);
    process.exit(1);
  });

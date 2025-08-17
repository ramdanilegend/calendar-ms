/**
 * Script to synchronize models directly to test database
 * This is a fallback mechanism when migrations don't work correctly
 */
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Import test models and sequelize instance
import { testSequelize, Event, EventTranslation, CalendarMapping, UpdateMetadata } from '../src/db/models/test-models';

// Explicitly export models for usage
export { Event, EventTranslation, CalendarMapping, UpdateMetadata };

async function syncModels(): Promise<void> {
  console.log('Starting test database model synchronization');
  
  try {
    console.log(`Synchronizing models to test database: ${process.env.TEST_DB_NAME || process.env.DB_NAME}`);
    
    // Verify database connection
    await testSequelize.authenticate();
    console.log('Test database connection established successfully.');
    
    // Ensure models are initialized and associations are set
    console.log('Models registered: Event, EventTranslation, CalendarMapping, UpdateMetadata');
    
    // Force sync all models (drops tables if they exist, then recreates)
    console.log('Syncing models to test database schema...');
    await testSequelize.sync({ force: true });
    console.log('Models synchronized successfully!');
    
    // List all tables in the database to verify
    const [tables] = await testSequelize.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;"
    );
    console.log('Tables in test database:', tables);
  } catch (error) {
    console.error('Failed to synchronize test database models:', error);
    process.exit(1);
  }
}

// Run the function if this script is executed directly
if (require.main === module) {
  syncModels()
    .then(() => {
      console.log('Model synchronization completed successfully.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Failed to synchronize models:', error);
      process.exit(1);
    });
}

// Export the function for use in other scripts
export default syncModels;

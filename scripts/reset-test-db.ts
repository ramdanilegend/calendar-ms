/**
 * Script to completely reset the test database
 * This drops all tables including sequences before recreating them
 */
import dotenv from 'dotenv';
import { testSequelize } from '../src/db/models/test-models';
import { QueryTypes } from 'sequelize';

// Load environment variables
dotenv.config();

async function resetTestDatabase(): Promise<void> {
  console.log('Starting test database reset');
  
  try {
    // Verify database connection
    await testSequelize.authenticate();
    console.log('Test database connection established successfully.');
    
    // Define interfaces for the query results
    interface TableResult {
      tablename: string;
    }
    
    interface SequenceResult {
      sequence_name: string;
    }
    
    // Get all tables in the public schema
    const tables = await testSequelize.query<TableResult>(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public';",
      { type: QueryTypes.SELECT }
    );
    
    // Get all sequences in the public schema
    const sequences = await testSequelize.query<SequenceResult>(
      "SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema = 'public';",
      { type: QueryTypes.SELECT }
    );
    
    // Drop all tables (except SequelizeMeta to preserve migration history)
    console.log('Dropping all tables...');
    for (const table of tables) {
      const tableName = table.tablename;
      if (tableName !== 'SequelizeMeta') {
        await testSequelize.query(`DROP TABLE IF EXISTS "${tableName}" CASCADE;`);
        console.log(`Dropped table: ${tableName}`);
      }
    }
    
    // Drop all sequences (they might not be dropped with the tables)
    console.log('Dropping all sequences...');
    for (const sequence of sequences) {
      const sequenceName = sequence.sequence_name;
      if (!sequenceName.includes('SequelizeMeta')) {
        await testSequelize.query(`DROP SEQUENCE IF EXISTS "${sequenceName}" CASCADE;`);
        console.log(`Dropped sequence: ${sequenceName}`);
      }
    }
    
    console.log('Database reset completed successfully.');
  } catch (error) {
    console.error('Failed to reset test database:', error);
    process.exit(1);
  }
}

// Run the function if this script is executed directly
if (require.main === module) {
  resetTestDatabase()
    .then(() => {
      console.log('Test database reset completed.');
      testSequelize.close();
      process.exit(0);
    })
    .catch((error) => {
      console.error('Failed to reset test database:', error);
      process.exit(1);
    });
}

// Export the function for use in other scripts
export default resetTestDatabase;

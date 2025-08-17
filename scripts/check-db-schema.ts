/**
 * Script to check database schema
 */
import { testSequelize } from '../src/db/models/test-models';
import { QueryTypes } from 'sequelize';

async function checkSchema(): Promise<void> {
  try {
    // Test connection
    await testSequelize.authenticate();
    console.log('Test database connection established successfully.');
    
    // Get all tables
    const [tables] = await testSequelize.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;",
      { type: QueryTypes.SELECT }
    );
    console.log('Tables in test database:', tables);
    
    // Check events table structure
    const [eventColumns] = await testSequelize.query(
      `SELECT column_name, data_type, is_nullable, column_default
       FROM information_schema.columns 
       WHERE table_name = 'events'
       ORDER BY ordinal_position;`,
       { type: QueryTypes.SELECT }
    );
    console.log('\nEvents table structure:');
    console.log(eventColumns);
    
    // Check constraints on events table
    const [eventConstraints] = await testSequelize.query(
      `SELECT conname, pg_get_constraintdef(c.oid)
       FROM pg_constraint c
       JOIN pg_namespace n ON n.oid = c.connamespace
       WHERE conrelid = 'events'::regclass
       AND n.nspname = 'public';`,
       { type: QueryTypes.SELECT }
    );
    console.log('\nEvents table constraints:');
    console.log(eventConstraints);
  } catch (error) {
    console.error('Error checking schema:', error);
  } finally {
    await testSequelize.close();
  }
}

checkSchema()
  .then(() => {
    console.log('Schema check completed.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Schema check failed:', error);
    process.exit(1);
  });

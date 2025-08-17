import { testSequelize } from '../models/test-models';
import { describe, it, expect } from '@jest/globals';

/**
 * Checks if a table exists in the database
 */
const tableExists = async (tableName: string): Promise<boolean> => {
  try {
    const result = await testSequelize.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = :tableName
      );`,
      {
        replacements: { tableName },
        type: 'SELECT',
        plain: true
      }
    );
    
    // With plain:true, we get a single object with the result
    if (result && typeof result === 'object' && 'exists' in result) {
      const exists = (result as { exists: boolean }).exists;
      if (!exists) {
        console.log(`Table ${tableName} does not exist in database`);
      }
      return exists;
    }
    
    console.log(`Could not verify if table ${tableName} exists, assuming it does not`);
    return false;
  } catch (error) {
    console.error(`Error checking if table ${tableName} exists:`, error);
    return false; // Assume table doesn't exist if there was an error
  }
};

/**
 * Helper function to clean test tables with proper error handling
 * Only attempts to truncate tables that actually exist in the database
 */
export const cleanupTestTables = async (): Promise<void> => {
  try {
    // Check which tables exist before attempting to truncate them
    const tables = ['event_translations', 'calendar_mappings', 'events', 'update_metadata'];
    const existingTables: string[] = [];
    
    for (const table of tables) {
      if (await tableExists(table)) {
        existingTables.push(table);
      }
    }
    
    if (existingTables.length === 0) {
      console.log('No tables to clean up - they may not exist yet');
      return;
    }
    
    const transaction = await testSequelize.transaction();
    
    try {
      // Set session_replication_role to bypass foreign key constraints temporarily
      await testSequelize.query("SET session_replication_role = 'replica'", { transaction });
      
      // Only truncate tables that exist
      for (const table of existingTables) {
        await testSequelize.query(`TRUNCATE TABLE "${table}" CASCADE`, { transaction });
        console.log(`Truncated table ${table}`);
      }
      
      // Reset session_replication_role
      await testSequelize.query("SET session_replication_role = 'origin'", { transaction });
      
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      console.error('Error during test cleanup transaction:', error);
      // Don't throw here, just log the error
    }
  } catch (error) {
    console.error('Error in cleanupTestTables function:', error);
    // Don't throw here, just log the error
  }
};

// Add a dummy test so Jest doesn't complain when running this file directly
describe('Database Test Helpers', () => {
  it('should have working helper functions', () => {
    expect(typeof cleanupTestTables).toBe('function');
  });
});

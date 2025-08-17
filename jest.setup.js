// Load dotenv to ensure any .env variables are loaded first
require('dotenv').config();

// Set test environment variables for database
// Use the values from .env if available, otherwise fallback to defaults
process.env.DB_HOST = process.env.TEST_DB_HOST || process.env.DB_HOST || 'localhost';
process.env.DB_PORT = process.env.TEST_DB_PORT || process.env.DB_PORT || '5432';
process.env.DB_NAME = process.env.TEST_DB_NAME || 'calendar_ms_test';
process.env.DB_USER = process.env.TEST_DB_USER || process.env.DB_USER || 'postgres';

// Critical: Use the password from .env or null string (not empty string)
// An empty string causes the SASL error with SCRAM authentication
process.env.DB_PASSWORD = process.env.TEST_DB_PASSWORD || process.env.DB_PASSWORD || null;
process.env.NODE_ENV = 'test';

// Set up global test hooks for Sequelize
const { spawn } = require('child_process');
const testSequelize = require('./src/db/test-connection').default;
const syncTestModels = require('./src/db/models/test-models').default;
const path = require('path');

// Helper function to run TypeScript scripts using ts-node
async function runTsScript(scriptPath) {
  return new Promise((resolve, reject) => {
    console.log(`Running script: ${scriptPath}`);
    const child = spawn('npx', ['ts-node', scriptPath], {
      stdio: 'inherit',
      shell: true
    });

    child.on('close', code => {
      if (code === 0) {
        console.log(`✅ Script ${scriptPath} completed successfully`);
        resolve();
      } else {
        console.error(`❌ Script ${scriptPath} failed with code ${code}`);
        reject(new Error(`Script ${scriptPath} failed with code ${code}`));
      }
    });

    child.on('error', err => {
      console.error(`❌ Failed to run script ${scriptPath}:`, err);
      reject(err);
    });
  });
};

// Helper function to run a query with retries
async function runQuery(sequelize, query, options = {}, retries = 3) {
  const { type, ...otherOptions } = options;
  const retryDelay = 500; // ms
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const result = await sequelize.query(query, { type, ...otherOptions });
      return result;
    } catch (error) {
      const isLastAttempt = attempt === retries;
      const isConnectionError = [
        'Connection terminated',
        'terminating connection',
        'ECONNREFUSED',
        'connection reset by peer'
      ].some(errMsg => error.message && error.message.includes(errMsg));
      
      if (isConnectionError && !isLastAttempt) {
        console.warn(`⚠️ Query attempt ${attempt} failed with connection error, retrying in ${retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      } else {
        if (isLastAttempt) {
          console.error(`❌ Query failed after ${retries} attempts: ${query.substring(0, 100)}...`, error);
        }
        throw error;
      }
    }
  }
}

// Function to establish a new connection if needed
async function ensureConnection(sequelize) {
  try {
    await sequelize.authenticate();
    return true;
  } catch (error) {
    console.warn('⚠️ Connection error detected, attempting to reconnect...');
    
    // Force a new connection to be established
    try {
      await sequelize.connectionManager.initPools();
      if (sequelize.connectionManager.hasOwnProperty('getConnection')) {
        await sequelize.connectionManager.getConnection({ type: 'write' });
      }
      console.log('✅ Successfully reconnected to database');
      return true;
    } catch (reconnectError) {
      console.error('❌ Failed to reconnect to database:', reconnectError.message);
      return false;
    }
  }
}

// Helper function to query the database and log results
async function queryDatabase(query, message) {
  try {
    const { testSequelize } = require('./src/db/models/test-models');
    const result = await testSequelize.query(query, { type: testSequelize.QueryTypes.SELECT });
    console.log(message, result);
    return result;
  } catch (error) {
    console.error(`Failed to execute query: ${query}`, error);
    return null;
  }
};

// Set up global test environment
beforeAll(async () => {
  try {
    // Import test models and connection
    const { testSequelize } = require('./src/db/models/test-models');
    
    console.log('🔄 Starting database setup for tests...');
    
    // Ensure we have a valid connection before proceeding
    await ensureConnection(testSequelize);
    
    // Check if there are active connections and terminate them
    try {
      await runQuery(testSequelize, `
        SELECT pg_terminate_backend(pg_stat_activity.pid)
        FROM pg_stat_activity
        WHERE pg_stat_activity.datname = current_database()
        AND pid <> pg_backend_pid();
      `);
      console.log('✅ Terminated active connections to ensure clean setup');
    } catch (err) {
      console.warn('⚠️ Warning when terminating connections:', err.message);
      // Re-establish connection if needed
      await ensureConnection(testSequelize);
    }
    
    // Drop all tables and sequences in multiple steps with verification
    try {
      console.log('🔄 Dropping all tables and sequences...');
      
      // First check what tables exist
      const tablesResult = await runQuery(testSequelize, 
        "SELECT tablename FROM pg_tables WHERE schemaname = 'public';", 
        { type: testSequelize.QueryTypes.SELECT }
      );
      const existingTables = tablesResult.map(t => t.tablename);
      console.log(`🔎 Tables in database before reset: ${JSON.stringify(existingTables)}`);
      
      // Drop each table individually with robust error handling
      for (const table of existingTables) {
        try {
          await runQuery(testSequelize, `DROP TABLE IF EXISTS "${table}" CASCADE;`);
          console.log(`✅ Dropped table: ${table}`);
        } catch (dropError) {
          console.warn(`⚠️ Warning when dropping table ${table}: ${dropError.message}`);
        }
        await ensureConnection(testSequelize);
      }
      
      // Get list of all sequences
      const sequencesResult = await runQuery(testSequelize, 
        "SELECT relname FROM pg_class WHERE relkind = 'S' AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');", 
        { type: testSequelize.QueryTypes.SELECT }
      );
      const existingSequences = sequencesResult.map(s => s.relname);
      console.log(`🔎 Sequences before reset: ${JSON.stringify(existingSequences)}`);
      
      // Drop each sequence individually
      for (const sequence of existingSequences) {
        try {
          await runQuery(testSequelize, `DROP SEQUENCE IF EXISTS "${sequence}" CASCADE;`);
          console.log(`✅ Dropped sequence: ${sequence}`);
        } catch (dropError) {
          console.warn(`⚠️ Warning when dropping sequence ${sequence}: ${dropError.message}`);
        }
        await ensureConnection(testSequelize);
      }
      
      // Verify all tables are gone
      const verifyTablesResult = await runQuery(testSequelize, 
        "SELECT tablename FROM pg_tables WHERE schemaname = 'public';", 
        { type: testSequelize.QueryTypes.SELECT }
      );
      if (verifyTablesResult.length > 0) {
        console.warn(`⚠️ Warning: ${verifyTablesResult.length} tables still exist after drop commands:`, 
          verifyTablesResult.map(t => t.tablename));
        
        // Force drop with more aggressive approach if needed
        const remainingTables = verifyTablesResult.map(t => t.tablename);
        for (const table of remainingTables) {
          try {
            // Try with FORCE and CASCADE
            await runQuery(testSequelize, `DROP TABLE "${table}" CASCADE;`);
            console.log(`🔥 Forcefully dropped persistent table: ${table}`);
          } catch (forceError) {
            console.error(`❌ Could not drop table ${table} even with force: ${forceError.message}`);
          }
          await ensureConnection(testSequelize);
        }
      }
      
      console.log('✅ Database reset complete');
    } catch (err) {
      console.error(`❌ Error in database reset process: ${err.message}`);
      // Continue despite errors, as we will try to create the tables anyway
      await ensureConnection(testSequelize);
    }
    
    // Create tables with explicit ID column management instead of SERIAL
    // Add IF NOT EXISTS to make it more resilient
    const createTablesQueries = [
      // Events table
      `CREATE TABLE IF NOT EXISTS "events" (
        "id" INTEGER PRIMARY KEY,
        "event_id" VARCHAR(255) NOT NULL,
        "region" VARCHAR(255) NOT NULL,
        "calendar_type" VARCHAR(255) NOT NULL,
        "start_date" TIMESTAMP WITH TIME ZONE NOT NULL,
        "end_date" TIMESTAMP WITH TIME ZONE NOT NULL,
        "is_all_day" BOOLEAN NOT NULL DEFAULT false,
        "status" VARCHAR(255) NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )`,
      
      // Event Translations table
      `CREATE TABLE IF NOT EXISTS "event_translations" (
        "id" INTEGER PRIMARY KEY,
        "event_id" VARCHAR(255) NOT NULL,
        "language" VARCHAR(255) NOT NULL,
        "title" TEXT NOT NULL,
        "description" TEXT,
        "location" VARCHAR(255),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )`,
      
      // Calendar Mappings table
      `CREATE TABLE IF NOT EXISTS "calendar_mappings" (
        "id" INTEGER PRIMARY KEY,
        "event_id" VARCHAR(255) NOT NULL,
        "region" VARCHAR(255) NOT NULL,
        "original_date" TIMESTAMP WITH TIME ZONE NOT NULL,
        "gregorian_date" TIMESTAMP WITH TIME ZONE NOT NULL,
        "hijri_date" TIMESTAMP WITH TIME ZONE,
        "indonesian_date" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )`,
      
      // Update Metadata table
      `CREATE TABLE IF NOT EXISTS "update_metadata" (
        "id" INTEGER PRIMARY KEY,
        "source" VARCHAR(255) NOT NULL,
        "region" VARCHAR(255) NOT NULL,
        "last_successful_update" TIMESTAMP WITH TIME ZONE NOT NULL,
        "status" VARCHAR(255) NOT NULL,
        "error_details" TEXT,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )`
    ];
    
    // Create sequences first
    const createSequencesQueries = [
      `CREATE SEQUENCE IF NOT EXISTS "events_id_seq" START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1`,
      `CREATE SEQUENCE IF NOT EXISTS "event_translations_id_seq" START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1`,
      `CREATE SEQUENCE IF NOT EXISTS "calendar_mappings_id_seq" START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1`,
      `CREATE SEQUENCE IF NOT EXISTS "update_metadata_id_seq" START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1`
    ];
    
    // Create sequences with retry
    for (const query of createSequencesQueries) {
      try {
        await runQuery(testSequelize, query);
        console.log(`✅ Created sequence: ${query}`);
      } catch (err) {
        // For sequence creation, we can safely ignore validation errors as they typically indicate
        // the sequence already exists (even if the IF NOT EXISTS clause doesn't catch it)
        if (err.name === 'SequelizeValidationError' || err.message.includes('already exists')) {
          console.log(`ℹ️ Sequence already exists: ${query.split(' ')[3].replace(/"/g, '')}`);
        } else {
          console.warn(`⚠️ Warning when creating sequence: ${err.message}`);
        }
        // Keep going, as these are IF NOT EXISTS queries
      }
      // Ensure connection is still alive
      await ensureConnection(testSequelize);
    }
    
    // Create tables with retry
    for (const query of createTablesQueries) {
      try {
        await runQuery(testSequelize, query);
        console.log(`✅ Created table: ${query.split('\n')[0]}...`);
      } catch (err) {
        // If the error is because the table already exists, that's fine
        if (err.message.includes('already exists')) {
          const tableName = query.match(/CREATE TABLE IF NOT EXISTS "([^"]*)"/);
          if (tableName && tableName[1]) {
            console.log(`ℹ️ Table ${tableName[1]} already exists, skipping creation`);
          } else {
            console.warn(`⚠️ Table creation warning: ${err.message}`);
          }
        } else {
          console.error(`❌ Error creating table: ${err.message}`);
          throw err;
        }
      }
      // Ensure connection is still alive
      await ensureConnection(testSequelize);
    }
    
    // Set sequence ownership
    const setSequenceOwnershipQueries = [
      `ALTER SEQUENCE "events_id_seq" OWNED BY "events"."id"`,
      `ALTER SEQUENCE "event_translations_id_seq" OWNED BY "event_translations"."id"`,
      `ALTER SEQUENCE "calendar_mappings_id_seq" OWNED BY "calendar_mappings"."id"`,
      `ALTER SEQUENCE "update_metadata_id_seq" OWNED BY "update_metadata"."id"`
    ];
    
    // Set sequence ownership with retry
    for (const query of setSequenceOwnershipQueries) {
      try {
        await runQuery(testSequelize, query);
        console.log(`✅ Set sequence ownership: ${query}`);
      } catch (err) {
        console.warn(`⚠️ Warning when setting sequence ownership: ${err.message}`);
      }
      // Ensure connection is still alive
      await ensureConnection(testSequelize);
    }
    
    // Set default values for id columns
    const setDefaultsQueries = [
      `ALTER TABLE "events" ALTER COLUMN "id" SET DEFAULT nextval('events_id_seq')`,
      `ALTER TABLE "event_translations" ALTER COLUMN "id" SET DEFAULT nextval('event_translations_id_seq')`,
      `ALTER TABLE "calendar_mappings" ALTER COLUMN "id" SET DEFAULT nextval('calendar_mappings_id_seq')`,
      `ALTER TABLE "update_metadata" ALTER COLUMN "id" SET DEFAULT nextval('update_metadata_id_seq')`
    ];
    
    // Set default values with retry
    for (const query of setDefaultsQueries) {
      try {
        await runQuery(testSequelize, query);
        console.log(`✅ Set default value: ${query}`);
      } catch (err) {
        console.warn(`⚠️ Warning when setting default value: ${err.message}`);
      }
      // Ensure connection is still alive
      await ensureConnection(testSequelize);
    }
    
    // Create indexes after tables are created
    const createIndexQueries = [
      // Events indexes
      `CREATE UNIQUE INDEX IF NOT EXISTS "events_event_id_region_calendar_type" ON "events" ("event_id", "region", "calendar_type")`,
      
      // Event Translations indexes
      `CREATE UNIQUE INDEX IF NOT EXISTS "event_translations_event_id_language" ON "event_translations" ("event_id", "language")`,
      
      // Calendar Mappings indexes
      `CREATE UNIQUE INDEX IF NOT EXISTS "calendar_mappings_event_id_region_original_date" ON "calendar_mappings" ("event_id", "region", "original_date")`,
      
      // Update Metadata indexes
      `CREATE UNIQUE INDEX IF NOT EXISTS "update_metadata_source_region" ON "update_metadata" ("source", "region")`
    ];
    
    // Create indexes with retry
    for (const query of createIndexQueries) {
      try {
        await runQuery(testSequelize, query);
        console.log(`✅ Created index: ${query}`);
      } catch (err) {
        console.warn(`⚠️ Warning when creating index: ${err.message}`);
      }
      // Ensure connection is still alive
      await ensureConnection(testSequelize);
    }
    
    // Check tables in database after creation
    try {
      const tables = await runQuery(testSequelize,
        "SELECT tablename FROM pg_tables WHERE schemaname = 'public';",
        { type: testSequelize.QueryTypes.SELECT }
      );
      console.log('🔎 Tables in test database:', tables);
    } catch (err) {
      console.warn('⚠️ Warning when checking tables:', err.message);
      await ensureConnection(testSequelize);
    }
    
    // Re-initialize Sequelize models to work with our manually created tables
    let Event, EventTranslation, CalendarMapping, UpdateMetadata;
    
    try {
      // Import fresh to ensure we have latest connection
      const models = require('./src/db/models/test-models');
      Event = models.Event;
      EventTranslation = models.EventTranslation;
      CalendarMapping = models.CalendarMapping;
      UpdateMetadata = models.UpdateMetadata;
      
      // Associate Sequelize models with existing tables without modifying them
      // Do these one by one to better handle failures
      await Event.sync({ alter: false, force: false });
      console.log('✅ Event model synchronized');
      await ensureConnection(testSequelize);
      
      await EventTranslation.sync({ alter: false, force: false });
      console.log('✅ EventTranslation model synchronized');
      await ensureConnection(testSequelize);
      
      await CalendarMapping.sync({ alter: false, force: false });
      console.log('✅ CalendarMapping model synchronized');
      await ensureConnection(testSequelize);
      
      await UpdateMetadata.sync({ alter: false, force: false });
      console.log('✅ UpdateMetadata model synchronized');
      
      console.log('✅ All Sequelize models synchronized with existing tables');
    } catch (err) {
      console.error('❌ Error synchronizing models:', err.message);
      throw err;
    }
  } catch (error) {
    console.error('❌ Test database setup failed:', error);
    throw error;
  }
}, 90000); // 90 second timeout for the complete setup process

// Close all connections after all tests
afterAll(async () => {
  console.log('\n🔄 Closing database connections...');
  try {
    // Force close all connections
    await runQuery(testSequelize, `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE pid <> pg_backend_pid()`);
    
    // Close the Sequelize connection
    await testSequelize.close();
    
    // Set a timeout to ensure Node has time to clean up any remaining connections
    await new Promise(resolve => setTimeout(resolve, 500));
    
    console.log('✅ Database connections closed');
  } catch (error) {
    console.error('❌ Error closing database connection:', error.message);
  }
});

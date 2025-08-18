#!/usr/bin/env node

const { Client } = require('pg');

const maxRetries = 30;
const retryDelay = 2000; // 2 seconds

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'calendar_ms',
  user: process.env.DB_USER || 'calendar_user',
  password: process.env.DB_PASSWORD
};

async function waitForDatabase() {
  console.log('🔄 Waiting for database connection...');
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      const client = new Client(dbConfig);
      await client.connect();
      await client.query('SELECT 1');
      await client.end();
      
      console.log('✅ Database is ready!');
      process.exit(0);
    } catch (error) {
      console.log(`❌ Database connection attempt ${i + 1}/${maxRetries} failed:`, error.message);
      
      if (i === maxRetries - 1) {
        console.error('💥 Failed to connect to database after maximum retries');
        process.exit(1);
      }
      
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }
}

waitForDatabase();

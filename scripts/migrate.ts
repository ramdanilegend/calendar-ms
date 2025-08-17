#!/usr/bin/env ts-node

import { migrate, rollback } from '../src/db/migrations/migrationManager';
import sequelize from '../src/db/index';

async function main() {
  const command = process.argv[2];

  try {
    switch (command) {
      case 'up':
        await migrate(sequelize);
        break;
      case 'down':
        const steps = process.argv[3] ? parseInt(process.argv[3], 10) : 1;
        await rollback(sequelize, steps);
        break;
      case 'fresh':
        // Drop all tables and re-run all migrations
        await sequelize.drop();
        await migrate(sequelize);
        break;
      default:
        console.log('Invalid command. Use: up, down [steps], or fresh');
        process.exit(1);
    }

    console.log('Migration command completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

main();

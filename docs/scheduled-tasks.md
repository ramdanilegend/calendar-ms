# Scheduled Tasks and Scripts Documentation

This document describes the scheduled tasks and scripts system implemented for the Calendar Microservice, providing automated calendar data fetching and mapping updates.

## Overview

The system includes:
- **Annual Google Calendar Fetch**: Automatically fetches calendar events from Google Calendar APIs
- **Calendar Mapping Updates**: Updates calendar mappings from Kementerian Agama and other sources
- **Scheduling System**: Uses node-cron for automated task execution
- **Manual Execution**: Command-line interfaces for manual script execution

## Architecture

```
src/
├── services/
│   └── scheduler.ts           # Main scheduler service
├── types/
│   └── scriptTypes.ts         # TypeScript interfaces
scripts/
├── fetchCalendar.ts           # Annual calendar fetch script
└── updateMappings.ts          # Mapping update script
```

## Scripts

### 1. Calendar Fetch Script (`scripts/fetchCalendar.ts`)

Fetches annual calendar events from Google Calendar APIs and stores them in the database.

#### Usage

```bash
# Fetch current year data
npm run fetch-calendar

# Fetch specific year
npm run fetch-calendar -- --year 2024

# Fetch specific regions
npm run fetch-calendar -- --regions ID,US,SA

# Dry run (simulation mode)
npm run fetch-calendar -- --dry-run

# Force overwrite existing data
npm run fetch-calendar -- --force

# Verbose logging
npm run fetch-calendar -- --verbose
```

#### Options

| Option | Description | Default |
|--------|-------------|---------|
| `-y, --year <year>` | Year to fetch | Current year |
| `-r, --regions <regions>` | Comma-separated regions | ID,US,SA |
| `-d, --dry-run` | Simulation mode | false |
| `-f, --force` | Overwrite existing data | false |
| `-v, --verbose` | Enable debug logging | false |

#### Features

- **Transaction Support**: Uses database transactions for atomic operations
- **Retry Logic**: Automatic retry with exponential backoff
- **Error Handling**: Comprehensive error handling and logging
- **Duplicate Prevention**: Checks for existing data before fetching
- **Progress Tracking**: Detailed logging of progress and results

### 2. Mapping Update Script (`scripts/updateMappings.ts`)

Updates calendar mappings for different calendar systems (Gregorian, Hijri, Indonesian).

#### Usage

```bash
# Update mappings from Kementerian Agama
npm run update-mappings

# Update specific year
npm run update-mappings -- --year 2024

# Update specific regions
npm run update-mappings -- --regions ID

# Use custom mapping source
npm run update-mappings -- --source custom

# Set batch size
npm run update-mappings -- --batch-size 50

# Dry run
npm run update-mappings -- --dry-run

# Force update existing mappings
npm run update-mappings -- --force
```

#### Options

| Option | Description | Default |
|--------|-------------|---------|
| `-s, --source <source>` | Mapping source (kementerian_agama\|custom) | kementerian_agama |
| `-y, --year <year>` | Year to update | Current year |
| `-r, --regions <regions>` | Comma-separated regions | ID |
| `-b, --batch-size <size>` | Batch processing size | 100 |
| `-d, --dry-run` | Simulation mode | false |
| `-f, --force` | Force update existing mappings | false |
| `-v, --verbose` | Enable debug logging | false |

#### Features

- **Batch Processing**: Processes mappings in configurable batches
- **Conflict Resolution**: Handles existing mapping conflicts
- **Multiple Sources**: Supports different mapping data sources
- **Atomic Updates**: Database transactions ensure data consistency

## Scheduler Service

The scheduler service (`src/services/scheduler.ts`) manages automated execution of scripts using cron expressions.

### Default Schedule

| Job | Schedule | Description |
|-----|----------|-------------|
| `fetchCalendar` | `0 2 1 1 *` | 2 AM on January 1st (annually) |
| `updateMappings` | `0 3 1 * *` | 3 AM on 1st day of each month |

### Manual Job Management

```bash
# Check job status
npm run schedule:status

# In your application code:
import { scheduler } from './server';

// Trigger job manually
await scheduler.triggerJob('fetchCalendar');

// Get job status
const status = scheduler.getJobStatus('fetchCalendar');

// Stop/start jobs
scheduler.stopJob('fetchCalendar');
scheduler.startJob('fetchCalendar');
```

## Configuration

### Scheduler Configuration

The scheduler accepts configuration through the `ScheduledJobConfig` interface:

```typescript
const schedulerConfig = {
  jobs: {
    fetchCalendar: {
      schedule: '0 2 1 1 *',    // Cron expression
      enabled: true,            // Enable/disable job
      retryAttempts: 3,         // Retry attempts on failure
      timeout: 900000,          // Timeout in milliseconds
      year: 2024,               // Specific year to fetch
      regions: ['ID', 'US', 'SA'],
      calendarTypes: ['gregorian', 'hijri', 'indonesian']
    },
    updateMappings: {
      schedule: '0 3 1 * *',
      enabled: true,
      retryAttempts: 3,
      timeout: 600000,
      source: 'kementerian_agama',
      targetRegions: ['ID'],
      batchSize: 100
    }
  },
  globalSettings: {
    timezone: 'Asia/Jakarta',
    logLevel: 'info',
    maxConcurrentJobs: 2
  }
};
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `LOG_LEVEL` | Logging level (debug\|info\|warn\|error) | info |
| `GOOGLE_SERVICE_ACCOUNT_PATH` | Path to Google service account JSON | - |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | Google service account JSON string | - |

## Logging

All scripts generate comprehensive logs stored in the `logs/` directory:

- `logs/fetch-calendar.log` - Calendar fetch script logs
- `logs/update-mappings.log` - Mapping update script logs
- `logs/scheduler.log` - Scheduler service logs

### Log Levels

- **DEBUG**: Detailed execution information
- **INFO**: General information and progress updates
- **WARN**: Warning conditions that don't prevent execution
- **ERROR**: Error conditions that cause script failure

## Error Handling

### Retry Logic

Scripts implement exponential backoff retry logic:
- Initial delay: 1 second
- Backoff multiplier: 2x
- Maximum attempts: 3 (configurable)
- Maximum delay: 60 seconds

### Transaction Support

Database operations use transactions to ensure atomicity:
- All-or-nothing updates
- Automatic rollback on errors
- Consistent data state

### Notification System

Failed jobs can trigger notifications through configured channels:
- **Log notifications**: Write to log files
- **Email notifications**: Send failure alerts (extensible)
- **Webhook notifications**: HTTP callbacks (extensible)

## Monitoring and Troubleshooting

### Check Script Status

```bash
# View recent logs
tail -f logs/fetch-calendar.log
tail -f logs/update-mappings.log
tail -f logs/scheduler.log

# Check job execution history
npm run schedule:status
```

### Common Issues

#### 1. Google API Authentication Errors

```bash
# Check environment variables
echo $GOOGLE_SERVICE_ACCOUNT_PATH
echo $GOOGLE_SERVICE_ACCOUNT_KEY

# Verify service account permissions
npm run fetch-calendar -- --dry-run --verbose
```

#### 2. Database Connection Errors

```bash
# Test database connection
npm run test:db-connection

# Check database credentials in .env
cat .env
```

#### 3. Cron Schedule Issues

- Verify cron expressions using online validators
- Check timezone settings in scheduler configuration
- Review scheduler logs for initialization errors

### Performance Optimization

#### Batch Size Tuning

Adjust batch sizes based on system resources:
- Smaller batches: Lower memory usage, slower processing
- Larger batches: Higher memory usage, faster processing

```bash
# Test different batch sizes
npm run update-mappings -- --batch-size 50 --dry-run
npm run update-mappings -- --batch-size 200 --dry-run
```

#### Timeout Configuration

Set appropriate timeouts based on data volume:
- Calendar fetch: 15 minutes (900,000ms) for annual data
- Mapping updates: 10 minutes (600,000ms) for monthly updates

## Integration

### Server Integration

The scheduler is automatically initialized when the server starts:

```typescript
// server.ts
import SchedulerService from './src/services/scheduler';

const scheduler = new SchedulerService();
await scheduler.initialize(); // Starts all enabled jobs
```

### Custom Script Integration

To add new scheduled scripts:

1. Create script in `scripts/` directory
2. Implement required interfaces from `scriptTypes.ts`
3. Add job configuration to `SchedulerService`
4. Update package.json scripts section

## Security Considerations

- Store Google API credentials securely (environment variables)
- Use least-privilege database credentials
- Implement proper error handling to avoid information leakage
- Regular security updates for dependencies
- Monitor script execution logs for unusual activity

## Maintenance

### Regular Tasks

- Monitor disk space for log files (auto-rotation configured)
- Review job execution results monthly
- Update Google API credentials before expiration
- Test scripts in staging before production deployment

### Backup Considerations

- Database backups before major mapping updates
- Configuration backups for scheduler settings
- Log file archival for audit trails

import app from './src/app';
import config from './src/config/config';
import SchedulerService from './src/services/scheduler';

// Initialize scheduler service
const scheduler = new SchedulerService();

// Start the server
const PORT = config.server.port;
const server = app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT} in ${config.server.nodeEnv} mode`);
  
  // Initialize scheduled jobs
  try {
    await scheduler.initialize();
    console.log('Scheduler service initialized successfully');
  } catch (error: any) {
    console.error('Failed to initialize scheduler service:', error.message);
  }
});

// Graceful shutdown handling
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await scheduler.shutdown();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  await scheduler.shutdown();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

export default app;
export { scheduler };

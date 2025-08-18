import express, { Request, Response, NextFunction, Application } from 'express';
import { requestLogger, errorLogger } from './api/middleware/logging';
import routes from './api/routes';

// Create Express application
const app: Application = express();

// Parse JSON bodies
app.use(express.json());

// Parse URL-encoded bodies
app.use(express.urlencoded({ extended: true }));

// Add request logging middleware
app.use(requestLogger);

// Add routes
app.use('/api/v1', routes);

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  errorLogger(err, req, res, next);
  res.status(500).json({
    status: 'error',
    message: err.message || 'Internal Server Error',
  });
});

export default app;

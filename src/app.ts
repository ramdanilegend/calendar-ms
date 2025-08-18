import express, { Request, Response, NextFunction, Application } from 'express';
import { requestLogger, errorLogger } from './api/middleware/logging';
import routes from './api/routes';
import { setupSwagger, addDocumentationLinks } from './config/swagger';

// Create Express application
const app: Application = express();

// Parse JSON bodies
app.use(express.json());

// Parse URL-encoded bodies
app.use(express.urlencoded({ extended: true }));

// Add documentation links to responses
app.use(addDocumentationLinks);

// Add request logging middleware
app.use(requestLogger);

// Set up API documentation
setupSwagger(app);

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

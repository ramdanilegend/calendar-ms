import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Application, Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import yaml from 'js-yaml';

const swaggerOptions: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'Calendar Microservice API',
      description: `
        A comprehensive calendar microservice API that fetches data from Google Calendar 
        and serves localized event data with support for Gregorian, Hijri, and Indonesian calendars.
        
        ## Features
        - Multi-calendar support (Gregorian, Hijri, Indonesian)
        - Multi-language translations  
        - Regional calendar mappings
        - Admin authentication and authorization
        - Comprehensive caching system
        - Real-time synchronization with Google Calendar
      `,
      version: '1.0.0',
      contact: {
        name: 'Calendar MS Team',
        email: 'support@calendar-ms.com'
      },
      license: {
        name: 'ISC'
      }
    },
    servers: [
      {
        url: process.env.NODE_ENV === 'production' 
          ? 'https://api.calendar-ms.com/api/v1'
          : 'http://localhost:3000/api/v1',
        description: process.env.NODE_ENV === 'production' ? 'Production server' : 'Development server'
      }
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token obtained from authentication'
        }
      }
    }
  },
  apis: [
    './src/api/routes/*.ts',
    './src/api/handlers/*.ts',
    './docs/api-spec.yaml'
  ]
};

/**
 * Set up Swagger documentation for the Express app
 */
export function setupSwagger(app: Application): void {
  try {
    // Try to load the YAML spec file if it exists
    const yamlSpecPath = path.join(__dirname, '../../docs/api-spec.yaml');
    let specs;
    
    if (fs.existsSync(yamlSpecPath)) {
      const yamlContent = fs.readFileSync(yamlSpecPath, 'utf8');
      specs = yaml.load(yamlContent) as object;
      console.log('✅ Loaded OpenAPI spec from YAML file');
    } else {
      // Fallback to JSDoc generation
      specs = swaggerJsdoc(swaggerOptions);
      console.log('✅ Generated OpenAPI spec from JSDoc comments');
    }

    // Swagger UI options
    const swaggerUiOptions: swaggerUi.SwaggerUiOptions = {
      customCss: `
        .swagger-ui .topbar { display: none; }
        .swagger-ui .info .title { color: #2c3e50; }
        .swagger-ui .scheme-container { background: #f8f9fa; border-radius: 4px; }
      `,
      customSiteTitle: 'Calendar MS API Documentation',
      customfavIcon: '/favicon.ico',
      swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
        filter: true,
        showExtensions: true,
        showCommonExtensions: true,
        docExpansion: 'list',
        defaultModelsExpandDepth: 2,
        defaultModelExpandDepth: 2
      }
    };

    // Set up the documentation routes
    app.use('/api-docs', swaggerUi.serve);
    app.get('/api-docs', swaggerUi.setup(specs, swaggerUiOptions));
    
    // Alternative route for just the JSON spec
    app.get('/api-docs.json', (_req: Request, res: Response) => {
      res.setHeader('Content-Type', 'application/json');
      res.send(specs);
    });

    // Health check specifically for documentation
    app.get('/api-docs/health', (_req: Request, res: Response) => {
      res.json({
        status: 'ok',
        documentation: 'available',
        timestamp: new Date().toISOString(),
        spec_version: (specs as any)?.info?.version || '1.0.0'
      });
    });

    console.log('📚 Swagger UI documentation available at /api-docs');
    console.log('📄 OpenAPI JSON spec available at /api-docs.json');
    
  } catch (error) {
    console.error('❌ Failed to set up Swagger documentation:', error);
    
    // Set up a minimal error page
    app.get('/api-docs', (_req: Request, res: Response) => {
      res.status(500).json({
        error: 'Documentation setup failed',
        message: 'Please check server logs for details'
      });
    });
  }
}

/**
 * Middleware to add API documentation links to responses
 */
export function addDocumentationLinks(req: Request, res: Response, next: NextFunction): void {
  // Add documentation links to the response headers
  res.set({
    'X-API-Documentation': `${req.protocol}://${req.get('host')}/api-docs`,
    'X-API-Spec': `${req.protocol}://${req.get('host')}/api-docs.json`
  });
  
  next();
}

export default setupSwagger;

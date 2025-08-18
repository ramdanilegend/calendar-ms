# Calendar Microservice

A comprehensive calendar microservice API that fetches data from Google Calendar and serves localized event data with support for Gregorian, Hijri, and Indonesian calendars.

## 🌟 Features

- **Multi-calendar support** - Gregorian, Hijri, and Indonesian calendars
- **Multi-language translations** - Support for Indonesian, English, and Arabic
- **Regional calendar mappings** - Automatic conversion between calendar systems
- **JWT Authentication** - Secure admin authentication and authorization
- **Comprehensive caching** - High-performance translation and data caching
- **Real-time synchronization** - Integration with Google Calendar API
- **RESTful API** - Clean, well-documented REST endpoints
- **Swagger Documentation** - Interactive API documentation
- **Comprehensive Testing** - Unit, integration, and performance tests
- **Production Ready** - Robust error handling and logging

## 📋 Table of Contents

- [Quick Start](#quick-start)
- [API Documentation](#api-documentation)
- [Database Schema](#database-schema)
- [Environment Variables](#environment-variables)
- [TypeScript Interfaces](#typescript-interfaces)
- [Testing](#testing)
- [Deployment](#deployment)
- [Development](#development)
- [Contributing](#contributing)

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- PostgreSQL 12+
- Google Calendar API credentials
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd calendar-ms
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Set up the database**
   ```bash
   # Create database
   createdb calendar_ms

   # Run migrations
   npm run migrate
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

The API will be available at `http://localhost:3000`

## 📚 API Documentation

### Interactive Documentation

Access the interactive Swagger UI documentation at:
- **Development**: http://localhost:3000/api-docs
- **JSON Spec**: http://localhost:3000/api-docs.json
- **Health Check**: http://localhost:3000/api-docs/health

### Core Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `GET` | `/api/v1/health` | Health check | No |
| `GET` | `/api/v1/events` | List calendar events | No |
| `GET` | `/api/v1/events/{id}` | Get specific event | No |
| `GET` | `/api/v1/updates/check` | Check last update | No |
| `POST` | `/api/v1/events/sync` | Sync with Google Calendar | Admin |
| `POST` | `/api/v1/calendar/mappings` | Update calendar mappings | Admin |

### Translation Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/events/{id}/translations` | Get all translations |
| `GET` | `/api/v1/events/{id}/translations/{lang}` | Get specific translation |
| `POST` | `/api/v1/events/{id}/translations` | Create translation |
| `PUT` | `/api/v1/events/{id}/translations/{lang}` | Update translation |
| `DELETE` | `/api/v1/events/{id}/translations/{lang}` | Delete translation |

### Authentication

The API uses JWT Bearer tokens for admin operations:

```bash
# Example authenticated request
curl -H "Authorization: Bearer <your-jwt-token>" \
     -X POST \
     http://localhost:3000/api/v1/events/sync
```

## 🗄️ Database Schema

The microservice uses PostgreSQL with the following main tables:

### Events Table
```sql
CREATE TABLE events (
    id SERIAL PRIMARY KEY,
    event_id VARCHAR(255) NOT NULL,
    region VARCHAR(255) NOT NULL,
    calendar_type VARCHAR(255) NOT NULL,
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    is_all_day BOOLEAN NOT NULL DEFAULT false,
    status VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(event_id, region, calendar_type)
);
```

### Event Translations Table
```sql
CREATE TABLE event_translations (
    id SERIAL PRIMARY KEY,
    event_id VARCHAR(255) NOT NULL,
    language VARCHAR(255) NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    location VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(event_id, language)
);
```

### Calendar Mappings Table
```sql
CREATE TABLE calendar_mappings (
    id SERIAL PRIMARY KEY,
    event_id VARCHAR(255) NOT NULL,
    region VARCHAR(255) NOT NULL,
    original_date TIMESTAMP WITH TIME ZONE NOT NULL,
    gregorian_date TIMESTAMP WITH TIME ZONE NOT NULL,
    hijri_date TIMESTAMP WITH TIME ZONE,
    indonesian_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(event_id, region, original_date)
);
```

### Update Metadata Table
```sql
CREATE TABLE update_metadata (
    id SERIAL PRIMARY KEY,
    source VARCHAR(255) NOT NULL,
    region VARCHAR(255) NOT NULL,
    last_successful_update TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(255) NOT NULL,
    error_details TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(source, region)
);
```

## 🔧 Environment Variables

Create a `.env` file based on `.env.example`:

### Database Configuration
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=calendar_ms
DB_USER=your_db_user
DB_PASSWORD=your_db_password
```

### Google Calendar API
```env
GOOGLE_CALENDAR_API_KEY=your_google_api_key
GOOGLE_SERVICE_ACCOUNT_PATH=/path/to/service-account.json
# OR
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
```

### JWT Authentication
```env
JWT_SECRET=your-super-secure-secret-key-here
JWT_EXPIRES_IN=24h
```

### Application Settings
```env
NODE_ENV=development
PORT=3000
LOG_LEVEL=info
```

### Testing (Optional)
```env
TEST_DB_HOST=localhost
TEST_DB_PORT=5432
TEST_DB_NAME=calendar_ms_test
TEST_DB_USER=your_test_db_user
TEST_DB_PASSWORD=your_test_db_password
```

## 🏗️ TypeScript Interfaces

### Core Types

```typescript
// Calendar Types
export enum CalendarType {
  GREGORIAN = 'gregorian',
  HIJRI = 'hijri',
  HIJRI_INDONESIA = 'hijri_indonesia'
}

export enum Region {
  GLOBAL = 'global',
  INDONESIA = 'indonesia',
  SAUDI_ARABIA = 'saudi_arabia',
  MALAYSIA = 'malaysia'
}

export enum LanguageCode {
  INDONESIAN = 'id',
  ENGLISH = 'en',
  ARABIC = 'ar'
}
```

### Event Interfaces

```typescript
export interface Event {
  id: number;
  event_id: string;
  region: Region;
  calendar_type: CalendarType;
  start_date: Date;
  end_date: Date;
  is_all_day: boolean;
  status: 'confirmed' | 'tentative' | 'cancelled';
  created_at: Date;
  updated_at: Date;
  translations?: EventTranslation[];
}

export interface EventTranslation {
  id: number;
  event_id: string;
  language: LanguageCode;
  title: string;
  description?: string;
  location?: string;
  created_at: Date;
  updated_at: Date;
}
```

### API Response Types

```typescript
export interface ApiResponse<T> {
  status: 'success' | 'error';
  data?: T;
  message?: string;
  timestamp?: string;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

export interface EventsResponse {
  events: Event[];
  pagination: PaginationInfo;
}
```

### Authentication Types

```typescript
export interface JWTPayload {
  userId: string;
  email: string;
  role: UserRole;
  iat: number;
  exp: number;
}

export enum UserRole {
  USER = 'user',
  ADMIN = 'admin'
}

export interface AuthenticatedRequest extends Request {
  user?: JWTPayload;
}
```

## 🧪 Testing

The project includes comprehensive testing with Jest and Supertest.

### Run Tests

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test -- --testPathPattern="events"
```

### Test Structure

- **Unit Tests**: Test individual functions and classes
- **Integration Tests**: Test API endpoints and database interactions
- **Performance Tests**: Test database query performance
- **Mock Tests**: Test external service integrations

### Coverage

The project maintains high test coverage:
- **Statements**: >70%
- **Branches**: >50%
- **Functions**: >70%
- **Lines**: >70%

## 🚀 Deployment

### Production Build

```bash
# Build the TypeScript code
npm run build

# Start production server
npm start
```

### Docker Deployment

```dockerfile
# Example Dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY dist ./dist
COPY docs ./docs

EXPOSE 3000
CMD ["node", "dist/server.js"]
```

### Environment Setup

1. **Production Database**: Set up PostgreSQL instance
2. **Environment Variables**: Configure production `.env`
3. **Google Calendar API**: Set up service account
4. **SSL/TLS**: Configure HTTPS (recommended)
5. **Monitoring**: Set up logging and monitoring
6. **Load Balancing**: Configure load balancer if needed

### Deployment Checklist

- [ ] Database migrations run successfully
- [ ] Environment variables configured
- [ ] Google Calendar API credentials valid
- [ ] SSL certificates installed
- [ ] Health check endpoint responding
- [ ] Logs and monitoring configured
- [ ] Backup strategy implemented

## 💻 Development

### Project Structure

```
calendar-ms/
├── src/
│   ├── api/
│   │   ├── handlers/          # Request handlers
│   │   ├── middleware/        # Express middleware
│   │   └── routes/           # Route definitions
│   ├── config/               # Configuration files
│   ├── db/
│   │   ├── models/           # Database models
│   │   └── migrations/       # Database migrations
│   ├── google/               # Google Calendar integration
│   ├── services/             # Business logic services
│   └── types/               # TypeScript type definitions
├── docs/                    # Documentation
├── scripts/                 # Utility scripts
└── tests/                  # Test files
```

### Development Scripts

```bash
# Development server with hot reload
npm run dev

# Build TypeScript
npm run build

# Watch mode for TypeScript
npm run watch

# Run database migrations
npm run migrate

# Fetch calendar data manually
npm run fetch-calendar

# Check scheduled tasks status
npm run schedule:status
```

### Code Style

The project uses:
- **ESLint** for code linting
- **Prettier** for code formatting
- **TypeScript** for type safety
- **Jest** for testing
- **Conventional Commits** for commit messages

### Git Workflow

1. Create feature branch from `main`
2. Make changes and add tests
3. Run tests and linting
4. Create pull request
5. Code review and merge

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Write tests for new features
- Follow existing code style
- Update documentation
- Add proper error handling
- Use meaningful commit messages

## 📝 License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:

- **Issues**: Create a GitHub issue
- **Documentation**: Check `/api-docs` endpoint
- **Email**: support@calendar-ms.com

## 🔄 Changelog

### Version 1.0.0
- Initial release with multi-calendar support
- Google Calendar integration
- JWT authentication
- Translation management
- Comprehensive testing suite
- Interactive API documentation

---

**Calendar Microservice** - Built with ❤️ using Node.js, TypeScript, and PostgreSQL

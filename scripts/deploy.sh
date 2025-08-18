#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
ENVIRONMENT="production"
BUILD_IMAGE="true"
RUN_MIGRATIONS="true"
HEALTH_CHECK="true"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --env)
      ENVIRONMENT="$2"
      shift 2
      ;;
    --no-build)
      BUILD_IMAGE="false"
      shift
      ;;
    --no-migrations)
      RUN_MIGRATIONS="false"
      shift
      ;;
    --no-health-check)
      HEALTH_CHECK="false"
      shift
      ;;
    -h|--help)
      echo "Usage: $0 [OPTIONS]"
      echo "Options:"
      echo "  --env ENVIRONMENT    Set deployment environment (default: production)"
      echo "  --no-build          Skip Docker image build"
      echo "  --no-migrations     Skip database migrations"
      echo "  --no-health-check   Skip health check after deployment"
      echo "  -h, --help          Show this help message"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      echo "Use --help for usage information"
      exit 1
      ;;
  esac
done

echo -e "${BLUE}🚀 Starting deployment for environment: ${ENVIRONMENT}${NC}"

# Check if required files exist
if [[ ! -f ".env.${ENVIRONMENT}" ]]; then
  echo -e "${RED}❌ Environment file .env.${ENVIRONMENT} not found${NC}"
  exit 1
fi

if [[ ! -f "docker-compose.yml" ]]; then
  echo -e "${RED}❌ docker-compose.yml not found${NC}"
  exit 1
fi

# Load environment variables
echo -e "${YELLOW}📋 Loading environment variables...${NC}"
export $(grep -v '^#' .env.${ENVIRONMENT} | xargs)

# Validate required environment variables
REQUIRED_VARS=("DB_PASSWORD" "JWT_SECRET" "GOOGLE_CALENDAR_API_KEY")
for var in "${REQUIRED_VARS[@]}"; do
  if [[ -z "${!var}" ]]; then
    echo -e "${RED}❌ Required environment variable ${var} is not set${NC}"
    exit 1
  fi
done

# Build Docker image if requested
if [[ "$BUILD_IMAGE" == "true" ]]; then
  echo -e "${YELLOW}🔨 Building Docker image...${NC}"
  docker build -t calendar-ms:${ENVIRONMENT} .
  
  if [[ $? -ne 0 ]]; then
    echo -e "${RED}❌ Docker build failed${NC}"
    exit 1
  fi
  
  echo -e "${GREEN}✅ Docker image built successfully${NC}"
fi

# Wait for database to be ready
echo -e "${YELLOW}⏳ Waiting for database to be ready...${NC}"
node scripts/wait-for-db.js

# Run database migrations if requested
if [[ "$RUN_MIGRATIONS" == "true" ]]; then
  echo -e "${YELLOW}🗄️ Running database migrations...${NC}"
  npm run migrate
  
  if [[ $? -ne 0 ]]; then
    echo -e "${RED}❌ Database migrations failed${NC}"
    exit 1
  fi
  
  echo -e "${GREEN}✅ Database migrations completed${NC}"
fi

# Stop existing containers
echo -e "${YELLOW}🛑 Stopping existing containers...${NC}"
docker-compose down --remove-orphans

# Start services
echo -e "${YELLOW}🏃 Starting services...${NC}"
docker-compose --env-file .env.${ENVIRONMENT} up -d

if [[ $? -ne 0 ]]; then
  echo -e "${RED}❌ Failed to start services${NC}"
  exit 1
fi

# Wait for services to be ready
echo -e "${YELLOW}⏳ Waiting for services to be ready...${NC}"
sleep 10

# Health check if requested
if [[ "$HEALTH_CHECK" == "true" ]]; then
  echo -e "${YELLOW}🏥 Performing health check...${NC}"
  
  # Try health check for up to 60 seconds
  for i in {1..12}; do
    if curl -f -s http://localhost:${PORT:-3000}/api/v1/health > /dev/null; then
      echo -e "${GREEN}✅ Health check passed${NC}"
      break
    fi
    
    if [[ $i -eq 12 ]]; then
      echo -e "${RED}❌ Health check failed after 60 seconds${NC}"
      echo -e "${YELLOW}📋 Container logs:${NC}"
      docker-compose logs calendar-ms
      exit 1
    fi
    
    echo -e "${YELLOW}⏳ Health check attempt ${i}/12...${NC}"
    sleep 5
  done
fi

# Show deployment status
echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
echo -e "${BLUE}📊 Service Status:${NC}"
docker-compose ps

echo -e "${BLUE}🔗 Service URLs:${NC}"
echo -e "  API: http://localhost:${PORT:-3000}/api/v1/health"
echo -e "  Documentation: http://localhost:${PORT:-3000}/api-docs"

echo -e "${GREEN}🎉 Calendar Microservice is now running!${NC}"

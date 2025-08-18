import dotenv from "dotenv";
import path from "path";

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

interface ServerConfig {
  port: number;
  nodeEnv: string;
}

interface GoogleCalendarConfig {
  apiKey: string;
  serviceAccountPath?: string;
  serviceAccountKey?: string;
}

interface Config {
  database: DatabaseConfig;
  server: ServerConfig;
  googleCalendar: GoogleCalendarConfig;
  jwtSecret: string;
}

// Set default values and read from environment variables
const config: Config = {
  database: {
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "5432", 10),
    database: process.env.DB_NAME || "calendar_ms",
    user: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD || "",
  },
  server: {
    port: parseInt(process.env.PORT || "3000", 10),
    nodeEnv: process.env.NODE_ENV || "development",
  },
  googleCalendar: {
    apiKey: process.env.GOOGLE_CALENDAR_API_KEY || "",
    serviceAccountPath: process.env.GOOGLE_SERVICE_ACCOUNT_PATH,
    serviceAccountKey: process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
  },
  jwtSecret: process.env.JWT_SECRET || "default-secret-change-in-production",
};

export default config;

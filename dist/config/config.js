"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
// Load environment variables from .env file
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../../.env') });
// Set default values and read from environment variables
const config = {
    database: {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432', 10),
        database: process.env.DB_NAME || 'calendar_ms',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || '',
    },
    server: {
        port: parseInt(process.env.PORT || '3000', 10),
        nodeEnv: process.env.NODE_ENV || 'development',
    },
    googleCalendar: {
        apiKey: process.env.GOOGLE_CALENDAR_API_KEY || '',
    },
    jwtSecret: process.env.JWT_SECRET || 'default-secret-change-in-production',
};
exports.default = config;
//# sourceMappingURL=config.js.map
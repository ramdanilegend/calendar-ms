"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const config_1 = __importDefault(require("./src/config/config"));
const logging_1 = require("./src/api/middleware/logging");
const routes_1 = __importDefault(require("./src/api/routes"));
// Create Express application
const app = (0, express_1.default)();
// Parse JSON bodies
app.use(express_1.default.json());
// Parse URL-encoded bodies
app.use(express_1.default.urlencoded({ extended: true }));
// Add request logging middleware
app.use(logging_1.requestLogger);
// Add routes
app.use('/api/v1', routes_1.default);
// Error handling middleware
app.use((err, req, res, next) => {
    (0, logging_1.errorLogger)(err, req, res, next);
    res.status(500).json({
        status: 'error',
        message: err.message || 'Internal Server Error',
    });
});
// Start the server
const PORT = config_1.default.server.port;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT} in ${config_1.default.server.nodeEnv} mode`);
});
exports.default = app;
//# sourceMappingURL=server.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const validation_1 = require("../middleware/validation");
const updateHandler_1 = require("../handlers/updateHandler");
const eventsHandler_1 = require("../handlers/eventsHandler");
const syncHandler_1 = require("../handlers/syncHandler");
const mappingHandler_1 = require("../handlers/mappingHandler");
const router = (0, express_1.Router)();
// Health check endpoint
router.get('/health', (_req, res) => {
    res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString()
    });
});
// Update check endpoint
router.get('/updates/check', validation_1.validateUpdateQuery, updateHandler_1.checkLastUpdate);
// Events endpoints
router.get('/events', validation_1.validateEventsQuery, eventsHandler_1.getEvents);
router.get('/events/:event_id', validation_1.validateEventId, eventsHandler_1.getEventById);
// Admin-only sync endpoint
router.post('/events/sync', auth_1.authenticateToken, auth_1.requireAdmin, validation_1.validateJsonBody, validation_1.validateSyncRequest, syncHandler_1.syncEvents);
// Admin-only calendar mappings endpoint
router.post('/calendar/mappings', auth_1.authenticateToken, auth_1.requireAdmin, validation_1.validateJsonBody, validation_1.validateMappingsRequest, mappingHandler_1.updateCalendarMappings);
exports.default = router;
//# sourceMappingURL=index.js.map
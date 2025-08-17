"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const router = (0, express_1.Router)();
// Health check endpoint
router.get('/health', (_req, res) => {
    res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString()
    });
});
// TODO: Add routes for /events, /updates/check, /events/sync, /calendar/mappings
exports.default = router;
//# sourceMappingURL=index.js.map
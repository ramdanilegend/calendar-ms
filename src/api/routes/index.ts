import { Router } from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { 
  validateEventsQuery, 
  validateUpdateQuery, 
  validateEventId, 
  validateSyncRequest, 
  validateMappingsRequest,
  validateJsonBody 
} from '../middleware/validation';
import { checkLastUpdate } from '../handlers/updateHandler';
import { getEvents, getEventById } from '../handlers/eventsHandler';
import { syncEvents } from '../handlers/syncHandler';
import { updateCalendarMappings } from '../handlers/mappingHandler';
import {
  getEventTranslations,
  getEventTranslation,
  createEventTranslation,
  updateEventTranslation,
  deleteEventTranslation,
  getFormattedTranslation,
  getCacheStats,
  clearCache
} from '../handlers/translationHandler';

const router = Router();

// Health check endpoint
router.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

// Update check endpoint
router.get('/updates/check', validateUpdateQuery, checkLastUpdate);

// Events endpoints
router.get('/events', validateEventsQuery, getEvents);
router.get('/events/:event_id', validateEventId, getEventById);

// Admin-only sync endpoint
router.post('/events/sync', 
  authenticateToken, 
  requireAdmin, 
  validateJsonBody, 
  validateSyncRequest, 
  syncEvents
);

// Admin-only calendar mappings endpoint
router.post('/calendar/mappings', 
  authenticateToken, 
  requireAdmin, 
  validateJsonBody, 
  validateMappingsRequest, 
  updateCalendarMappings
);

// Translation endpoints
router.get('/events/:eventId/translations', getEventTranslations);
router.get('/events/:eventId/translations/:language', getEventTranslation);
router.post('/events/:eventId/translations', 
  validateJsonBody, 
  createEventTranslation
);
router.put('/events/:eventId/translations/:language', 
  validateJsonBody, 
  updateEventTranslation
);
router.delete('/events/:eventId/translations/:language', deleteEventTranslation);
router.get('/events/:eventId/translations/:language/formatted', getFormattedTranslation);

// Translation cache management endpoints (admin-only)
router.get('/translations/cache/stats', 
  authenticateToken, 
  requireAdmin, 
  getCacheStats
);
router.post('/translations/cache/clear', 
  authenticateToken, 
  requireAdmin, 
  clearCache
);

export default router;

import { Router } from 'express';

const router = Router();

// Health check endpoint
router.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

// TODO: Add routes for /events, /updates/check, /events/sync, /calendar/mappings

export default router;

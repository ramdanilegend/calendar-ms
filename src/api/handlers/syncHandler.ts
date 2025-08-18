import { Response, NextFunction } from 'express';
import GoogleCalendarService from '../../google/googleCalendar';
import UpdateMetadata from '../../db/models/UpdateMetadata';
import { sendSuccessResponse, sendErrorResponse } from '../utils/responseFormatter';
import { EventsSyncRequest, EventsSyncResponse, SUPPORTED_REGIONS } from '../types';
import { AuthenticatedRequest } from '../middleware/auth';

/**
 * POST /events/sync
 * Manually trigger synchronization of calendar events (Admin only)
 */
export const syncEvents = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { region, force_refresh }: EventsSyncRequest = req.body;

    // Validate region if provided
    if (region && !SUPPORTED_REGIONS.includes(region as any)) {
      return sendErrorResponse(res, `Invalid region. Supported regions: ${SUPPORTED_REGIONS.join(', ')}`, 400);
    }

    // Initialize Google Calendar service
    const googleCalendarService = new GoogleCalendarService();

    let syncedEventsCount = 0;
    let syncStatus: 'completed' | 'in_progress' | 'failed' = 'in_progress';
    const currentYear = new Date().getFullYear();

    try {
      // Update metadata to show sync is in progress
      if (region) {
        await UpdateMetadata.upsert({
          source: 'google_calendar',
          region,
          last_successful_update: new Date(),
          status: 'in_progress',
          error_details: null,
        });
      } else {
        // Update for all supported regions
        for (const supportedRegion of SUPPORTED_REGIONS) {
          await UpdateMetadata.upsert({
            source: 'google_calendar',
            region: supportedRegion,
            last_successful_update: new Date(),
            status: 'in_progress',
            error_details: null,
          });
        }
      }

      // Perform the sync
      if (force_refresh) {
        // For force refresh, we might want to clear existing data first
        // This is a simplified implementation - in production you'd want more sophisticated handling
        await googleCalendarService.syncAnnualData(currentYear);
      } else {
        // Regular sync - fetch and update events
        const events = await googleCalendarService.fetchAnnualEvents(currentYear);
        await googleCalendarService.storeEvents(events);
        syncedEventsCount = events.length;
      }

      syncStatus = 'completed';

      // Update metadata to show successful completion
      const successfulUpdate = new Date();
      if (region) {
        await UpdateMetadata.upsert({
          source: 'google_calendar',
          region,
          last_successful_update: successfulUpdate,
          status: 'success',
          error_details: null,
        });
      } else {
        // Update for all supported regions
        for (const supportedRegion of SUPPORTED_REGIONS) {
          await UpdateMetadata.upsert({
            source: 'google_calendar',
            region: supportedRegion,
            last_successful_update: successfulUpdate,
            status: 'success',
            error_details: null,
          });
        }
      }

    } catch (syncError: any) {
      syncStatus = 'failed';

      // Update metadata to show failure
      const errorDetails = syncError.message || 'Unknown sync error';
      if (region) {
        await UpdateMetadata.upsert({
          source: 'google_calendar',
          region,
          last_successful_update: new Date(),
          status: 'failed',
          error_details: errorDetails,
        });
      } else {
        // Update for all supported regions
        for (const supportedRegion of SUPPORTED_REGIONS) {
          await UpdateMetadata.upsert({
            source: 'google_calendar',
            region: supportedRegion,
            last_successful_update: new Date(),
            status: 'failed',
            error_details: errorDetails,
          });
        }
      }

      throw syncError;
    }

    const responseData: EventsSyncResponse = {
      message: region 
        ? `Events sync ${syncStatus} for region ${region}`
        : `Events sync ${syncStatus} for all regions`,
      synced_events: syncedEventsCount,
      region: region || 'all',
      sync_status: syncStatus,
    };

    const statusCode = syncStatus === 'completed' ? 200 : 202;
    sendSuccessResponse(res, responseData, responseData.message, statusCode);

  } catch (error) {
    next(error);
  }
};

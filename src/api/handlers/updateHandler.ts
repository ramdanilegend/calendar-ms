import { Request, Response, NextFunction } from 'express';
import UpdateMetadata from '../../db/models/UpdateMetadata';
import { sendSuccessResponse, sendErrorResponse } from '../utils/responseFormatter';
import { UpdateCheckResponse, SUPPORTED_REGIONS } from '../types';

/**
 * GET /updates/check
 * Check the last update timestamp for each region and source
 */
export const checkLastUpdate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { region } = req.query;

    // Build where clause for filtering
    const whereClause: any = {};
    if (region) {
      if (!SUPPORTED_REGIONS.includes(region as any)) {
        return sendErrorResponse(res, `Invalid region. Supported regions: ${SUPPORTED_REGIONS.join(', ')}`, 400);
      }
      whereClause.region = region;
    }

    // Fetch update metadata
    const updates = await UpdateMetadata.findAll({
      where: whereClause,
      order: [['last_successful_update', 'DESC']],
      attributes: ['source', 'region', 'last_successful_update', 'status'],
    });

    if (updates.length === 0) {
      return sendErrorResponse(res, 'No update records found', 404);
    }

    // Format response data
    const updateData: UpdateCheckResponse[] = updates.map(update => ({
      last_update: update.last_successful_update.toISOString(),
      source: update.source,
      region: update.region,
      status: update.status,
    }));

    sendSuccessResponse(
      res,
      region ? updateData[0] : updateData,
      region 
        ? `Last update information for region ${region}` 
        : 'Last update information for all regions'
    );

  } catch (error) {
    next(error);
  }
};

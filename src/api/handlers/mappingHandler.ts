import { Response, NextFunction } from 'express';
import { Transaction } from 'sequelize';
import sequelize from '../../db/index';
import CalendarMapping from '../../db/models/CalendarMapping';
import Event from '../../db/models/Event';
import { sendSuccessResponse, sendErrorResponse } from '../utils/responseFormatter';
import { 
  CalendarMappingsRequest, 
  CalendarMappingsResponse, 
  CalendarMappingUpdate,
  CalendarMappingError,
  SUPPORTED_REGIONS 
} from '../types';
import { AuthenticatedRequest } from '../middleware/auth';

/**
 * POST /calendar/mappings
 * Update calendar mappings for events (Admin only)
 */
export const updateCalendarMappings = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  const transaction: Transaction = await sequelize.transaction();

  try {
    const { mappings }: CalendarMappingsRequest = req.body;

    if (!mappings || !Array.isArray(mappings) || mappings.length === 0) {
      await transaction.rollback();
      return sendErrorResponse(res, 'Mappings array is required and cannot be empty', 400);
    }

    // Validate mappings before processing
    const validationErrors: CalendarMappingError[] = [];
    for (let i = 0; i < mappings.length; i++) {
      const mapping = mappings[i];
      const validationResult = validateMappingData(mapping, i);
      if (validationResult) {
        validationErrors.push(validationResult);
      }
    }

    if (validationErrors.length > 0) {
      await transaction.rollback();
      return sendErrorResponse(res, 'Validation errors in mapping data', 400, { validation_errors: validationErrors });
    }

    let updatedMappings = 0;
    const failedMappings: CalendarMappingError[] = [];

    // Process each mapping update
    for (const mapping of mappings) {
      try {
        // Check if the event exists
        const event = await Event.findOne({
          where: {
            event_id: mapping.event_id,
            region: mapping.region
          },
          transaction
        });

        if (!event) {
          failedMappings.push({
            event_id: mapping.event_id,
            region: mapping.region,
            error: 'Event not found'
          });
          continue;
        }

        // Parse dates
        const originalDate = new Date(mapping.original_date);
        const gregorianDate = new Date(mapping.gregorian_date);
        const hijriDate = mapping.hijri_date ? new Date(mapping.hijri_date) : null;
        const indonesianDate = mapping.indonesian_date ? new Date(mapping.indonesian_date) : null;

        // Update or create calendar mapping
        await CalendarMapping.upsert({
          event_id: mapping.event_id,
          region: mapping.region,
          original_date: originalDate,
          gregorian_date: gregorianDate,
          hijri_date: hijriDate,
          indonesian_date: indonesianDate,
        }, { transaction });

        updatedMappings++;

      } catch (mappingError: any) {
        failedMappings.push({
          event_id: mapping.event_id,
          region: mapping.region,
          error: mappingError.message || 'Unknown error occurred'
        });
      }
    }

    await transaction.commit();

    const responseData: CalendarMappingsResponse = {
      message: `Successfully processed ${mappings.length} mapping(s). Updated: ${updatedMappings}, Failed: ${failedMappings.length}`,
      updated_mappings: updatedMappings,
      failed_mappings: failedMappings,
    };

    // Return success even if some mappings failed, but include the failures in response
    const statusCode = failedMappings.length === 0 ? 200 : 207; // 207 Multi-Status for partial success
    sendSuccessResponse(res, responseData, responseData.message, statusCode);

  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

/**
 * Validate individual mapping data
 */
function validateMappingData(mapping: CalendarMappingUpdate, index: number): CalendarMappingError | null {
  // Check required fields
  if (!mapping.event_id) {
    return {
      event_id: mapping.event_id || `mapping_${index}`,
      region: mapping.region || 'unknown',
      error: 'event_id is required'
    };
  }

  if (!mapping.region) {
    return {
      event_id: mapping.event_id,
      region: mapping.region || 'unknown',
      error: 'region is required'
    };
  }

  if (!mapping.original_date) {
    return {
      event_id: mapping.event_id,
      region: mapping.region,
      error: 'original_date is required'
    };
  }

  if (!mapping.gregorian_date) {
    return {
      event_id: mapping.event_id,
      region: mapping.region,
      error: 'gregorian_date is required'
    };
  }

  // Validate region
  if (!SUPPORTED_REGIONS.includes(mapping.region as any)) {
    return {
      event_id: mapping.event_id,
      region: mapping.region,
      error: `Invalid region. Supported regions: ${SUPPORTED_REGIONS.join(', ')}`
    };
  }

  // Validate date formats
  const originalDate = new Date(mapping.original_date);
  if (isNaN(originalDate.getTime())) {
    return {
      event_id: mapping.event_id,
      region: mapping.region,
      error: 'Invalid original_date format. Use ISO 8601 format.'
    };
  }

  const gregorianDate = new Date(mapping.gregorian_date);
  if (isNaN(gregorianDate.getTime())) {
    return {
      event_id: mapping.event_id,
      region: mapping.region,
      error: 'Invalid gregorian_date format. Use ISO 8601 format.'
    };
  }

  if (mapping.hijri_date) {
    const hijriDate = new Date(mapping.hijri_date);
    if (isNaN(hijriDate.getTime())) {
      return {
        event_id: mapping.event_id,
        region: mapping.region,
        error: 'Invalid hijri_date format. Use ISO 8601 format.'
      };
    }
  }

  if (mapping.indonesian_date) {
    const indonesianDate = new Date(mapping.indonesian_date);
    if (isNaN(indonesianDate.getTime())) {
      return {
        event_id: mapping.event_id,
        region: mapping.region,
        error: 'Invalid indonesian_date format. Use ISO 8601 format.'
      };
    }
  }

  return null; // No validation errors
}

import { Request, Response, NextFunction } from 'express';
import { sendErrorResponse } from '../utils/responseFormatter';
import { 
  SUPPORTED_REGIONS, 
  SUPPORTED_LANGUAGES, 
  SUPPORTED_CALENDAR_TYPES, 
  SUPPORTED_EVENT_STATUSES,
  ValidationError 
} from '../types';

/**
 * Validate query parameters for events endpoints
 */
export const validateEventsQuery = (req: Request, res: Response, next: NextFunction): void => {
  const errors: ValidationError[] = [];
  const {
    region,
    language,
    calendar_type,
    status,
    updated_after,
    start_date,
    end_date,
    page,
    limit
  } = req.query;

  // Validate region
  if (region && !SUPPORTED_REGIONS.includes(region as any)) {
    errors.push({
      field: 'region',
      message: `Invalid region. Supported regions: ${SUPPORTED_REGIONS.join(', ')}`,
      value: region
    });
  }

  // Validate language
  if (language && !SUPPORTED_LANGUAGES.includes(language as any)) {
    errors.push({
      field: 'language',
      message: `Invalid language. Supported languages: ${SUPPORTED_LANGUAGES.join(', ')}`,
      value: language
    });
  }

  // Validate calendar_type
  if (calendar_type && !SUPPORTED_CALENDAR_TYPES.includes(calendar_type as any)) {
    errors.push({
      field: 'calendar_type',
      message: `Invalid calendar type. Supported types: ${SUPPORTED_CALENDAR_TYPES.join(', ')}`,
      value: calendar_type
    });
  }

  // Validate status
  if (status && !SUPPORTED_EVENT_STATUSES.includes(status as any)) {
    errors.push({
      field: 'status',
      message: `Invalid status. Supported statuses: ${SUPPORTED_EVENT_STATUSES.join(', ')}`,
      value: status
    });
  }

  // Validate dates
  if (updated_after) {
    const date = new Date(updated_after as string);
    if (isNaN(date.getTime())) {
      errors.push({
        field: 'updated_after',
        message: 'Invalid date format. Use ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ)',
        value: updated_after
      });
    }
  }

  if (start_date) {
    const date = new Date(start_date as string);
    if (isNaN(date.getTime())) {
      errors.push({
        field: 'start_date',
        message: 'Invalid date format. Use ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ)',
        value: start_date
      });
    }
  }

  if (end_date) {
    const date = new Date(end_date as string);
    if (isNaN(date.getTime())) {
      errors.push({
        field: 'end_date',
        message: 'Invalid date format. Use ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ)',
        value: end_date
      });
    }
  }

  // Validate date range logic
  if (start_date && end_date) {
    const startDate = new Date(start_date as string);
    const endDate = new Date(end_date as string);
    if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime()) && startDate > endDate) {
      errors.push({
        field: 'date_range',
        message: 'start_date must be before or equal to end_date',
        value: { start_date, end_date }
      });
    }
  }

  // Validate pagination parameters
  if (page) {
    const pageNum = parseInt(page as string, 10);
    if (isNaN(pageNum) || pageNum < 1) {
      errors.push({
        field: 'page',
        message: 'page must be a positive integer',
        value: page
      });
    }
  }

  if (limit) {
    const limitNum = parseInt(limit as string, 10);
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      errors.push({
        field: 'limit',
        message: 'limit must be a positive integer between 1 and 100',
        value: limit
      });
    }
  }

  if (errors.length > 0) {
    return sendErrorResponse(res, 'Validation failed', 400, { validation_errors: errors });
  }

  next();
};

/**
 * Validate update check query parameters
 */
export const validateUpdateQuery = (req: Request, res: Response, next: NextFunction): void => {
  const errors: ValidationError[] = [];
  const { region } = req.query;

  // Validate region
  if (region && !SUPPORTED_REGIONS.includes(region as any)) {
    errors.push({
      field: 'region',
      message: `Invalid region. Supported regions: ${SUPPORTED_REGIONS.join(', ')}`,
      value: region
    });
  }

  if (errors.length > 0) {
    return sendErrorResponse(res, 'Validation failed', 400, { validation_errors: errors });
  }

  next();
};

/**
 * Validate event ID parameter
 */
export const validateEventId = (req: Request, res: Response, next: NextFunction): void => {
  const { event_id } = req.params;

  if (!event_id || typeof event_id !== 'string' || event_id.trim().length === 0) {
    return sendErrorResponse(res, 'Valid event_id parameter is required', 400);
  }

  // Sanitize the event_id to prevent potential injection attacks
  if (!/^[a-zA-Z0-9_@.-]+$/.test(event_id)) {
    return sendErrorResponse(res, 'event_id contains invalid characters', 400);
  }

  next();
};

/**
 * Validate sync request body
 */
export const validateSyncRequest = (req: Request, res: Response, next: NextFunction): void => {
  const errors: ValidationError[] = [];
  const { region, force_refresh } = req.body;

  // Validate region if provided
  if (region !== undefined) {
    if (typeof region !== 'string' || !SUPPORTED_REGIONS.includes(region as any)) {
      errors.push({
        field: 'region',
        message: `Invalid region. Supported regions: ${SUPPORTED_REGIONS.join(', ')}`,
        value: region
      });
    }
  }

  // Validate force_refresh if provided
  if (force_refresh !== undefined && typeof force_refresh !== 'boolean') {
    errors.push({
      field: 'force_refresh',
      message: 'force_refresh must be a boolean value',
      value: force_refresh
    });
  }

  if (errors.length > 0) {
    return sendErrorResponse(res, 'Validation failed', 400, { validation_errors: errors });
  }

  next();
};

/**
 * Validate calendar mappings request body
 */
export const validateMappingsRequest = (req: Request, res: Response, next: NextFunction): void => {
  const errors: ValidationError[] = [];
  const { mappings } = req.body;

  if (!mappings) {
    return sendErrorResponse(res, 'mappings field is required', 400);
  }

  if (!Array.isArray(mappings)) {
    return sendErrorResponse(res, 'mappings must be an array', 400);
  }

  if (mappings.length === 0) {
    return sendErrorResponse(res, 'mappings array cannot be empty', 400);
  }

  if (mappings.length > 100) {
    return sendErrorResponse(res, 'mappings array cannot contain more than 100 items', 400);
  }

  // Validate each mapping item
  mappings.forEach((mapping, index) => {
    if (typeof mapping !== 'object' || mapping === null) {
      errors.push({
        field: `mappings[${index}]`,
        message: 'Each mapping must be an object',
        value: mapping
      });
      return;
    }

    // Required fields
    const requiredFields = ['event_id', 'region', 'original_date', 'gregorian_date'];
    requiredFields.forEach(field => {
      if (!mapping[field]) {
        errors.push({
          field: `mappings[${index}].${field}`,
          message: `${field} is required`,
          value: mapping[field]
        });
      }
    });

    // Validate region
    if (mapping.region && !SUPPORTED_REGIONS.includes(mapping.region)) {
      errors.push({
        field: `mappings[${index}].region`,
        message: `Invalid region. Supported regions: ${SUPPORTED_REGIONS.join(', ')}`,
        value: mapping.region
      });
    }

    // Validate date formats
    const dateFields = ['original_date', 'gregorian_date', 'hijri_date', 'indonesian_date'];
    dateFields.forEach(field => {
      if (mapping[field]) {
        const date = new Date(mapping[field]);
        if (isNaN(date.getTime())) {
          errors.push({
            field: `mappings[${index}].${field}`,
            message: 'Invalid date format. Use ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ)',
            value: mapping[field]
          });
        }
      }
    });
  });

  if (errors.length > 0) {
    return sendErrorResponse(res, 'Validation failed', 400, { validation_errors: errors });
  }

  next();
};

/**
 * General request body validation middleware
 */
export const validateJsonBody = (req: Request, res: Response, next: NextFunction): void => {
  if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
    if (!req.body || Object.keys(req.body).length === 0) {
      return sendErrorResponse(res, 'Request body is required for this endpoint', 400);
    }
  }
  next();
};

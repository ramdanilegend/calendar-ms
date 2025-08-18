import { Request, Response, NextFunction } from 'express';
import { Op, WhereOptions } from 'sequelize';
import Event from '../../db/models/Event';
import EventTranslation from '../../db/models/EventTranslation';
import CalendarMapping from '../../db/models/CalendarMapping';
import { 
  sendSuccessResponse, 
  sendErrorResponse, 
  parsePaginationParams, 
  createPaginationMeta 
} from '../utils/responseFormatter';
import { 
  EventQuery, 
  EventResponse, 
  EventsListResponse, 
  SUPPORTED_REGIONS, 
  SUPPORTED_LANGUAGES, 
  SUPPORTED_CALENDAR_TYPES, 
  SUPPORTED_EVENT_STATUSES 
} from '../types';

/**
 * GET /events
 * Retrieve events with optional filtering and pagination
 */
export const getEvents = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const {
      region,
      language,
      updated_after,
      calendar_type,
      start_date,
      end_date,
      status,
      page,
      limit
    } = req.query as EventQuery;

    // Validate query parameters
    if (region && !SUPPORTED_REGIONS.includes(region as any)) {
      return sendErrorResponse(res, `Invalid region. Supported regions: ${SUPPORTED_REGIONS.join(', ')}`, 400);
    }

    if (language && !SUPPORTED_LANGUAGES.includes(language as any)) {
      return sendErrorResponse(res, `Invalid language. Supported languages: ${SUPPORTED_LANGUAGES.join(', ')}`, 400);
    }

    if (calendar_type && !SUPPORTED_CALENDAR_TYPES.includes(calendar_type as any)) {
      return sendErrorResponse(res, `Invalid calendar type. Supported types: ${SUPPORTED_CALENDAR_TYPES.join(', ')}`, 400);
    }

    if (status && !SUPPORTED_EVENT_STATUSES.includes(status as any)) {
      return sendErrorResponse(res, `Invalid status. Supported statuses: ${SUPPORTED_EVENT_STATUSES.join(', ')}`, 400);
    }

    // Parse pagination parameters
    const { page: pageNum, limit: limitNum, offset } = parsePaginationParams(page, limit);

    // Build where clause for filtering
    const whereClause: WhereOptions = {};

    if (region) {
      whereClause.region = region;
    }

    if (calendar_type) {
      whereClause.calendar_type = calendar_type;
    }

    if (status) {
      whereClause.status = status;
    }

    if (updated_after) {
      const updatedAfterDate = new Date(updated_after);
      if (isNaN(updatedAfterDate.getTime())) {
        return sendErrorResponse(res, 'Invalid updated_after date format. Use ISO 8601 format.', 400);
      }
      whereClause.updated_at = { [Op.gte]: updatedAfterDate };
    }

    if (start_date && end_date) {
      const startDate = new Date(start_date);
      const endDate = new Date(end_date);
      
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return sendErrorResponse(res, 'Invalid date format. Use ISO 8601 format.', 400);
      }

      whereClause.start_date = { [Op.between]: [startDate, endDate] };
    } else if (start_date) {
      const startDate = new Date(start_date);
      if (isNaN(startDate.getTime())) {
        return sendErrorResponse(res, 'Invalid start_date format. Use ISO 8601 format.', 400);
      }
      whereClause.start_date = { [Op.gte]: startDate };
    } else if (end_date) {
      const endDate = new Date(end_date);
      if (isNaN(endDate.getTime())) {
        return sendErrorResponse(res, 'Invalid end_date format. Use ISO 8601 format.', 400);
      }
      whereClause.start_date = { [Op.lte]: endDate };
    }

    // Build include array for associations
    const include: any[] = [];

    if (language) {
      include.push({
        model: EventTranslation,
        as: 'translations',
        where: { language },
        required: false
      });
    } else {
      include.push({
        model: EventTranslation,
        as: 'translations',
        required: false
      });
    }

    include.push({
      model: CalendarMapping,
      as: 'calendar_mappings',
      required: false
    });

    // Fetch events with count for pagination
    const { count, rows: events } = await Event.findAndCountAll({
      where: whereClause,
      include,
      limit: limitNum,
      offset,
      order: [['start_date', 'ASC']],
    });

    // Format response data
    const formattedEvents: EventResponse[] = events.map(event => ({
      id: event.id,
      event_id: event.event_id,
      region: event.region,
      calendar_type: event.calendar_type,
      start_date: event.start_date.toISOString(),
      end_date: event.end_date.toISOString(),
      is_all_day: event.is_all_day,
      recurrence_rule: event.recurrence_rule,
      status: event.status,
      created_at: event.created_at.toISOString(),
      updated_at: event.updated_at.toISOString(),
      translations: (event as any).translations?.map((t: any) => ({
        id: t.id,
        language: t.language,
        title: t.title,
        description: t.description,
        location: t.location,
      })) || [],
      calendar_mappings: (event as any).calendar_mappings?.map((cm: any) => ({
        id: cm.id,
        original_date: cm.original_date.toISOString(),
        gregorian_date: cm.gregorian_date.toISOString(),
        hijri_date: cm.hijri_date?.toISOString() || null,
        indonesian_date: cm.indonesian_date?.toISOString() || null,
      })) || [],
    }));

    const pagination = createPaginationMeta(pageNum, limitNum, count);

    const responseData: EventsListResponse = {
      events: formattedEvents,
      pagination,
    };

    sendSuccessResponse(res, responseData, `Retrieved ${formattedEvents.length} events`);

  } catch (error) {
    next(error);
  }
};

/**
 * GET /events/:event_id
 * Retrieve a specific event by its event_id
 */
export const getEventById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { event_id } = req.params;
    const { language } = req.query;

    if (!event_id) {
      return sendErrorResponse(res, 'Event ID is required', 400);
    }

    if (language && !SUPPORTED_LANGUAGES.includes(language as any)) {
      return sendErrorResponse(res, `Invalid language. Supported languages: ${SUPPORTED_LANGUAGES.join(', ')}`, 400);
    }

    // Build include array for associations
    const include: any[] = [];

    if (language) {
      include.push({
        model: EventTranslation,
        as: 'translations',
        where: { language },
        required: false
      });
    } else {
      include.push({
        model: EventTranslation,
        as: 'translations',
        required: false
      });
    }

    include.push({
      model: CalendarMapping,
      as: 'calendar_mappings',
      required: false
    });

    // Fetch the specific event
    const event = await Event.findOne({
      where: { event_id },
      include,
    });

    if (!event) {
      return sendErrorResponse(res, 'Event not found', 404);
    }

    // Format response data
    const formattedEvent: EventResponse = {
      id: event.id,
      event_id: event.event_id,
      region: event.region,
      calendar_type: event.calendar_type,
      start_date: event.start_date.toISOString(),
      end_date: event.end_date.toISOString(),
      is_all_day: event.is_all_day,
      recurrence_rule: event.recurrence_rule,
      status: event.status,
      created_at: event.created_at.toISOString(),
      updated_at: event.updated_at.toISOString(),
      translations: (event as any).translations?.map((t: any) => ({
        id: t.id,
        language: t.language,
        title: t.title,
        description: t.description,
        location: t.location,
      })) || [],
      calendar_mappings: (event as any).calendar_mappings?.map((cm: any) => ({
        id: cm.id,
        original_date: cm.original_date.toISOString(),
        gregorian_date: cm.gregorian_date.toISOString(),
        hijri_date: cm.hijri_date?.toISOString() || null,
        indonesian_date: cm.indonesian_date?.toISOString() || null,
      })) || [],
    };

    sendSuccessResponse(res, formattedEvent, `Event ${event_id} retrieved successfully`);

  } catch (error) {
    next(error);
  }
};

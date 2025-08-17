import { Transaction, Op, WhereOptions } from 'sequelize';
import { BaseRepository, QueryFilter, RepositoryError } from './BaseRepository';
import Event from '../models/Event';
import CalendarMapping from '../models/CalendarMapping';

// Event-specific interfaces
export interface EventAttributes {
  id: number;
  event_id: string;
  region: string;
  calendar_type: string;
  start_date: Date;
  end_date: Date;
  is_all_day: boolean;
  recurrence_rule: string | null;
  status: string;
  created_at: Date;
  updated_at: Date;
}

export interface EventCreationAttributes {
  event_id: string;
  region: string;
  calendar_type: string;
  start_date: Date;
  end_date: Date;
  is_all_day?: boolean;
  recurrence_rule?: string | null;
  status?: string;
}

// CalendarMapping-specific interfaces
export interface CalendarMappingAttributes {
  id: number;
  event_id: string;
  region: string;
  original_date: Date;
  gregorian_date: Date;
  hijri_date: Date | null;
  indonesian_date: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface CalendarMappingCreationAttributes {
  event_id: string;
  region: string;
  original_date: Date;
  gregorian_date: Date;
  hijri_date?: Date | null;
  indonesian_date?: Date | null;
}

// Query filters for events
export interface EventQueryFilter extends QueryFilter<EventAttributes> {
  event_id?: string;
  region?: string;
  calendar_type?: string;
  status?: string;
  date_range?: {
    start: Date;
    end: Date;
  };
  updated_since?: Date;
}

// Query filters for calendar mappings
export interface CalendarMappingQueryFilter extends QueryFilter<CalendarMappingAttributes> {
  event_id?: string;
  region?: string;
  date_range?: {
    start: Date;
    end: Date;
  };
}

// Combined event data interface
export interface EventWithMapping {
  event: Event;
  mapping?: CalendarMapping | null;
}

// Calendar repository interface
export interface ICalendarRepository {
  // Event operations
  findEventById(id: number, transaction?: Transaction): Promise<Event | null>;
  findEventByEventId(eventId: string, region: string, calendarType: string, transaction?: Transaction): Promise<Event | null>;
  findEventsByRegion(region: string, filter?: EventQueryFilter, transaction?: Transaction): Promise<Event[]>;
  findEventsByCalendarType(calendarType: string, filter?: EventQueryFilter, transaction?: Transaction): Promise<Event[]>;
  findEventsByDateRange(startDate: Date, endDate: Date, filter?: EventQueryFilter, transaction?: Transaction): Promise<Event[]>;
  findEventsUpdatedSince(timestamp: Date, filter?: EventQueryFilter, transaction?: Transaction): Promise<Event[]>;
  createEvent(data: EventCreationAttributes, transaction?: Transaction): Promise<Event>;
  updateEvent(id: number, data: Partial<EventAttributes>, transaction?: Transaction): Promise<Event | null>;
  upsertEvent(data: EventCreationAttributes & { id?: number }, transaction?: Transaction): Promise<[Event, boolean]>;
  deleteEvent(id: number, transaction?: Transaction): Promise<boolean>;
  
  // Calendar mapping operations
  findMappingById(id: number, transaction?: Transaction): Promise<CalendarMapping | null>;
  findMappingByEventId(eventId: string, region: string, transaction?: Transaction): Promise<CalendarMapping | null>;
  findMappingsByRegion(region: string, filter?: CalendarMappingQueryFilter, transaction?: Transaction): Promise<CalendarMapping[]>;
  createMapping(data: CalendarMappingCreationAttributes, transaction?: Transaction): Promise<CalendarMapping>;
  updateMapping(id: number, data: Partial<CalendarMappingAttributes>, transaction?: Transaction): Promise<CalendarMapping | null>;
  upsertMapping(data: CalendarMappingCreationAttributes & { id?: number }, transaction?: Transaction): Promise<[CalendarMapping, boolean]>;
  deleteMapping(id: number, transaction?: Transaction): Promise<boolean>;
  
  // Combined operations
  findEventWithMapping(eventId: string, region: string, calendarType: string, transaction?: Transaction): Promise<EventWithMapping | null>;
  createEventWithMapping(eventData: EventCreationAttributes, mappingData: CalendarMappingCreationAttributes, transaction?: Transaction): Promise<EventWithMapping>;
  
  // Bulk operations
  bulkUpsertEvents(events: EventCreationAttributes[], transaction?: Transaction): Promise<Event[]>;
  bulkUpsertMappings(mappings: CalendarMappingCreationAttributes[], transaction?: Transaction): Promise<CalendarMapping[]>;
  
  // Analytics and filtering
  getEventCountByRegion(region: string, filter?: EventQueryFilter, transaction?: Transaction): Promise<number>;
  getEventCountByCalendarType(calendarType: string, filter?: EventQueryFilter, transaction?: Transaction): Promise<number>;
  getEventsGroupedByStatus(filter?: EventQueryFilter, transaction?: Transaction): Promise<Record<string, number>>;
}

// Calendar repository implementation
export class CalendarRepository implements ICalendarRepository {
  private eventRepo: BaseRepository<Event, EventAttributes, EventCreationAttributes>;
  private mappingRepo: BaseRepository<CalendarMapping, CalendarMappingAttributes, CalendarMappingCreationAttributes>;

  constructor() {
    this.eventRepo = new BaseRepository<Event, EventAttributes, EventCreationAttributes>(Event);
    this.mappingRepo = new BaseRepository<CalendarMapping, CalendarMappingAttributes, CalendarMappingCreationAttributes>(CalendarMapping);
  }

  // Helper method to build event where clause from filter
  private buildEventWhereClause(filter?: EventQueryFilter): WhereOptions<EventAttributes> {
    const whereClause: any = {};

    if (filter?.event_id) {
      whereClause.event_id = filter.event_id;
    }

    if (filter?.region) {
      whereClause.region = filter.region;
    }

    if (filter?.calendar_type) {
      whereClause.calendar_type = filter.calendar_type;
    }

    if (filter?.status) {
      whereClause.status = filter.status;
    }

    if (filter?.date_range) {
      whereClause.start_date = {
        [Op.between]: [filter.date_range.start, filter.date_range.end]
      };
    }

    if (filter?.updated_since) {
      whereClause.updated_at = {
        [Op.gte]: filter.updated_since
      };
    }

    return whereClause;
  }

  // Helper method to build mapping where clause from filter
  private buildMappingWhereClause(filter?: CalendarMappingQueryFilter): WhereOptions<CalendarMappingAttributes> {
    const whereClause: any = {};

    if (filter?.event_id) {
      whereClause.event_id = filter.event_id;
    }

    if (filter?.region) {
      whereClause.region = filter.region;
    }

    if (filter?.date_range) {
      whereClause.original_date = {
        [Op.between]: [filter.date_range.start, filter.date_range.end]
      };
    }

    return whereClause;
  }

  // Event operations
  async findEventById(id: number, transaction?: Transaction): Promise<Event | null> {
    return await this.eventRepo.findById(id, transaction);
  }

  async findEventByEventId(eventId: string, region: string, calendarType: string, transaction?: Transaction): Promise<Event | null> {
    return await this.eventRepo.findOne({
      where: { event_id: eventId, region, calendar_type: calendarType }
    }, transaction);
  }

  async findEventsByRegion(region: string, filter?: EventQueryFilter, transaction?: Transaction): Promise<Event[]> {
    const whereClause = this.buildEventWhereClause(filter);
    (whereClause as any).region = region;

    return await this.eventRepo.findAll({
      where: whereClause,
      limit: filter?.limit,
      offset: filter?.offset,
      order: filter?.order || [['start_date', 'ASC']]
    }, transaction);
  }

  async findEventsByCalendarType(calendarType: string, filter?: EventQueryFilter, transaction?: Transaction): Promise<Event[]> {
    const whereClause = this.buildEventWhereClause(filter);
    (whereClause as any).calendar_type = calendarType;

    return await this.eventRepo.findAll({
      where: whereClause,
      limit: filter?.limit,
      offset: filter?.offset,
      order: filter?.order || [['start_date', 'ASC']]
    }, transaction);
  }

  async findEventsByDateRange(startDate: Date, endDate: Date, filter?: EventQueryFilter, transaction?: Transaction): Promise<Event[]> {
    const whereClause = this.buildEventWhereClause(filter);
    (whereClause as any).start_date = {
      [Op.between]: [startDate, endDate]
    };

    return await this.eventRepo.findAll({
      where: whereClause,
      limit: filter?.limit,
      offset: filter?.offset,
      order: filter?.order || [['start_date', 'ASC']]
    }, transaction);
  }

  async findEventsUpdatedSince(timestamp: Date, filter?: EventQueryFilter, transaction?: Transaction): Promise<Event[]> {
    const whereClause = this.buildEventWhereClause(filter);
    (whereClause as any).updated_at = {
      [Op.gte]: timestamp
    };

    return await this.eventRepo.findAll({
      where: whereClause,
      limit: filter?.limit,
      offset: filter?.offset,
      order: filter?.order || [['updated_at', 'DESC']]
    }, transaction);
  }

  async createEvent(data: EventCreationAttributes, transaction?: Transaction): Promise<Event> {
    return await this.eventRepo.create(data, transaction);
  }

  async updateEvent(id: number, data: Partial<EventAttributes>, transaction?: Transaction): Promise<Event | null> {
    return await this.eventRepo.update(id, data, transaction);
  }

  async upsertEvent(data: EventCreationAttributes & { id?: number }, transaction?: Transaction): Promise<[Event, boolean]> {
    return await this.eventRepo.upsert(data, transaction);
  }

  async deleteEvent(id: number, transaction?: Transaction): Promise<boolean> {
    return await this.eventRepo.delete(id, transaction);
  }

  // Calendar mapping operations
  async findMappingById(id: number, transaction?: Transaction): Promise<CalendarMapping | null> {
    return await this.mappingRepo.findById(id, transaction);
  }

  async findMappingByEventId(eventId: string, region: string, transaction?: Transaction): Promise<CalendarMapping | null> {
    return await this.mappingRepo.findOne({
      where: { event_id: eventId, region }
    }, transaction);
  }

  async findMappingsByRegion(region: string, filter?: CalendarMappingQueryFilter, transaction?: Transaction): Promise<CalendarMapping[]> {
    const whereClause = this.buildMappingWhereClause(filter);
    (whereClause as any).region = region;

    return await this.mappingRepo.findAll({
      where: whereClause,
      limit: filter?.limit,
      offset: filter?.offset,
      order: filter?.order || [['original_date', 'ASC']]
    }, transaction);
  }

  async createMapping(data: CalendarMappingCreationAttributes, transaction?: Transaction): Promise<CalendarMapping> {
    return await this.mappingRepo.create(data, transaction);
  }

  async updateMapping(id: number, data: Partial<CalendarMappingAttributes>, transaction?: Transaction): Promise<CalendarMapping | null> {
    return await this.mappingRepo.update(id, data, transaction);
  }

  async upsertMapping(data: CalendarMappingCreationAttributes & { id?: number }, transaction?: Transaction): Promise<[CalendarMapping, boolean]> {
    return await this.mappingRepo.upsert(data, transaction);
  }

  async deleteMapping(id: number, transaction?: Transaction): Promise<boolean> {
    return await this.mappingRepo.delete(id, transaction);
  }

  // Combined operations
  async findEventWithMapping(eventId: string, region: string, calendarType: string, transaction?: Transaction): Promise<EventWithMapping | null> {
    const event = await this.findEventByEventId(eventId, region, calendarType, transaction);
    if (!event) {
      return null;
    }

    const mapping = await this.findMappingByEventId(eventId, region, transaction);
    
    return { event, mapping };
  }

  async createEventWithMapping(
    eventData: EventCreationAttributes, 
    mappingData: CalendarMappingCreationAttributes, 
    transaction?: Transaction
  ): Promise<EventWithMapping> {
    const useTransaction = transaction || await this.eventRepo.startTransaction();
    let shouldCommit = false;

    if (!transaction) {
      shouldCommit = true;
    }

    try {
      const event = await this.createEvent(eventData, useTransaction);
      const mapping = await this.createMapping({
        ...mappingData,
        event_id: event.event_id
      }, useTransaction);

      if (shouldCommit) {
        await useTransaction.commit();
      }

      return { event, mapping };
    } catch (error) {
      if (shouldCommit) {
        await useTransaction.rollback();
      }
      throw error;
    }
  }

  // Bulk operations
  async bulkUpsertEvents(events: EventCreationAttributes[], transaction?: Transaction): Promise<Event[]> {
    const results: Event[] = [];
    const useTransaction = transaction || await this.eventRepo.startTransaction();
    let shouldCommit = false;

    if (!transaction) {
      shouldCommit = true;
    }

    try {
      for (const eventData of events) {
        const [event] = await this.upsertEvent(eventData, useTransaction);
        results.push(event);
      }

      if (shouldCommit) {
        await useTransaction.commit();
      }

      return results;
    } catch (error) {
      if (shouldCommit) {
        await useTransaction.rollback();
      }
      throw error;
    }
  }

  async bulkUpsertMappings(mappings: CalendarMappingCreationAttributes[], transaction?: Transaction): Promise<CalendarMapping[]> {
    const results: CalendarMapping[] = [];
    const useTransaction = transaction || await this.mappingRepo.startTransaction();
    let shouldCommit = false;

    if (!transaction) {
      shouldCommit = true;
    }

    try {
      for (const mappingData of mappings) {
        const [mapping] = await this.upsertMapping(mappingData, useTransaction);
        results.push(mapping);
      }

      if (shouldCommit) {
        await useTransaction.commit();
      }

      return results;
    } catch (error) {
      if (shouldCommit) {
        await useTransaction.rollback();
      }
      throw error;
    }
  }

  // Analytics and filtering
  async getEventCountByRegion(region: string, filter?: EventQueryFilter, transaction?: Transaction): Promise<number> {
    const whereClause = this.buildEventWhereClause(filter);
    (whereClause as any).region = region;

    return await this.eventRepo.count({ where: whereClause }, transaction);
  }

  async getEventCountByCalendarType(calendarType: string, filter?: EventQueryFilter, transaction?: Transaction): Promise<number> {
    const whereClause = this.buildEventWhereClause(filter);
    (whereClause as any).calendar_type = calendarType;

    return await this.eventRepo.count({ where: whereClause }, transaction);
  }

  async getEventsGroupedByStatus(filter?: EventQueryFilter, transaction?: Transaction): Promise<Record<string, number>> {
    try {
      const whereClause = this.buildEventWhereClause(filter);

      const events = await this.eventRepo.findAll({
        where: whereClause
      }, transaction);

      const groupedByStatus: Record<string, number> = {};
      
      for (const event of events) {
        const status = event.status;
        groupedByStatus[status] = (groupedByStatus[status] || 0) + 1;
      }

      return groupedByStatus;
    } catch (error) {
      throw new RepositoryError(
        `Failed to group events by status: ${(error as Error).message}`,
        'ANALYTICS_ERROR',
        error as Error
      );
    }
  }
}

// Export singleton instance
export const calendarRepository = new CalendarRepository();

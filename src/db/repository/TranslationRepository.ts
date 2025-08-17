import { Transaction, Op, WhereOptions } from 'sequelize';
import { BaseRepository, QueryFilter, RepositoryError } from './BaseRepository';
import EventTranslation from '../models/EventTranslation';

// EventTranslation-specific interfaces
export interface EventTranslationAttributes {
  id: number;
  event_id: string;
  language: string;
  title: string;
  description: string | null;
  location: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface EventTranslationCreationAttributes {
  event_id: string;
  language: string;
  title: string;
  description?: string | null;
  location?: string | null;
}

// Query filters for event translations
export interface TranslationQueryFilter extends QueryFilter<EventTranslationAttributes> {
  event_id?: string;
  language?: string;
  event_ids?: string[];
  languages?: string[];
  has_description?: boolean;
  has_location?: boolean;
  search_text?: string;
}

// Translation with event info
export interface TranslationWithEventInfo {
  translation: EventTranslation;
  eventInfo?: {
    region: string;
    calendar_type: string;
    start_date: Date;
    end_date: Date;
  };
}

// Bulk translation operations
export interface BulkTranslationOperation {
  event_id: string;
  translations: Record<string, {
    title: string;
    description?: string | null;
    location?: string | null;
  }>;
}

// Translation repository interface
export interface ITranslationRepository {
  // Basic CRUD operations
  findTranslationById(id: number, transaction?: Transaction): Promise<EventTranslation | null>;
  findTranslationByEventAndLanguage(eventId: string, language: string, transaction?: Transaction): Promise<EventTranslation | null>;
  findTranslationsByEventId(eventId: string, filter?: TranslationQueryFilter, transaction?: Transaction): Promise<EventTranslation[]>;
  findTranslationsByLanguage(language: string, filter?: TranslationQueryFilter, transaction?: Transaction): Promise<EventTranslation[]>;
  createTranslation(data: EventTranslationCreationAttributes, transaction?: Transaction): Promise<EventTranslation>;
  updateTranslation(id: number, data: Partial<EventTranslationAttributes>, transaction?: Transaction): Promise<EventTranslation | null>;
  upsertTranslation(data: EventTranslationCreationAttributes & { id?: number }, transaction?: Transaction): Promise<[EventTranslation, boolean]>;
  deleteTranslation(id: number, transaction?: Transaction): Promise<boolean>;
  
  // Advanced query operations
  findTranslationsByMultipleEvents(eventIds: string[], language?: string, transaction?: Transaction): Promise<EventTranslation[]>;
  findTranslationsByMultipleLanguages(eventId: string, languages: string[], transaction?: Transaction): Promise<EventTranslation[]>;
  searchTranslationsByText(searchText: string, language?: string, filter?: TranslationQueryFilter, transaction?: Transaction): Promise<EventTranslation[]>;
  findIncompleteTranslations(requiredFields: ('description' | 'location')[], filter?: TranslationQueryFilter, transaction?: Transaction): Promise<EventTranslation[]>;
  
  // Bulk operations
  createTranslationsForEvent(eventId: string, translations: Record<string, { title: string; description?: string | null; location?: string | null }>, transaction?: Transaction): Promise<EventTranslation[]>;
  bulkUpsertTranslations(translations: EventTranslationCreationAttributes[], transaction?: Transaction): Promise<EventTranslation[]>;
  bulkDeleteTranslationsByEventIds(eventIds: string[], transaction?: Transaction): Promise<number>;
  
  // Analytics and utility operations
  getAvailableLanguagesForEvent(eventId: string, transaction?: Transaction): Promise<string[]>;
  getTranslationCountByLanguage(language: string, filter?: TranslationQueryFilter, transaction?: Transaction): Promise<number>;
  getTranslationCompleteness(eventId: string, requiredLanguages: string[], transaction?: Transaction): Promise<{ language: string; hasTranslation: boolean }[]>;
  findEventsWithoutTranslation(language: string, eventIds?: string[], transaction?: Transaction): Promise<string[]>;
}

// Translation repository implementation
export class TranslationRepository implements ITranslationRepository {
  private translationRepo: BaseRepository<EventTranslation, EventTranslationAttributes, EventTranslationCreationAttributes>;

  constructor() {
    this.translationRepo = new BaseRepository<EventTranslation, EventTranslationAttributes, EventTranslationCreationAttributes>(EventTranslation);
  }

  // Helper method to build where clause from filter
  private buildWhereClause(filter?: TranslationQueryFilter): WhereOptions<EventTranslationAttributes> {
    const whereClause: any = {};

    if (filter?.event_id) {
      whereClause.event_id = filter.event_id;
    }

    if (filter?.language) {
      whereClause.language = filter.language;
    }

    if (filter?.event_ids && filter.event_ids.length > 0) {
      whereClause.event_id = {
        [Op.in]: filter.event_ids
      };
    }

    if (filter?.languages && filter.languages.length > 0) {
      whereClause.language = {
        [Op.in]: filter.languages
      };
    }

    if (filter?.has_description !== undefined) {
      if (filter.has_description) {
        whereClause.description = {
          [Op.ne]: null
        };
      } else {
        whereClause.description = null;
      }
    }

    if (filter?.has_location !== undefined) {
      if (filter.has_location) {
        whereClause.location = {
          [Op.ne]: null
        };
      } else {
        whereClause.location = null;
      }
    }

    if (filter?.search_text) {
      (whereClause as any)[Op.or] = [
        {
          title: {
            [Op.iLike]: `%${filter.search_text}%`
          }
        },
        {
          description: {
            [Op.iLike]: `%${filter.search_text}%`
          }
        },
        {
          location: {
            [Op.iLike]: `%${filter.search_text}%`
          }
        }
      ];
    }

    return whereClause;
  }

  // Basic CRUD operations
  async findTranslationById(id: number, transaction?: Transaction): Promise<EventTranslation | null> {
    return await this.translationRepo.findById(id, transaction);
  }

  async findTranslationByEventAndLanguage(eventId: string, language: string, transaction?: Transaction): Promise<EventTranslation | null> {
    return await this.translationRepo.findOne({
      where: { event_id: eventId, language }
    }, transaction);
  }

  async findTranslationsByEventId(eventId: string, filter?: TranslationQueryFilter, transaction?: Transaction): Promise<EventTranslation[]> {
    const whereClause = this.buildWhereClause(filter);
    (whereClause as any).event_id = eventId;

    return await this.translationRepo.findAll({
      where: whereClause,
      limit: filter?.limit,
      offset: filter?.offset,
      order: filter?.order || [['language', 'ASC']]
    }, transaction);
  }

  async findTranslationsByLanguage(language: string, filter?: TranslationQueryFilter, transaction?: Transaction): Promise<EventTranslation[]> {
    const whereClause = this.buildWhereClause(filter);
    (whereClause as any).language = language;

    return await this.translationRepo.findAll({
      where: whereClause,
      limit: filter?.limit,
      offset: filter?.offset,
      order: filter?.order || [['event_id', 'ASC']]
    }, transaction);
  }

  async createTranslation(data: EventTranslationCreationAttributes, transaction?: Transaction): Promise<EventTranslation> {
    return await this.translationRepo.create(data, transaction);
  }

  async updateTranslation(id: number, data: Partial<EventTranslationAttributes>, transaction?: Transaction): Promise<EventTranslation | null> {
    return await this.translationRepo.update(id, data, transaction);
  }

  async upsertTranslation(data: EventTranslationCreationAttributes & { id?: number }, transaction?: Transaction): Promise<[EventTranslation, boolean]> {
    return await this.translationRepo.upsert(data, transaction);
  }

  async deleteTranslation(id: number, transaction?: Transaction): Promise<boolean> {
    return await this.translationRepo.delete(id, transaction);
  }

  // Advanced query operations
  async findTranslationsByMultipleEvents(eventIds: string[], language?: string, transaction?: Transaction): Promise<EventTranslation[]> {
    const whereClause: WhereOptions<EventTranslationAttributes> = {
      event_id: {
        [Op.in]: eventIds
      }
    };

    if (language) {
      whereClause.language = language;
    }

    return await this.translationRepo.findAll({
      where: whereClause,
      order: [['event_id', 'ASC'], ['language', 'ASC']]
    }, transaction);
  }

  async findTranslationsByMultipleLanguages(eventId: string, languages: string[], transaction?: Transaction): Promise<EventTranslation[]> {
    return await this.translationRepo.findAll({
      where: {
        event_id: eventId,
        language: {
          [Op.in]: languages
        }
      },
      order: [['language', 'ASC']]
    }, transaction);
  }

  async searchTranslationsByText(searchText: string, language?: string, filter?: TranslationQueryFilter, transaction?: Transaction): Promise<EventTranslation[]> {
    const whereClause = this.buildWhereClause(filter);
    
    // Override with search text condition
    (whereClause as any)[Op.or] = [
      {
        title: {
          [Op.iLike]: `%${searchText}%`
        }
      },
      {
        description: {
          [Op.iLike]: `%${searchText}%`
        }
      },
      {
        location: {
          [Op.iLike]: `%${searchText}%`
        }
      }
    ];

    if (language) {
      (whereClause as any).language = language;
    }

    return await this.translationRepo.findAll({
      where: whereClause,
      limit: filter?.limit,
      offset: filter?.offset,
      order: filter?.order || [['event_id', 'ASC'], ['language', 'ASC']]
    }, transaction);
  }

  async findIncompleteTranslations(requiredFields: ('description' | 'location')[], filter?: TranslationQueryFilter, transaction?: Transaction): Promise<EventTranslation[]> {
    const whereClause = this.buildWhereClause(filter);
    
    const missingFieldConditions = requiredFields.map(field => ({
      [field]: null
    }));

    if (missingFieldConditions.length > 0) {
      (whereClause as any)[Op.or] = missingFieldConditions;
    }

    return await this.translationRepo.findAll({
      where: whereClause,
      limit: filter?.limit,
      offset: filter?.offset,
      order: filter?.order || [['event_id', 'ASC'], ['language', 'ASC']]
    }, transaction);
  }

  // Bulk operations
  async createTranslationsForEvent(
    eventId: string, 
    translations: Record<string, { title: string; description?: string | null; location?: string | null }>, 
    transaction?: Transaction
  ): Promise<EventTranslation[]> {
    const translationData: EventTranslationCreationAttributes[] = Object.entries(translations).map(([language, data]) => ({
      event_id: eventId,
      language,
      title: data.title,
      description: data.description,
      location: data.location
    }));

    const results: EventTranslation[] = [];
    const useTransaction = transaction || await this.translationRepo.startTransaction();
    let shouldCommit = false;

    if (!transaction) {
      shouldCommit = true;
    }

    try {
      for (const data of translationData) {
        const [translation] = await this.upsertTranslation(data, useTransaction);
        results.push(translation);
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

  async bulkUpsertTranslations(translations: EventTranslationCreationAttributes[], transaction?: Transaction): Promise<EventTranslation[]> {
    const results: EventTranslation[] = [];
    const useTransaction = transaction || await this.translationRepo.startTransaction();
    let shouldCommit = false;

    if (!transaction) {
      shouldCommit = true;
    }

    try {
      for (const translationData of translations) {
        const [translation] = await this.upsertTranslation(translationData, useTransaction);
        results.push(translation);
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

  async bulkDeleteTranslationsByEventIds(eventIds: string[], transaction?: Transaction): Promise<number> {
    return await this.translationRepo.deleteMany({
      where: {
        event_id: {
          [Op.in]: eventIds
        }
      }
    }, transaction);
  }

  // Analytics and utility operations
  async getAvailableLanguagesForEvent(eventId: string, transaction?: Transaction): Promise<string[]> {
    try {
      const translations = await this.findTranslationsByEventId(eventId, undefined, transaction);
      return translations.map(t => t.language).sort();
    } catch (error) {
      throw new RepositoryError(
        `Failed to get available languages for event ${eventId}: ${(error as Error).message}`,
        'ANALYTICS_ERROR',
        error as Error
      );
    }
  }

  async getTranslationCountByLanguage(language: string, filter?: TranslationQueryFilter, transaction?: Transaction): Promise<number> {
    const whereClause = this.buildWhereClause(filter);
    (whereClause as any).language = language;

    return await this.translationRepo.count({ where: whereClause }, transaction);
  }

  async getTranslationCompleteness(eventId: string, requiredLanguages: string[], transaction?: Transaction): Promise<{ language: string; hasTranslation: boolean }[]> {
    try {
      const existingTranslations = await this.findTranslationsByEventId(eventId, undefined, transaction);
      const existingLanguages = new Set(existingTranslations.map(t => t.language));

      return requiredLanguages.map(language => ({
        language,
        hasTranslation: existingLanguages.has(language)
      }));
    } catch (error) {
      throw new RepositoryError(
        `Failed to get translation completeness for event ${eventId}: ${(error as Error).message}`,
        'ANALYTICS_ERROR',
        error as Error
      );
    }
  }

  async findEventsWithoutTranslation(language: string, eventIds?: string[], transaction?: Transaction): Promise<string[]> {
    try {
      // Find all translations for the specified language
      const filter: TranslationQueryFilter = {
        language,
        ...(eventIds && { event_ids: eventIds })
      };

      const existingTranslations = await this.findTranslationsByLanguage(language, filter, transaction);
      const translatedEventIds = new Set(existingTranslations.map(t => t.event_id));

      if (eventIds) {
        // Return event IDs that don't have translations
        return eventIds.filter(eventId => !translatedEventIds.has(eventId));
      } else {
        // If no specific event IDs provided, we can't determine which events are missing translations
        // without querying the events table directly
        throw new RepositoryError(
          'Cannot find events without translation without specifying event IDs',
          'INVALID_OPERATION'
        );
      }
    } catch (error) {
      if (error instanceof RepositoryError) {
        throw error;
      }
      throw new RepositoryError(
        `Failed to find events without translation for language ${language}: ${(error as Error).message}`,
        'ANALYTICS_ERROR',
        error as Error
      );
    }
  }
}

// Export singleton instance
export const translationRepository = new TranslationRepository();

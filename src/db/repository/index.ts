// Base repository exports
export {
  BaseRepository,
  IBaseRepository,
  QueryFilter,
  PaginationOptions,
  PaginatedResult,
  RepositoryError
} from './BaseRepository';

// Calendar repository exports
export {
  CalendarRepository,
  ICalendarRepository,
  calendarRepository,
  EventAttributes,
  EventCreationAttributes,
  CalendarMappingAttributes,
  CalendarMappingCreationAttributes,
  EventQueryFilter,
  CalendarMappingQueryFilter,
  EventWithMapping
} from './CalendarRepository';

// Translation repository exports
export {
  TranslationRepository,
  ITranslationRepository,
  translationRepository,
  EventTranslationAttributes,
  EventTranslationCreationAttributes,
  TranslationQueryFilter,
  TranslationWithEventInfo,
  BulkTranslationOperation
} from './TranslationRepository';

// Update metadata repository exports
export {
  UpdateMetadataRepository,
  IUpdateMetadataRepository,
  updateMetadataRepository,
  UpdateMetadataAttributes,
  UpdateMetadataCreationAttributes,
  UpdateMetadataQueryFilter,
  UpdateOperationResult,
  BatchUpdateResult,
  UpdateStatistics
} from './UpdateMetadataRepository';

// Transaction manager exports
export {
  TransactionManager,
  TransactionUtils,
  transactionManager,
  IsolationLevel,
  TransactionOptions,
  TransactionResult,
  TransactionCallback,
  RetryPolicy,
  TransactionStats
} from './TransactionManager';

// Import the repository instances
import { calendarRepository } from './CalendarRepository';
import { translationRepository } from './TranslationRepository';
import { updateMetadataRepository } from './UpdateMetadataRepository';
import { transactionManager, TransactionUtils } from './TransactionManager';

// Repository factory for dependency injection
export class RepositoryFactory {
  static getCalendarRepository() {
    return calendarRepository;
  }

  static getTranslationRepository() {
    return translationRepository;
  }

  static getUpdateMetadataRepository() {
    return updateMetadataRepository;
  }

  static getTransactionManager() {
    return transactionManager;
  }
}

// Convenience exports for common operations
export const repositories = {
  calendar: calendarRepository,
  translation: translationRepository,
  updateMetadata: updateMetadataRepository
};

export const transaction = {
  manager: transactionManager,
  utils: TransactionUtils
};

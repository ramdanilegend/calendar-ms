import EventTranslation from '../db/models/EventTranslation';
import Event from '../db/models/Event';

/**
 * Supported language codes
 */
export enum LanguageCode {
  INDONESIAN = 'id',
  ENGLISH = 'en', 
  ARABIC = 'ar'
}

/**
 * Translation data interface
 */
export interface TranslationData {
  title: string;
  description?: string;
  location?: string;
}

/**
 * Translation result with metadata
 */
export interface TranslationResult {
  eventId: string;
  language: LanguageCode;
  data: TranslationData;
  fallbackUsed: boolean;
  cached: boolean;
  updatedAt: Date;
}

/**
 * Translation creation input
 */
export interface CreateTranslationInput {
  eventId: string;
  language: LanguageCode;
  title: string;
  description?: string;
  location?: string;
}

/**
 * Translation update input
 */
export interface UpdateTranslationInput extends Partial<TranslationData> {
  eventId: string;
  language: LanguageCode;
}

/**
 * Translation cache entry
 */
interface CacheEntry {
  data: TranslationResult;
  timestamp: number;
  accessCount: number;
}

/**
 * Translation service options
 */
export interface TranslationServiceOptions {
  cacheEnabled?: boolean;
  cacheTTL?: number; // milliseconds
  maxCacheSize?: number;
  fallbackLanguage?: LanguageCode;
  enableLogging?: boolean;
}

/**
 * Translation service for managing event localization
 */
export class TranslationService {
  private cache = new Map<string, CacheEntry>();
  private readonly options: Required<TranslationServiceOptions>;
  private cacheCleanupInterval: NodeJS.Timeout | null = null;

  constructor(options: TranslationServiceOptions = {}) {
    this.options = {
      cacheEnabled: options.cacheEnabled ?? true,
      cacheTTL: options.cacheTTL ?? 300000, // 5 minutes
      maxCacheSize: options.maxCacheSize ?? 1000,
      fallbackLanguage: options.fallbackLanguage ?? LanguageCode.ENGLISH,
      enableLogging: options.enableLogging ?? true
    };

    if (this.options.cacheEnabled) {
      this.startCacheCleanup();
    }
  }

  /**
   * Validate language code
   */
  public isValidLanguageCode(language: string): language is LanguageCode {
    return Object.values(LanguageCode).includes(language as LanguageCode);
  }

  /**
   * Get translation for an event in specified language
   */
  public async getTranslation(
    eventId: string,
    language: LanguageCode
  ): Promise<TranslationResult | null> {
    // Validate inputs
    if (!eventId || !this.isValidLanguageCode(language)) {
      throw new Error('Invalid eventId or language code');
    }

    const cacheKey = `${eventId}:${language}`;

    // Check cache first
    if (this.options.cacheEnabled) {
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        this.log(`Cache hit for ${cacheKey}`);
        return cached;
      }
    }

    try {
      // Try to get translation from database
      const translation = await EventTranslation.findOne({
        where: {
          event_id: eventId,
          language: language
        }
      });

      if (translation) {
        const result: TranslationResult = {
          eventId,
          language,
          data: {
            title: translation.title,
            description: translation.description || undefined,
            location: translation.location || undefined
          },
          fallbackUsed: false,
          cached: false,
          updatedAt: translation.updated_at
        };

        // Cache the result
        if (this.options.cacheEnabled) {
          this.addToCache(cacheKey, result);
        }

        this.log(`Translation found for ${cacheKey}`);
        return result;
      }

      // Try fallback language if original language not found
      return await this.getFallbackTranslation(eventId, language);

    } catch (error) {
      this.log(`Error getting translation for ${cacheKey}: ${error}`, 'error');
      throw error;
    }
  }

  /**
   * Get multiple translations for an event
   */
  public async getTranslations(
    eventId: string,
    languages: LanguageCode[]
  ): Promise<TranslationResult[]> {
    const results: TranslationResult[] = [];

    for (const language of languages) {
      const translation = await this.getTranslation(eventId, language);
      if (translation) {
        results.push(translation);
      }
    }

    return results;
  }

  /**
   * Get all available translations for an event
   */
  public async getAllTranslations(eventId: string): Promise<TranslationResult[]> {
    try {
      const translations = await EventTranslation.findAll({
        where: { event_id: eventId }
      });

      return translations.map(translation => ({
        eventId,
        language: translation.language as LanguageCode,
        data: {
          title: translation.title,
          description: translation.description || undefined,
          location: translation.location || undefined
        },
        fallbackUsed: false,
        cached: false,
        updatedAt: translation.updated_at
      }));

    } catch (error) {
      this.log(`Error getting all translations for ${eventId}: ${error}`, 'error');
      throw error;
    }
  }

  /**
   * Create or update translation
   */
  public async upsertTranslation(input: CreateTranslationInput): Promise<TranslationResult> {
    // Validate inputs
    if (!input.eventId || !this.isValidLanguageCode(input.language) || !input.title) {
      throw new Error('Invalid input: eventId, language, and title are required');
    }

    // Verify event exists
    const eventExists = await Event.findOne({ where: { event_id: input.eventId } });
    if (!eventExists) {
      throw new Error(`Event ${input.eventId} not found`);
    }

    try {
      const [translation] = await EventTranslation.upsert({
        event_id: input.eventId,
        language: input.language,
        title: input.title,
        description: input.description || null,
        location: input.location || null
      });

      const result: TranslationResult = {
        eventId: input.eventId,
        language: input.language,
        data: {
          title: translation.title,
          description: translation.description || undefined,
          location: translation.location || undefined
        },
        fallbackUsed: false,
        cached: false,
        updatedAt: translation.updated_at
      };

      // Invalidate cache
      if (this.options.cacheEnabled) {
        this.invalidateCache(`${input.eventId}:${input.language}`);
      }

      this.log(`Translation upserted for ${input.eventId}:${input.language}`);
      return result;

    } catch (error) {
      this.log(`Error upserting translation: ${error}`, 'error');
      throw error;
    }
  }

  /**
   * Update existing translation
   */
  public async updateTranslation(input: UpdateTranslationInput): Promise<TranslationResult | null> {
    const existing = await this.getTranslation(input.eventId, input.language);
    if (!existing) {
      return null;
    }

    const updateData: CreateTranslationInput = {
      eventId: input.eventId,
      language: input.language,
      title: input.title || existing.data.title,
      description: input.description !== undefined ? input.description : existing.data.description,
      location: input.location !== undefined ? input.location : existing.data.location
    };

    return await this.upsertTranslation(updateData);
  }

  /**
   * Delete translation
   */
  public async deleteTranslation(eventId: string, language: LanguageCode): Promise<boolean> {
    try {
      const deleted = await EventTranslation.destroy({
        where: {
          event_id: eventId,
          language: language
        }
      });

      if (deleted > 0) {
        // Invalidate cache
        if (this.options.cacheEnabled) {
          this.invalidateCache(`${eventId}:${language}`);
        }
        this.log(`Translation deleted for ${eventId}:${language}`);
        return true;
      }

      return false;

    } catch (error) {
      this.log(`Error deleting translation: ${error}`, 'error');
      throw error;
    }
  }

  /**
   * Get fallback translation when preferred language is not available
   */
  private async getFallbackTranslation(
    eventId: string,
    originalLanguage: LanguageCode
  ): Promise<TranslationResult | null> {
    if (originalLanguage === this.options.fallbackLanguage) {
      this.log(`No translation found for ${eventId}:${originalLanguage} and no fallback available`);
      return null;
    }

    this.log(`Attempting fallback to ${this.options.fallbackLanguage} for ${eventId}`);

    const fallbackTranslation = await EventTranslation.findOne({
      where: {
        event_id: eventId,
        language: this.options.fallbackLanguage
      }
    });

    if (fallbackTranslation) {
      const result: TranslationResult = {
        eventId,
        language: originalLanguage,
        data: {
          title: fallbackTranslation.title,
          description: fallbackTranslation.description || undefined,
          location: fallbackTranslation.location || undefined
        },
        fallbackUsed: true,
        cached: false,
        updatedAt: fallbackTranslation.updated_at
      };

      this.log(`Fallback translation found for ${eventId}:${originalLanguage}`);
      return result;
    }

    this.log(`No fallback translation found for ${eventId}`);
    return null;
  }

  /**
   * Format text with basic transformations
   */
  public formatText(text: string, language: LanguageCode): string {
    if (!text) return text;

    // Basic text formatting based on language
    switch (language) {
      case LanguageCode.ARABIC:
        // Ensure proper RTL formatting
        return text.trim();
      case LanguageCode.INDONESIAN:
      case LanguageCode.ENGLISH:
      default:
        return text.trim();
    }
  }

  /**
   * Get cache statistics
   */
  public getCacheStats() {
    return {
      size: this.cache.size,
      maxSize: this.options.maxCacheSize,
      enabled: this.options.cacheEnabled,
      ttl: this.options.cacheTTL
    };
  }

  /**
   * Clear entire cache
   */
  public clearCache(): void {
    this.cache.clear();
    this.log('Translation cache cleared');
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    if (this.cacheCleanupInterval) {
      clearInterval(this.cacheCleanupInterval);
    }
    this.clearCache();
  }

  // Private cache methods
  private getFromCache(key: string): TranslationResult | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > this.options.cacheTTL) {
      this.cache.delete(key);
      return null;
    }

    entry.accessCount++;
    return { ...entry.data, cached: true };
  }

  private addToCache(key: string, data: TranslationResult): void {
    // Evict least recently used items if cache is full
    if (this.cache.size >= this.options.maxCacheSize) {
      this.evictLRU();
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      accessCount: 1
    });
  }

  private invalidateCache(key: string): void {
    this.cache.delete(key);
  }

  private evictLRU(): void {
    let lruKey = '';
    let lruCount = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.accessCount < lruCount) {
        lruCount = entry.accessCount;
        lruKey = key;
      }
    }

    if (lruKey) {
      this.cache.delete(lruKey);
    }
  }

  private startCacheCleanup(): void {
    this.cacheCleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.cache.entries()) {
        if (now - entry.timestamp > this.options.cacheTTL) {
          this.cache.delete(key);
        }
      }
    }, this.options.cacheTTL / 2);
  }

  /**
   * Stop cache cleanup and clear resources
   */
  public cleanup(): void {
    if (this.cacheCleanupInterval) {
      clearInterval(this.cacheCleanupInterval);
      this.cacheCleanupInterval = null;
    }
    this.cache.clear();
  }

  private log(message: string, level: 'info' | 'error' = 'info'): void {
    if (this.options.enableLogging) {
      const timestamp = new Date().toISOString();
      console[level](`[TranslationService ${timestamp}] ${message}`);
    }
  }
}

// Export singleton instance - disable cache cleanup in test environment
export const translationService = new TranslationService({
  cacheEnabled: process.env.NODE_ENV !== 'test'
});

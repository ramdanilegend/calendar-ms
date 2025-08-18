import { Request, Response, NextFunction } from 'express';
import { 
  translationService, 
  LanguageCode, 
  CreateTranslationInput, 
  UpdateTranslationInput 
} from '../../services/translation';
import { 
  sendSuccessResponse, 
  sendErrorResponse 
} from '../utils/responseFormatter';

/**
 * GET /events/:eventId/translations
 * Get all translations for a specific event
 */
export const getEventTranslations = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { eventId } = req.params;

    if (!eventId) {
      return sendErrorResponse(res, 'Event ID is required', 400);
    }

    const translations = await translationService.getAllTranslations(eventId);
    
    sendSuccessResponse(res, {
      eventId,
      translations,
      count: translations.length
    });

  } catch (error) {
    next(error);
  }
};

/**
 * GET /events/:eventId/translations/:language
 * Get translation for a specific event in a specific language
 */
export const getEventTranslation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { eventId, language } = req.params;

    if (!eventId || !language) {
      return sendErrorResponse(res, 'Event ID and language are required', 400);
    }

    if (!translationService.isValidLanguageCode(language)) {
      return sendErrorResponse(res, `Invalid language code. Supported: ${Object.values(LanguageCode).join(', ')}`, 400);
    }

    const translation = await translationService.getTranslation(eventId, language as LanguageCode);
    
    if (!translation) {
      return sendErrorResponse(res, `Translation not found for event ${eventId} in language ${language}`, 404);
    }

    sendSuccessResponse(res, translation);

  } catch (error) {
    next(error);
  }
};

/**
 * POST /events/:eventId/translations
 * Create or update translation for an event
 */
export const createEventTranslation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { eventId } = req.params;
    const { language, title, description, location } = req.body;

    if (!eventId) {
      return sendErrorResponse(res, 'Event ID is required', 400);
    }

    if (!language || !title) {
      return sendErrorResponse(res, 'Language and title are required', 400);
    }

    if (!translationService.isValidLanguageCode(language)) {
      return sendErrorResponse(res, `Invalid language code. Supported: ${Object.values(LanguageCode).join(', ')}`, 400);
    }

    const input: CreateTranslationInput = {
      eventId,
      language: language as LanguageCode,
      title,
      description,
      location
    };

    const translation = await translationService.upsertTranslation(input);
    
    res.status(201);
    sendSuccessResponse(res, translation);

  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      return sendErrorResponse(res, error.message, 404);
    }
    next(error);
  }
};

/**
 * PUT /events/:eventId/translations/:language
 * Update existing translation for an event
 */
export const updateEventTranslation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { eventId, language } = req.params;
    const { title, description, location } = req.body;

    if (!eventId || !language) {
      return sendErrorResponse(res, 'Event ID and language are required', 400);
    }

    if (!translationService.isValidLanguageCode(language)) {
      return sendErrorResponse(res, `Invalid language code. Supported: ${Object.values(LanguageCode).join(', ')}`, 400);
    }

    const input: UpdateTranslationInput = {
      eventId,
      language: language as LanguageCode,
      title,
      description,
      location
    };

    const translation = await translationService.updateTranslation(input);
    
    if (!translation) {
      return sendErrorResponse(res, `Translation not found for event ${eventId} in language ${language}`, 404);
    }

    sendSuccessResponse(res, translation);

  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /events/:eventId/translations/:language
 * Delete translation for an event
 */
export const deleteEventTranslation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { eventId, language } = req.params;

    if (!eventId || !language) {
      return sendErrorResponse(res, 'Event ID and language are required', 400);
    }

    if (!translationService.isValidLanguageCode(language)) {
      return sendErrorResponse(res, `Invalid language code. Supported: ${Object.values(LanguageCode).join(', ')}`, 400);
    }

    const deleted = await translationService.deleteTranslation(eventId, language as LanguageCode);
    
    if (!deleted) {
      return sendErrorResponse(res, `Translation not found for event ${eventId} in language ${language}`, 404);
    }

    sendSuccessResponse(res, { 
      message: 'Translation deleted successfully',
      eventId,
      language 
    });

  } catch (error) {
    next(error);
  }
};

/**
 * GET /events/:eventId/translations/:language/formatted
 * Get formatted translation text for a specific language
 */
export const getFormattedTranslation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { eventId, language } = req.params;

    if (!eventId || !language) {
      return sendErrorResponse(res, 'Event ID and language are required', 400);
    }

    if (!translationService.isValidLanguageCode(language)) {
      return sendErrorResponse(res, `Invalid language code. Supported: ${Object.values(LanguageCode).join(', ')}`, 400);
    }

    const translation = await translationService.getTranslation(eventId, language as LanguageCode);
    
    if (!translation) {
      return sendErrorResponse(res, `Translation not found for event ${eventId} in language ${language}`, 404);
    }

    // Apply text formatting
    const formattedData = {
      title: translationService.formatText(translation.data.title, language as LanguageCode),
      description: translation.data.description ? 
        translationService.formatText(translation.data.description, language as LanguageCode) : 
        undefined,
      location: translation.data.location ? 
        translationService.formatText(translation.data.location, language as LanguageCode) : 
        undefined
    };

    sendSuccessResponse(res, {
      ...translation,
      data: formattedData
    });

  } catch (error) {
    next(error);
  }
};

/**
 * GET /translations/cache/stats
 * Get translation cache statistics
 */
export const getCacheStats = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const stats = translationService.getCacheStats();
    sendSuccessResponse(res, stats);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /translations/cache/clear
 * Clear translation cache
 */
export const clearCache = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    translationService.clearCache();
    sendSuccessResponse(res, { message: 'Translation cache cleared successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * Calendar Conversion Service
 * Handles conversion between Gregorian, Hijri, and regional calendar variants
 */

const { HijriJs } = require('hijri-js');
import {
  CalendarType,
  Region,
  GregorianDate,
  HijriDate,
  ConversionResult,
  RegionalMapping,
  ConversionOptions,
  DateValidationResult,
  ConversionError as ConversionErrorType
} from './types';

export class CalendarConverter {
  private regionalMappings: Map<Region, RegionalMapping> = new Map();
  private logger: Console;
  private hijri: any;

  constructor() {
    this.logger = console;
    this.hijri = new HijriJs();
    this.initializeRegionalMappings();
  }

  /**
   * Initialize regional calendar mappings
   */
  private initializeRegionalMappings(): void {
    // Global standard Hijri calendar (Saudi Arabia based)
    this.regionalMappings.set(Region.GLOBAL, {
      region: Region.GLOBAL,
      adjustmentDays: 0,
      rukyatBased: false,
      description: 'Standard Umm al-Qura calendar (Saudi Arabia)'
    });

    // Indonesian rukyat-based calendar
    this.regionalMappings.set(Region.INDONESIA, {
      region: Region.INDONESIA,
      adjustmentDays: -1, // Often 1 day earlier due to local sighting
      rukyatBased: true,
      description: 'Indonesian rukyat-based Islamic calendar'
    });

    // Saudi Arabia (same as global)
    this.regionalMappings.set(Region.SAUDI_ARABIA, {
      region: Region.SAUDI_ARABIA,
      adjustmentDays: 0,
      rukyatBased: false,
      description: 'Official Saudi Arabian Umm al-Qura calendar'
    });

    // Malaysia
    this.regionalMappings.set(Region.MALAYSIA, {
      region: Region.MALAYSIA,
      adjustmentDays: 0,
      rukyatBased: true,
      description: 'Malaysian Islamic calendar with local adjustments'
    });
  }

  /**
   * Convert Gregorian date to Hijri date
   */
  public gregorianToHijri(
    gregorianDate: GregorianDate,
    options: ConversionOptions = {}
  ): ConversionResult {
    try {
      this.logger.log(`Converting Gregorian date: ${gregorianDate.year}-${gregorianDate.month}-${gregorianDate.day}`);
      
      // Validate input
      const validation = this.validateGregorianDate(gregorianDate);
      if (!validation.isValid && options.strict) {
        throw new ConversionError(
          `Invalid Gregorian date: ${validation.errors.join(', ')}`,
          'INVALID_GREGORIAN_DATE',
          gregorianDate,
          CalendarType.HIJRI
        );
      }

      const region = options.region || Region.GLOBAL;
      const mapping = this.regionalMappings.get(region);
      
      if (!mapping && !options.allowFallback) {
        throw new ConversionError(
          `No mapping available for region: ${region}`,
          'NO_REGIONAL_MAPPING',
          gregorianDate,
          CalendarType.HIJRI
        );
      }

      // Core conversion using hijri-js
      const hijriResult = this.hijri.gregorianToHijri(
        gregorianDate.year,
        gregorianDate.month,
        gregorianDate.day,
        '/'
      );

      let hijriDate: HijriDate = {
        year: hijriResult.year,
        month: hijriResult.month,
        day: hijriResult.day
      };

      // Apply regional adjustments
      let fallbackUsed = false;
      let confidence: 'high' | 'medium' | 'low' = 'high';
      let notes = '';

      if (mapping) {
        if (mapping.adjustmentDays !== 0) {
          hijriDate = this.adjustHijriDate(hijriDate, mapping.adjustmentDays);
          confidence = mapping.rukyatBased ? 'medium' : 'high';
          notes = mapping.rukyatBased ? 'Adjusted for local sighting practices' : '';
        }
      } else {
        // Use fallback (global mapping)
        fallbackUsed = true;
        confidence = 'low';
        notes = 'Using fallback global mapping';
        this.logger.warn(`Using fallback mapping for region: ${region}`);
      }

      // Add month names if requested
      if (options.includeMonthNames) {
        hijriDate.monthName = this.getHijriMonthName(hijriDate.month);
      }

      const result: ConversionResult = {
        originalDate: gregorianDate,
        convertedDate: hijriDate,
        sourceCalendar: CalendarType.GREGORIAN,
        targetCalendar: region === Region.INDONESIA ? CalendarType.HIJRI_INDONESIA : CalendarType.HIJRI,
        region,
        confidence,
        notes,
        fallbackUsed
      };

      this.logger.log(`Conversion result: ${hijriDate.year}-${hijriDate.month}-${hijriDate.day} (${confidence} confidence)`);
      return result;

    } catch (error) {
      this.logger.error('Error converting Gregorian to Hijri:', error);
      if (error instanceof ConversionError) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new ConversionError(
        `Conversion failed: ${errorMessage}`,
        'CONVERSION_FAILED',
        gregorianDate,
        CalendarType.HIJRI
      );
    }
  }

  /**
   * Convert Hijri date to Gregorian date
   */
  public hijriToGregorian(
    hijriDate: HijriDate,
    options: ConversionOptions = {}
  ): ConversionResult {
    try {
      this.logger.log(`Converting Hijri date: ${hijriDate.year}-${hijriDate.month}-${hijriDate.day}`);

      // Validate input
      const validation = this.validateHijriDate(hijriDate);
      if (!validation.isValid && options.strict) {
        throw new ConversionError(
          `Invalid Hijri date: ${validation.errors.join(', ')}`,
          'INVALID_HIJRI_DATE',
          hijriDate,
          CalendarType.GREGORIAN
        );
      }

      const region = options.region || Region.GLOBAL;
      const mapping = this.regionalMappings.get(region);
      
      // Apply reverse regional adjustments before conversion
      let adjustedHijriDate = hijriDate;
      if (mapping && mapping.adjustmentDays !== 0) {
        adjustedHijriDate = this.adjustHijriDate(hijriDate, -mapping.adjustmentDays);
      }

      // Core conversion using hijri-js
      const gregorianResult = this.hijri.hijriToGregorian(
        adjustedHijriDate.year,
        adjustedHijriDate.month,
        adjustedHijriDate.day,
        '/'
      );
      
      // Parse the gregorian result (it returns a Date object)
      const gregorianDate: GregorianDate = {
        year: gregorianResult.getFullYear(),
        month: gregorianResult.getMonth() + 1,
        day: gregorianResult.getDate()
      };

      let fallbackUsed = false;
      let confidence: 'high' | 'medium' | 'low' = 'high';
      let notes = '';

      if (!mapping && options.allowFallback) {
        fallbackUsed = true;
        confidence = 'low';
        notes = 'Using fallback global mapping';
      } else if (mapping && mapping.rukyatBased) {
        confidence = 'medium';
        notes = 'Reverse-adjusted for local sighting practices';
      }

      const result: ConversionResult = {
        originalDate: hijriDate,
        convertedDate: gregorianDate,
        sourceCalendar: CalendarType.HIJRI,
        targetCalendar: CalendarType.GREGORIAN,
        region,
        confidence,
        notes,
        fallbackUsed
      };

      this.logger.log(`Conversion result: ${gregorianDate.year}-${gregorianDate.month}-${gregorianDate.day} (${confidence} confidence)`);
      return result;

    } catch (error) {
      this.logger.error('Error converting Hijri to Gregorian:', error);
      if (error instanceof ConversionError) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new ConversionError(
        `Conversion failed: ${errorMessage}`,
        'CONVERSION_FAILED',
        hijriDate,
        CalendarType.GREGORIAN
      );
    }
  }

  /**
   * Handle Indonesia's rukyat-based calendar conversion
   */
  public convertForIndonesia(
    gregorianDate: GregorianDate,
    options: ConversionOptions = {}
  ): ConversionResult {
    const indonesianOptions: ConversionOptions = {
      ...options,
      region: Region.INDONESIA,
      includeMonthNames: options.includeMonthNames ?? true
    };

    const result = this.gregorianToHijri(gregorianDate, indonesianOptions);
    result.notes = (result.notes ? result.notes + '. ' : '') + 
      'Indonesian rukyat-based calendar may vary based on local moon sighting.';
    
    return result;
  }

  /**
   * Validate Gregorian date
   */
  public validateGregorianDate(date: GregorianDate): DateValidationResult {
    const errors: string[] = [];

    if (!date.year || date.year < 1 || date.year > 9999) {
      errors.push('Year must be between 1 and 9999');
    }

    if (!date.month || date.month < 1 || date.month > 12) {
      errors.push('Month must be between 1 and 12');
    }

    if (!date.day || date.day < 1) {
      errors.push('Day must be greater than 0');
    }

    // Check for valid day in month
    if (date.month && date.day) {
      const daysInMonth = new Date(date.year, date.month, 0).getDate();
      if (date.day > daysInMonth) {
        errors.push(`Day ${date.day} is invalid for month ${date.month}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate Hijri date
   */
  public validateHijriDate(date: HijriDate): DateValidationResult {
    const errors: string[] = [];

    if (!date.year || date.year < 1 || date.year > 2000) {
      errors.push('Hijri year must be between 1 and 2000');
    }

    if (!date.month || date.month < 1 || date.month > 12) {
      errors.push('Month must be between 1 and 12');
    }

    if (!date.day || date.day < 1 || date.day > 30) {
      errors.push('Day must be between 1 and 30');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Adjust Hijri date by specified number of days
   */
  private adjustHijriDate(date: HijriDate, adjustmentDays: number): HijriDate {
    if (adjustmentDays === 0) return date;

    // Convert to Gregorian, adjust, then convert back
    const gregorianResult = this.hijri.hijriToGregorian(date.year, date.month, date.day, '/');
    
    const adjustedDate = new Date(gregorianResult);
    adjustedDate.setDate(adjustedDate.getDate() + adjustmentDays);

    const hijriResult = this.hijri.gregorianToHijri(
      adjustedDate.getFullYear(),
      adjustedDate.getMonth() + 1,
      adjustedDate.getDate(),
      '/'
    );

    return {
      year: hijriResult.year,
      month: hijriResult.month,
      day: hijriResult.day,
      monthName: date.monthName
    };
  }

  /**
   * Get Hijri month name
   */
  public getHijriMonthName(month: number): string {
    const monthNames = [
      'Muharram', 'Safar', "Rabi' al-awwal", "Rabi' al-thani",
      'Jumada al-awwal', 'Jumada al-thani', 'Rajab', "Sha'ban",
      'Ramadan', 'Shawwal', "Dhu al-Qi'dah", 'Dhu al-Hijjah'
    ];

    return monthNames[month - 1] || `Month ${month}`;
  }

  /**
   * Get available regions for conversion
   */
  public getAvailableRegions(): Region[] {
    return Array.from(this.regionalMappings.keys());
  }

  /**
   * Get regional mapping information
   */
  public getRegionalMapping(region: Region): RegionalMapping | undefined {
    return this.regionalMappings.get(region);
  }
}

/**
 * Custom error class for conversion errors
 */
class ConversionError extends Error implements ConversionErrorType {
  public code: string;
  public originalDate: GregorianDate | HijriDate;
  public targetCalendar: CalendarType;

  constructor(
    message: string,
    code: string,
    originalDate: GregorianDate | HijriDate,
    targetCalendar: CalendarType
  ) {
    super(message);
    this.name = 'ConversionError';
    this.code = code;
    this.originalDate = originalDate;
    this.targetCalendar = targetCalendar;
  }
}

// Export singleton instance
export const calendarConverter = new CalendarConverter();

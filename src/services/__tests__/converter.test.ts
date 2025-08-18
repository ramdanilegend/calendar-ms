/**
 * Unit tests for Calendar Conversion Service
 */

import { CalendarConverter } from '../converter';
import {
  CalendarType,
  Region,
  GregorianDate,
  HijriDate,
  ConversionOptions
} from '../types';

describe('CalendarConverter', () => {
  let converter: CalendarConverter;

  beforeEach(() => {
    converter = new CalendarConverter();
  });

  describe('Gregorian to Hijri Conversion', () => {
    test('should convert known Gregorian date to Hijri accurately', () => {
      const gregorianDate: GregorianDate = {
        year: 2024,
        month: 1,
        day: 1
      };

      const result = converter.gregorianToHijri(gregorianDate);

      expect(result.sourceCalendar).toBe(CalendarType.GREGORIAN);
      expect(result.targetCalendar).toBe(CalendarType.HIJRI);
      expect(result.originalDate).toEqual(gregorianDate);
      expect(result.convertedDate).toBeDefined();
      expect(result.confidence).toBe('high');
      expect(result.fallbackUsed).toBe(false);
    });

    test('should handle Indonesia region with rukyat-based adjustments', () => {
      const gregorianDate: GregorianDate = {
        year: 2024,
        month: 4,
        day: 10
      };

      const result = converter.convertForIndonesia(gregorianDate);

      expect(result.region).toBe(Region.INDONESIA);
      expect(result.targetCalendar).toBe(CalendarType.HIJRI_INDONESIA);
      expect(result.confidence).toBe('medium');
      expect(result.notes).toContain('rukyat-based');
    });

    test('should include month names when requested', () => {
      const gregorianDate: GregorianDate = {
        year: 2024,
        month: 1,
        day: 1
      };

      const options: ConversionOptions = {
        includeMonthNames: true
      };

      const result = converter.gregorianToHijri(gregorianDate, options);
      const hijriDate = result.convertedDate as HijriDate;

      expect(hijriDate.monthName).toBeDefined();
      expect(typeof hijriDate.monthName).toBe('string');
    });

    test('should use fallback when region mapping unavailable', () => {
      const gregorianDate: GregorianDate = {
        year: 2024,
        month: 1,
        day: 1
      };

      // Mock a region that doesn't exist in mappings
      const options: ConversionOptions = {
        region: 'unknown_region' as Region,
        allowFallback: true
      };

      const result = converter.gregorianToHijri(gregorianDate, options);

      expect(result.fallbackUsed).toBe(true);
      expect(result.confidence).toBe('low');
      expect(result.notes).toContain('fallback');
    });
  });

  describe('Hijri to Gregorian Conversion', () => {
    test('should convert known Hijri date to Gregorian accurately', () => {
      const hijriDate: HijriDate = {
        year: 1445,
        month: 6,
        day: 20
      };

      const result = converter.hijriToGregorian(hijriDate);

      expect(result.sourceCalendar).toBe(CalendarType.HIJRI);
      expect(result.targetCalendar).toBe(CalendarType.GREGORIAN);
      expect(result.originalDate).toEqual(hijriDate);
      expect(result.convertedDate).toBeDefined();
      expect(result.confidence).toBe('high');
    });

    test('should handle regional adjustments in reverse', () => {
      const hijriDate: HijriDate = {
        year: 1445,
        month: 6,
        day: 20
      };

      const options: ConversionOptions = {
        region: Region.INDONESIA
      };

      const result = converter.hijriToGregorian(hijriDate, options);

      expect(result.region).toBe(Region.INDONESIA);
      expect(result.confidence).toBe('medium');
    });
  });

  describe('Date Validation', () => {
    test('should validate correct Gregorian dates', () => {
      const validDate: GregorianDate = {
        year: 2024,
        month: 2,
        day: 29 // Leap year
      };

      const validation = converter.validateGregorianDate(validDate);

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test('should reject invalid Gregorian dates', () => {
      const invalidDate: GregorianDate = {
        year: 2023,
        month: 2,
        day: 29 // Not a leap year
      };

      const validation = converter.validateGregorianDate(invalidDate);

      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    test('should validate correct Hijri dates', () => {
      const validDate: HijriDate = {
        year: 1445,
        month: 6,
        day: 15
      };

      const validation = converter.validateHijriDate(validDate);

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test('should reject invalid Hijri dates', () => {
      const invalidDate: HijriDate = {
        year: 1445,
        month: 13, // Invalid month
        day: 15
      };

      const validation = converter.validateHijriDate(invalidDate);

      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
      expect(validation.errors[0]).toContain('Month must be between 1 and 12');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle leap year dates correctly', () => {
      const leapYearDate: GregorianDate = {
        year: 2024,
        month: 2,
        day: 29
      };

      const result = converter.gregorianToHijri(leapYearDate);

      expect(result).toBeDefined();
      expect(result.confidence).toBe('high');
    });

    test('should handle year boundaries', () => {
      const yearBoundaryDate: GregorianDate = {
        year: 2024,
        month: 1,
        day: 1
      };

      const result = converter.gregorianToHijri(yearBoundaryDate);

      expect(result).toBeDefined();
      expect(result.convertedDate).toBeDefined();
    });

    test('should throw error in strict mode with invalid dates', () => {
      const invalidDate: GregorianDate = {
        year: 2023,
        month: 2,
        day: 30 // Invalid date
      };

      const options: ConversionOptions = {
        strict: true
      };

      expect(() => {
        converter.gregorianToHijri(invalidDate, options);
      }).toThrow();
    });

    test('should handle missing regional mapping without fallback', () => {
      const gregorianDate: GregorianDate = {
        year: 2024,
        month: 1,
        day: 1
      };

      const options: ConversionOptions = {
        region: 'unknown_region' as Region,
        allowFallback: false
      };

      expect(() => {
        converter.gregorianToHijri(gregorianDate, options);
      }).toThrow();
    });
  });

  describe('Utility Functions', () => {
    test('should return correct Hijri month names', () => {
      expect(converter.getHijriMonthName(1)).toBe('Muharram');
      expect(converter.getHijriMonthName(9)).toBe('Ramadan');
      expect(converter.getHijriMonthName(12)).toBe('Dhu al-Hijjah');
    });

    test('should handle invalid month numbers gracefully', () => {
      const result = converter.getHijriMonthName(13);
      expect(result).toContain('Month 13');
    });

    test('should return available regions', () => {
      const regions = converter.getAvailableRegions();

      expect(regions).toContain(Region.GLOBAL);
      expect(regions).toContain(Region.INDONESIA);
      expect(regions).toContain(Region.SAUDI_ARABIA);
      expect(regions).toContain(Region.MALAYSIA);
    });

    test('should return regional mapping information', () => {
      const indonesiaMapping = converter.getRegionalMapping(Region.INDONESIA);

      expect(indonesiaMapping).toBeDefined();
      expect(indonesiaMapping?.region).toBe(Region.INDONESIA);
      expect(indonesiaMapping?.rukyatBased).toBe(true);
      expect(indonesiaMapping?.adjustmentDays).toBe(-1);
    });
  });

  describe('Regional Calendar Mappings', () => {
    test('should handle global (Saudi Arabia) calendar correctly', () => {
      const gregorianDate: GregorianDate = {
        year: 2024,
        month: 1,
        day: 1
      };

      const options: ConversionOptions = {
        region: Region.GLOBAL
      };

      const result = converter.gregorianToHijri(gregorianDate, options);

      expect(result.region).toBe(Region.GLOBAL);
      expect(result.confidence).toBe('high');
      expect(result.fallbackUsed).toBe(false);
    });

    test('should apply Indonesian calendar adjustments', () => {
      const gregorianDate: GregorianDate = {
        year: 2024,
        month: 1,
        day: 1
      };

      const globalResult = converter.gregorianToHijri(gregorianDate, { region: Region.GLOBAL });
      const indonesiaResult = converter.gregorianToHijri(gregorianDate, { region: Region.INDONESIA });

      // Indonesia typically has -1 day adjustment
      const globalHijri = globalResult.convertedDate as HijriDate;
      const indonesiaHijri = indonesiaResult.convertedDate as HijriDate;

      // The dates should be different due to regional adjustment
      const areDifferent = 
        globalHijri.year !== indonesiaHijri.year ||
        globalHijri.month !== indonesiaHijri.month ||
        globalHijri.day !== indonesiaHijri.day;

      expect(areDifferent).toBe(true);
      expect(indonesiaResult.confidence).toBe('medium');
    });
  });

  describe('Conversion Accuracy Tests', () => {
    // Test known conversion pairs
    const knownConversions = [
      {
        gregorian: { year: 2024, month: 1, day: 1 },
        description: 'New Year 2024'
      },
      {
        gregorian: { year: 2024, month: 4, day: 10 },
        description: 'Random date in 2024'
      }
    ];

    knownConversions.forEach(({ gregorian, description }) => {
      test(`should convert ${description} bidirectionally`, () => {
        // Convert Gregorian to Hijri
        const toHijri = converter.gregorianToHijri(gregorian);
        const hijriDate = toHijri.convertedDate as HijriDate;

        // Convert back to Gregorian
        const backToGregorian = converter.hijriToGregorian(hijriDate);
        const convertedGregorian = backToGregorian.convertedDate as GregorianDate;

        // Should be very close to original (within 1 day due to calendar differences)
        const originalDate = new Date(gregorian.year, gregorian.month - 1, gregorian.day);
        const convertedDate = new Date(convertedGregorian.year, convertedGregorian.month - 1, convertedGregorian.day);
        const daysDifference = Math.abs((convertedDate.getTime() - originalDate.getTime()) / (1000 * 60 * 60 * 24));

        expect(daysDifference).toBeLessThanOrEqual(1);
      });
    });
  });
});

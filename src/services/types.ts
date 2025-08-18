/**
 * TypeScript interfaces for calendar conversion service
 */

export enum CalendarType {
  GREGORIAN = 'gregorian',
  HIJRI = 'hijri',
  HIJRI_INDONESIA = 'hijri_indonesia'
}

export enum Region {
  GLOBAL = 'global',
  INDONESIA = 'indonesia',
  SAUDI_ARABIA = 'saudi_arabia',
  MALAYSIA = 'malaysia'
}

export interface GregorianDate {
  year: number;
  month: number; // 1-12
  day: number;
}

export interface HijriDate {
  year: number;
  month: number; // 1-12
  day: number;
  monthName?: string;
}

export interface ConversionResult {
  originalDate: GregorianDate | HijriDate;
  convertedDate: GregorianDate | HijriDate;
  sourceCalendar: CalendarType;
  targetCalendar: CalendarType;
  region: Region;
  confidence: 'high' | 'medium' | 'low';
  notes?: string;
  fallbackUsed: boolean;
}

export interface RegionalMapping {
  region: Region;
  adjustmentDays: number; // +/- days from standard calculation
  rukyatBased: boolean;
  description?: string;
}

export interface ConversionOptions {
  region?: Region;
  allowFallback?: boolean;
  includeMonthNames?: boolean;
  strict?: boolean; // Strict validation mode
}

export interface DateValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface ConversionError extends Error {
  code: string;
  originalDate: GregorianDate | HijriDate;
  targetCalendar: CalendarType;
}

import { Response } from 'express';
import { ApiResponse, PaginationMeta } from '../types';

/**
 * Formats a successful API response
 */
export const formatSuccessResponse = <T>(data: T, message?: string): ApiResponse<T> => {
  return {
    status: 'success',
    data,
    message,
    timestamp: new Date().toISOString(),
  };
};

/**
 * Formats an error API response
 */
export const formatErrorResponse = (message: string, data?: any): ApiResponse => {
  return {
    status: 'error',
    message,
    data,
    timestamp: new Date().toISOString(),
  };
};

/**
 * Sends a success response with formatted data
 */
export const sendSuccessResponse = <T>(res: Response, data: T, message?: string, statusCode = 200): void => {
  res.status(statusCode).json(formatSuccessResponse(data, message));
};

/**
 * Sends an error response with formatted message
 */
export const sendErrorResponse = (res: Response, message: string, statusCode = 400, data?: any): void => {
  res.status(statusCode).json(formatErrorResponse(message, data));
};

/**
 * Creates pagination metadata
 */
export const createPaginationMeta = (page: number, limit: number, total: number): PaginationMeta => {
  const totalPages = Math.ceil(total / limit);
  
  return {
    page,
    limit,
    total,
    totalPages,
  };
};

/**
 * Validates and parses pagination parameters
 */
export const parsePaginationParams = (page?: string, limit?: string) => {
  const parsedPage = Math.max(1, parseInt(page || '1', 10));
  const parsedLimit = Math.min(100, Math.max(1, parseInt(limit || '20', 10))); // Max 100 items per page
  
  return {
    page: parsedPage,
    limit: parsedLimit,
    offset: (parsedPage - 1) * parsedLimit,
  };
};

/**
 * Base handler for MCP operations
 * Provides common functionality for all handlers including logging and error handling
 */

import { Logger } from '../utils/logger.js';
import { promises as fs } from 'fs';

export interface HandlerResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code?: string;
    details?: any;
  };
}

/**
 * Base class for all operation handlers in the MCP server
 * Provides consistent error handling and logging
 */
export abstract class BaseHandler {
  protected logger: Logger;
  
  constructor(loggerName: string) {
    this.logger = new Logger(loggerName);
  }
  
  /**
   * Safely executes the provided handler function with error handling
   * @param operation - Human-readable name of the operation being performed
   * @param handler - The async function to execute
   * @returns A structured response object with success status and data or error
   */
  protected async safeExecute<T>(
    operation: string, 
    handler: () => Promise<T>
  ): Promise<HandlerResponse<T>> {
    try {
      this.logger.info(`Starting operation: ${operation}`);
      const startTime = Date.now();
      
      const result = await handler();
      
      const duration = Date.now() - startTime;
      this.logger.info(`Completed operation: ${operation} in ${duration}ms`);
      
      return {
        success: true,
        data: result
      };
    } catch (error) {
      this.logger.error(`Error in operation: ${operation}`, error);
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      // Create error response
      const errorResponse: HandlerResponse<T> = {
        success: false,
        error: {
          message: errorMessage
        }
      };
      
      // Add stack trace in development environment
      if (process.env.NODE_ENV !== 'production' && error instanceof Error) {
        errorResponse.error!.details = {
          stack: error.stack,
          name: error.name
        };
      }
      
      return errorResponse;
    }
  }
  
}

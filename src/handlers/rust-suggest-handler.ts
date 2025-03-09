/**
 * Handler for Rust code suggestions
 * Provides functionality to generate suggestions for improving Rust code
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { BaseHandler, HandlerResponse } from './base-handler.js';
import { RustSuggestionRequest } from '../protocols/schema.js';
import { StorageService } from '../utils/storage.js';
import { v4 as uuidv4 } from 'uuid';

// Promisify exec for async/await usage
const execPromise = promisify(exec);

/**
 * Interface for suggestion results
 */
export interface RustSuggestionResult {
  id: string;
  timestamp: number;
  fileName?: string;
  suggestions: RustSuggestion[];
  success: boolean;
  message?: string;
}

/**
 * Interface for individual Rust code suggestions
 */
export interface RustSuggestion {
  title: string;
  description: string;
  category: string;
  replacements: Array<{
    text: string;
    position: {
      startLine: number;
      startCharacter: number;
      endLine: number;
      endCharacter: number;
    };
  }>;
  benefits?: string[];
}

/**
 * Handler for Rust code suggestion operations
 */
export class RustSuggestHandler extends BaseHandler {
  private binaryPath: string;
  private storage: StorageService;

  /**
   * Create a new Rust Suggestion Handler
   * @param binaryPath - Path to the Rust analysis binary
   */
  constructor(binaryPath: string) {
    super('RustSuggestHandler');
    this.binaryPath = binaryPath;
    this.storage = new StorageService();
  }

  /**
   * Generate suggestions for Rust code
   * @param request - The suggestion request containing Rust code
   * @returns Suggestion result with improvement recommendations
   */
  public async suggest(request: RustSuggestionRequest): Promise<HandlerResponse<RustSuggestionResult>> {
    return this.safeExecute<RustSuggestionResult>('suggest-rust-improvements', async () => {
      // Validate the binary exists
      this.validateBinary(this.binaryPath);

      // Create a temporary file name for the suggestion
      const fileName = request.fileName || `rust-suggest-${Date.now()}.rs`;
      
      // Prepare request data
      const codeBuffer = Buffer.from(request.code);
      const base64Code = codeBuffer.toString('base64');
      
      // Log suggestion attempt
      this.logger.info(`Generating suggestions for Rust code`, { 
        fileName, 
        codeSize: request.code.length 
      });

      // Build the command to execute the Rust binary
      const command = `"${this.binaryPath}" suggest "${base64Code}" "${fileName}"`;
      
      // Execute the Rust binary
      const { stdout } = await execPromise(command);
      
      let suggestionResult: RustSuggestionResult;
      
      try {
        // Parse the JSON output from the Rust binary
        const output = JSON.parse(stdout);
        
        // Create a structured result
        suggestionResult = {
          id: uuidv4(),
          timestamp: Date.now(),
          fileName: request.fileName,
          suggestions: output.suggestions || [],
          success: output.success
        };
        
        // Log suggestion count
        this.logger.info(`Suggestion generation completed with ${suggestionResult.suggestions.length} suggestions`);
        
        // Store the suggestion result for persistence
        await this.storage.saveAnalysis({
          fileName: suggestionResult.fileName || '',
          code: request.code,
          suggestions: suggestionResult.suggestions
        });
        
        return suggestionResult;
      } catch (error: any) {
        this.logger.error('Failed to parse suggestion result', error);
        throw new Error('Failed to parse suggestion result: ' + (error?.message || 'Unknown error'));
      }
    });
  }
} 
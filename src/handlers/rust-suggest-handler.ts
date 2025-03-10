/**
 * Handler for Rust code suggestions
 * Provides functionality to generate suggestions for improving Rust code
 */

import { BaseHandler, HandlerResponse } from './base-handler.js';
import { RustSuggestionRequest } from '../protocols/schema.js';
import { StorageService } from '../utils/storage.js';
import { v4 as uuidv4 } from 'uuid';

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
  private storage: StorageService;

  /**
   * Create a new Rust Suggestion Handler
   */
  constructor() {
    super('RustSuggestHandler');
    this.storage = new StorageService();
  }

  /**
   * Generate suggestions for Rust code
   * @param request - The suggestion request containing Rust code
   * @returns Suggestion result with improvement recommendations
   */
  public async suggest(request: RustSuggestionRequest): Promise<HandlerResponse<RustSuggestionResult>> {
    return this.safeExecute<RustSuggestionResult>('suggest-rust-improvements', async () => {
      const suggestionResult: RustSuggestionResult = {
        id: uuidv4(),
        timestamp: Date.now(),
        fileName: request.fileName,
        suggestions: [],
        success: true
      };

      // Check for mutable references that could be immutable
      const mutableRefRegex = /&mut\s+(\w+)/g;
      let match;
      while ((match = mutableRefRegex.exec(request.code)) !== null) {
        const startLine = request.code.substring(0, match.index).split('\n').length - 1;
        const startChar = match.index - request.code.lastIndexOf('\n', match.index) - 1;
        
        suggestionResult.suggestions.push({
          title: 'Consider using immutable reference',
          description: 'Use &T instead of &mut T when the value does not need to be modified',
          category: 'performance',
          replacements: [{
            text: `&${match[1]}`,
            position: {
              startLine,
              startCharacter: startChar,
              endLine: startLine,
              endCharacter: startChar + match[0].length
            }
          }],
          benefits: ['Improves code safety', 'Makes intent clearer', 'Enables more compiler optimizations']
        });
      }

      // Check for Vec::new() that could use vec![]
      const vecNewRegex = /Vec::new\(\)/g;
      while ((match = vecNewRegex.exec(request.code)) !== null) {
        const startLine = request.code.substring(0, match.index).split('\n').length - 1;
        const startChar = match.index - request.code.lastIndexOf('\n', match.index) - 1;
        
        suggestionResult.suggestions.push({
          title: 'Use vec![] macro',
          description: 'The vec![] macro is more concise than Vec::new()',
          category: 'style',
          replacements: [{
            text: 'vec![]',
            position: {
              startLine,
              startCharacter: startChar,
              endLine: startLine,
              endCharacter: startChar + match[0].length
            }
          }],
          benefits: ['More idiomatic Rust', 'Improved readability']
        });
      }

      // Store the suggestion result
      await this.storage.saveAnalysis({
        fileName: request.fileName || '',
        code: request.code,
        suggestions: suggestionResult.suggestions
      });

      return suggestionResult;
    });
  }
}

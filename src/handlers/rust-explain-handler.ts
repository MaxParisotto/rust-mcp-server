/**
 * Handler for Rust code explanation
 * Provides functionality to explain Rust code patterns and concepts
 */

import { BaseHandler, HandlerResponse } from './base-handler.js';
import { RustExplanationRequest } from '../protocols/schema.js';
import { StorageService } from '../utils/storage.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Interface for explanation results
 */
export interface RustExplanationResult {
  id: string;
  timestamp: number;
  fileName?: string;
  explanation: string;
  sections: ExplanationSection[];
  relatedConcepts: string[];
  success: boolean;
  message?: string;
}

/**
 * Interface for explanation sections
 */
export interface ExplanationSection {
  title: string;
  content: string;
  codeReference?: {
    startLine: number;
    startCharacter: number;
    endLine: number;
    endCharacter: number;
  };
}

/**
 * Handler for Rust code explanation operations
 */
export class RustExplainHandler extends BaseHandler {
  private storage: StorageService;

  /**
   * Create a new Rust Explanation Handler
   */
  constructor() {
    super('RustExplainHandler');
    this.storage = new StorageService();
  }

  /**
   * Explain Rust code
   * @param request - The explanation request containing Rust code
   * @returns Explanation of the provided code
   */
  public async explain(request: RustExplanationRequest): Promise<HandlerResponse<RustExplanationResult>> {
    return this.safeExecute<RustExplanationResult>('explain-rust-code', async () => {
      const explanationResult: RustExplanationResult = {
        id: uuidv4(),
        timestamp: Date.now(),
        fileName: request.fileName,
        explanation: '',
        sections: [] as ExplanationSection[],
        relatedConcepts: [] as string[],
        success: true
      };

      // Analyze code patterns and provide explanations
      if (request.code.includes('match')) {
        explanationResult.sections.push({
          title: 'Pattern Matching',
          content: 'The match expression is a powerful control flow construct in Rust that allows you to compare a value against a series of patterns and execute code based on which pattern matches.',
          codeReference: {
            startLine: request.code.split('\n').findIndex(line => line.includes('match')),
            startCharacter: 0,
            endLine: request.code.split('\n').findIndex(line => line.includes('match')),
            endCharacter: request.code.split('\n').find(line => line.includes('match'))?.length || 0
          }
        });
        explanationResult.relatedConcepts.push('Pattern Matching', 'Control Flow', 'Match Expressions');
      }

      if (request.code.includes('Result<')) {
        explanationResult.sections.push({
          title: 'Error Handling',
          content: 'Result<T, E> is a type used for returning and propagating errors. It has two variants: Ok(T), representing success and containing a value, and Err(E), representing error and containing an error value.',
          codeReference: {
            startLine: request.code.split('\n').findIndex(line => line.includes('Result<')),
            startCharacter: 0,
            endLine: request.code.split('\n').findIndex(line => line.includes('Result<')),
            endCharacter: request.code.split('\n').find(line => line.includes('Result<'))?.length || 0
          }
        });
        explanationResult.relatedConcepts.push('Error Handling', 'Result Type', 'Option Type');
      }

      if (request.code.includes('impl')) {
        explanationResult.sections.push({
          title: 'Implementation Block',
          content: 'The impl keyword is used to implement methods and associated functions for a type. This is how you define the behavior of custom types in Rust.',
          codeReference: {
            startLine: request.code.split('\n').findIndex(line => line.includes('impl')),
            startCharacter: 0,
            endLine: request.code.split('\n').findIndex(line => line.includes('impl')),
            endCharacter: request.code.split('\n').find(line => line.includes('impl'))?.length || 0
          }
        });
        explanationResult.relatedConcepts.push('Methods', 'Associated Functions', 'Traits');
      }

      // Combine sections into a complete explanation
      explanationResult.explanation = explanationResult.sections
        .map(section => `${section.title}:\n${section.content}`)
        .join('\n\n');

      // Store the explanation result
      await this.storage.saveAnalysis({
        fileName: request.fileName || '',
        code: request.code,
        explanation: explanationResult.explanation,
        sections: explanationResult.sections
      });

      return explanationResult;
    });
  }
}

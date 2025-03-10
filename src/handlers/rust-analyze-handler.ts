/**
 * Handler for Rust code analysis
 * Provides intelligent code analysis and best practices enforcement
 */

import { BaseHandler, HandlerResponse } from './base-handler.js';
import { RustAnalysisRequest } from '../protocols/schema.js';
import { StorageService } from '../utils/storage.js';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';

/**
 * Interface for the analysis result
 */
export interface RustAnalysisResult {
  id: string;
  timestamp: number;
  fileName?: string;
  diagnostics: RustDiagnostic[];
  success: boolean;
  message?: string;
}

/**
 * Interface for Rust diagnostic information
 */
export interface RustDiagnostic {
  message: string;
  severity: 'error' | 'warning' | 'info' | 'hint';
  code?: string;
  position: {
    startLine: number;
    startCharacter: number;
    endLine: number;
    endCharacter: number;
  };
  relatedInformation?: Array<{
    message: string;
    location?: {
      file: string;
      line: number;
      character: number;
    };
  }>;
  suggestions?: Array<{
    title: string;
    replacements: Array<{
      text: string;
      position: {
        startLine: number;
        startCharacter: number;
        endLine: number;
        endCharacter: number;
      };
    }>;
  }>;
}

/**
 * Handler for Rust code analysis operations
 */
export class RustAnalyzeHandler extends BaseHandler {
  private storage: StorageService;

  /**
   * Create a new Rust Analysis Handler
   */
  private initialized: Promise<void>;

  constructor() {
    super('RustAnalyzeHandler');
    this.storage = new StorageService();
    this.initialized = this.storage.initialize().catch(error => {
      this.logger.error('Failed to initialize storage', error);
    });
  }

  private async ensureInitialized(): Promise<void> {
    await this.initialized;
  }

  /**
   * Analyze Rust code
   * @param request - The analysis request containing Rust code
   * @returns Analysis result with diagnostics
   */
  public async analyze(request: RustAnalysisRequest): Promise<RustAnalysisResult> {
    await this.ensureInitialized();
    try {
      const analysisResult: RustAnalysisResult = {
        id: uuidv4(),
        timestamp: Date.now(),
        fileName: request.fileName,
        diagnostics: [],
        success: true,
        message: 'Analysis completed successfully'
      };

      // Analyze code for type mismatches
      if (request.code.includes('let') && request.code.includes(':')) {
        const typeAnnotationRegex = /let\s+(\w+)\s*:\s*(\w+)\s*=\s*([^;]+)/g;
        let match: RegExpExecArray | null;
        
        while ((match = typeAnnotationRegex.exec(request.code)) !== null) {
          const [fullMatch, varName, expectedType, value] = match;
          const startLine = request.code.substring(0, match.index).split('\n').length - 1;
          const startChar = match.index - request.code.lastIndexOf('\n', match.index) - 1;
          
          // Check for string literal assigned to number type
          if (expectedType.includes('i32') && value.includes('"')) {
            analysisResult.diagnostics.push({
              message: `Mismatched types: expected ${expectedType}, found &str`,
              severity: 'error',
              position: {
                startLine,
                startCharacter: startChar,
                endLine: startLine,
                endCharacter: startChar + fullMatch.length
              },
              suggestions: [{
                title: 'Convert string to number',
                replacements: [{
                  text: `let ${varName}: ${expectedType} = ${value.replace(/['"]/g, '')}.parse().expect("Not a valid number");`,
                  position: {
                    startLine,
                    startCharacter: startChar,
                    endLine: startLine,
                    endCharacter: startChar + fullMatch.length
                  }
                }]
              }]
            });
          }
        }
      }

      // Check for missing error handling
      if (request.code.includes('.unwrap()')) {
        const unwrapRegex = /\.unwrap\(\)/g;
        let match: RegExpExecArray | null;
        
        while ((match = unwrapRegex.exec(request.code)) !== null) {
          const startLine = request.code.substring(0, match.index).split('\n').length - 1;
          const startChar = match.index - request.code.lastIndexOf('\n', match.index) - 1;
          
          analysisResult.diagnostics.push({
            message: 'Using unwrap() can lead to runtime panics',
            severity: 'warning',
            position: {
              startLine,
              startCharacter: startChar,
              endLine: startLine,
              endCharacter: startChar + match[0].length
            },
            suggestions: [{
              title: 'Use proper error handling',
              replacements: [{
                text: '.expect("Provide a helpful error message")',
                position: {
                  startLine,
                  startCharacter: startChar,
                  endLine: startLine,
                  endCharacter: startChar + match[0].length
                }
              }]
            }]
          });
        }
      }

      // Check for unnecessary mut
      const mutabilityRegex = /let\s+mut\s+(\w+)\s*=\s*([^;]+);(?![^]*\1\s*=)/g;
      let mutMatch: RegExpExecArray | null;
      while ((mutMatch = mutabilityRegex.exec(request.code)) !== null) {
        const [fullMatch, varName] = mutMatch;
        const startLine = request.code.substring(0, mutMatch.index).split('\n').length - 1;
        const startChar = mutMatch.index - request.code.lastIndexOf('\n', mutMatch.index) - 1;
        
        analysisResult.diagnostics.push({
          message: `Variable '${varName}' is declared as mutable but never modified`,
          severity: 'warning',
          position: {
            startLine,
            startCharacter: startChar,
            endLine: startLine,
            endCharacter: startChar + fullMatch.length
          },
          suggestions: [{
            title: 'Remove unnecessary mut',
            replacements: [{
              text: fullMatch.replace('mut ', ''),
              position: {
                startLine,
                startCharacter: startChar,
                endLine: startLine,
                endCharacter: startChar + fullMatch.length
              }
            }]
          }]
        });
      }

      // Check for Result without error handling
      const resultHandlingRegex = /fn\s+\w+\s*\([^)]*\)\s*->\s*Result\s*<[^>]+>/g;
      let resultMatch: RegExpExecArray | null;
      while ((resultMatch = resultHandlingRegex.exec(request.code)) !== null) {
        const startLine = request.code.substring(0, resultMatch.index).split('\n').length - 1;
        const startChar = resultMatch.index - request.code.lastIndexOf('\n', resultMatch.index) - 1;
        
        if (!request.code.includes('?') && !request.code.includes('match') && !request.code.includes('if let')) {
          analysisResult.diagnostics.push({
            message: 'Function returns Result but no error handling pattern is used',
            severity: 'warning',
            position: {
              startLine,
              startCharacter: startChar,
              endLine: startLine,
              endCharacter: startChar + resultMatch[0].length
            },
            suggestions: [{
              title: 'Add error handling',
              replacements: [{
                text: 'Use ? operator, match, or if let to handle potential errors',
                position: {
                  startLine,
                  startCharacter: startChar,
                  endLine: startLine,
                  endCharacter: startChar + resultMatch[0].length
                }
              }]
            }]
          });
        }
      }

      // Store analysis result
      await this.storage.saveAnalysis({
        fileName: request.fileName || '',
        code: request.code,
        diagnostics: analysisResult.diagnostics
      });

      return analysisResult;
    } catch (error) {
      return {
        id: uuidv4(),
        timestamp: Date.now(),
        fileName: request.fileName,
        diagnostics: [],
        success: false,
        message: error instanceof Error ? error.message : 'Analysis failed'
      };
    }
  }
}

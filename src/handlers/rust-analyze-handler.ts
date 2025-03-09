/**
 * Handler for Rust code analysis
 * Provides functionality to analyze Rust code using the Rust binary bridge
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import { BaseHandler, HandlerResponse } from './base-handler.ts';
import { RustAnalysisRequest } from '../protocols/schema.ts';
import { StorageService } from '../utils/storage.ts';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';

// Promisify exec for async/await usage
const execPromise = promisify(exec);

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
  private binaryPath: string;
  private storage: StorageService;

  /**
   * Create a new Rust Analysis Handler
   * @param binaryPath - Path to the Rust analysis binary
   */
  constructor(binaryPath: string) {
    super('RustAnalyzeHandler');
    this.binaryPath = binaryPath;
    this.storage = new StorageService();
  }

  /**
   * Analyze Rust code
   * @param request - The analysis request containing Rust code
   * @returns Analysis result with diagnostics
   */
  public async analyze(request: RustAnalysisRequest): Promise<HandlerResponse<RustAnalysisResult>> {
    return this.safeExecute<RustAnalysisResult>('analyze-rust-code', async () => {
      try {
        // Try to validate the binary exists - this will throw if not found (but not in autostart mode)
        this.validateBinary(this.binaryPath);
        
        // Check if binary actually exists
        if (!this.binaryPath || !fs.existsSync(this.binaryPath)) {
          // In autostart scenarios, we return a friendly "service unavailable" message
          // instead of failing completely
          return {
            id: uuidv4(),
            timestamp: Date.now(),
            fileName: request.fileName,
            diagnostics: [{
              message: 'Rust analysis service is unavailable because the Rust binary could not be found.',
              severity: 'error',
              position: {
                startLine: 0,
                startCharacter: 0,
                endLine: 0,
                endCharacter: 0
              }
            }],
            success: false,
            message: 'Rust analysis service unavailable'
          };
        }

        // Create a temporary file name for the analysis
        const fileName = request.fileName || `rust-analysis-${Date.now()}.rs`;
        
        // Prepare request data
        const codeBuffer = Buffer.from(request.code);
        const base64Code = codeBuffer.toString('base64');
        
        // Log analysis attempt
        this.logger.info(`Analyzing Rust code`, { 
          fileName, 
          codeSize: request.code.length,
          position: request.position
        });

        // Build the command to execute the Rust binary
        const command = `"${this.binaryPath}" analyze "${base64Code}" "${fileName}"`;
        
        // Execute the Rust binary
        const { stdout } = await execPromise(command);
        
        let analysisResult: RustAnalysisResult;
        
        try {
          // Parse the JSON output from the Rust binary
          const output = JSON.parse(stdout);
          
          // Create a structured result
          analysisResult = {
            id: uuidv4(),
            timestamp: Date.now(),
            fileName: request.fileName,
            diagnostics: output.diagnostics || [],
            success: output.success
          };
          
          // Log diagnostic count
          this.logger.info(`Analysis completed with ${analysisResult.diagnostics.length} diagnostics`);
          
          // Store the analysis result for persistence
          await this.storage.saveAnalysis({
            fileName: analysisResult.fileName || '',
            code: request.code,
            diagnostics: analysisResult.diagnostics
          });
          
          return analysisResult;
        } catch (error: any) {
          this.logger.error('Failed to parse analysis result', error);
          throw new Error('Failed to parse analysis result: ' + (error?.message || 'Unknown error'));
        }
      } catch (error) {
        // If we're in an autostart scenario, provide a friendlier error message
        if (process.env.NODE_ENV === 'production' || process.env.AUTOSTART === 'true') {
          return {
            id: uuidv4(),
            timestamp: Date.now(),
            fileName: request.fileName,
            diagnostics: [{
              message: `Rust analysis service error: ${error instanceof Error ? error.message : 'Unknown error'}`,
              severity: 'error',
              position: {
                startLine: 0,
                startCharacter: 0,
                endLine: 0,
                endCharacter: 0
              }
            }],
            success: false,
            message: 'Rust analysis service error'
          };
        }
        
        // In development, propagate the error
        throw error;
      }
    });
  }

  /**
   * Get analysis history
   * @param limit - Maximum number of history entries to retrieve
   * @returns List of previous analysis results
   */
  public async getHistory(limit: number = 10): Promise<HandlerResponse<Array<any>>> {
    return this.safeExecute<Array<any>>('get-analysis-history', async () => {
      const analyses = await this.storage.getRecentAnalyses(limit);
      return analyses;
    });
  }

  /**
   * Get a specific analysis by ID
   * @param id - The analysis ID to retrieve
   * @returns The analysis result or null if not found
   */
  public async getAnalysisById(id: string): Promise<HandlerResponse<any>> {
    return this.safeExecute<any>('get-analysis-by-id', async () => {
      const analysis = await this.storage.getAnalysisById(id);
      if (!analysis) {
        throw new Error(`Analysis with ID ${id} not found`);
      }
      return analysis;
    });
  }
}

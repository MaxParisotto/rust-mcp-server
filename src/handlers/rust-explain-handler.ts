/**
 * Handler for Rust code explanation
 * Provides functionality to explain Rust code patterns and concepts
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { BaseHandler, HandlerResponse } from './base-handler.js';
import { RustExplanationRequest } from '../protocols/schema.js';
import { StorageService } from '../utils/storage.js';
import { v4 as uuidv4 } from 'uuid';

// Promisify exec for async/await usage
const execPromise = promisify(exec);

/**
 * Interface for explanation results
 */
export interface RustExplanationResult {
  id: string;
  timestamp: number;
  fileName?: string;
  explanation: string;
  sections?: ExplanationSection[];
  relatedConcepts?: string[];
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
  private binaryPath: string;
  private storage: StorageService;

  /**
   * Create a new Rust Explanation Handler
   * @param binaryPath - Path to the Rust analysis binary
   */
  constructor(binaryPath: string) {
    super('RustExplainHandler');
    this.binaryPath = binaryPath;
    this.storage = new StorageService();
  }

  /**
   * Explain Rust code
   * @param request - The explanation request containing Rust code
   * @returns Explanation of the provided code
   */
  public async explain(request: RustExplanationRequest): Promise<HandlerResponse<RustExplanationResult>> {
    return this.safeExecute<RustExplanationResult>('explain-rust-code', async () => {
      // Validate the binary exists
      await this.validateBinary(this.binaryPath);

      // Create a temporary file name for the explanation
      const fileName = request.fileName || `rust-explain-${Date.now()}.rs`;
      
      // Prepare request data
      const codeBuffer = Buffer.from(request.code);
      const base64Code = codeBuffer.toString('base64');
      
      // Log explanation attempt
      this.logger.info(`Explaining Rust code`, { 
        fileName, 
        codeSize: request.code.length,
        focus: request.focus 
      });

      // Build the command to execute the Rust binary
      let command = `"${this.binaryPath}" explain "${base64Code}" "${fileName}"`;
      
      // Add focus parameter if provided
      if (request.focus) {
        const focusBuffer = Buffer.from(request.focus);
        const base64Focus = focusBuffer.toString('base64');
        command += ` "${base64Focus}"`;
      }
      
      // Execute the Rust binary
      const { stdout } = await execPromise(command);
      
      let explanationResult: RustExplanationResult;
      
      try {
        // Parse the JSON output from the Rust binary
        const output = JSON.parse(stdout);
        
        // Create a structured result
        explanationResult = {
          id: uuidv4(),
          timestamp: Date.now(),
          fileName: request.fileName,
          explanation: output.explanation || '',
          sections: output.sections || [],
          relatedConcepts: output.relatedConcepts || [],
          success: output.success
        };
        
        // Log explanation generation
        this.logger.info(`Explanation generated successfully`, {
          sectionCount: explanationResult.sections?.length || 0,
          explanationLength: explanationResult.explanation.length
        });
        
        // Store the explanation result for persistence
        await this.storage.saveAnalysis({
          fileName: explanationResult.fileName || '',
          code: request.code,
          explanation: explanationResult.explanation,
          sections: explanationResult.sections
        });
        
        return explanationResult;
      } catch (error: any) {
        this.logger.error('Failed to parse explanation result', error);
        throw new Error('Failed to parse explanation result: ' + (error?.message || 'Unknown error'));
      }
    });
  }
}

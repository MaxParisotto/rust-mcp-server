/**
 * Bridge to the Rust binary for code analysis
 */

import { RustAnalysisRequest, RustAnalysisResponse, Diagnostic, Suggestion } from '../protocols/mcp.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

/**
 * Rust Bridge to interface with the Rust analysis binary
 */
export class RustBridge {
  private binaryPath: string;

  /**
   * Create a new Rust Bridge
   * @param binaryPath - Path to the Rust binary
   */
  constructor(binaryPath?: string) {
    this.binaryPath = binaryPath || '';
  }

  /**
   * Set the path to the Rust binary
   * @param path - Path to the Rust binary
   */
  setBinaryPath(path: string): void {
    this.binaryPath = path;
  }

  /**
   * Analyze Rust code
   * @param request - The analysis request
   * @returns The analysis response
   */
  async analyze(request: RustAnalysisRequest): Promise<RustAnalysisResponse> {
    if (!this.binaryPath) {
      throw new Error('Rust binary path not set');
    }

    // Prepare the code as base64 to avoid shell escaping issues
    const codeBuffer = Buffer.from(request.code);
    const base64Code = codeBuffer.toString('base64');

    // Create a filename if not provided
    const fileName = request.fileName || 'unnamed_code.rs';

    // Execute the Rust binary with the code
    const command = `"${this.binaryPath}" analyze "${base64Code}" "${fileName}"`;
    
    try {
      const { stdout } = await execPromise(command);
      
      // Parse the output as JSON
      return JSON.parse(stdout);
    } catch (error: any) {
      console.error('Error executing Rust binary:', error);
      throw new Error(`Error analyzing code: ${error?.message || 'Unknown error'}`);
    }
  }
}
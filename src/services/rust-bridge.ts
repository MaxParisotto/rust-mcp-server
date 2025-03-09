/**
 * Bridge to the Rust binary for code analysis
 */

import { RustAnalysisRequest, RustAnalysisResponse, Diagnostic, Suggestion } from '../protocols/mcp.js';
import { spawn } from 'child_process';
import fs from 'fs';

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

    // Validate binary path
    if (!this.binaryPath) {
      throw new Error('Rust binary path must be set');
    }
    if (!fs.existsSync(this.binaryPath)) {
      throw new Error(`Rust binary not found at path: ${this.binaryPath}`);
    }
    try {
      fs.accessSync(this.binaryPath, fs.constants.X_OK);
    } catch (err) {
      throw new Error(`Rust binary is not executable: ${this.binaryPath}`);
    }

    // Validate request
    if (!request || typeof request !== 'object') {
      throw new Error('Invalid analysis request');
    }
    if (!request.code || typeof request.code !== 'string') {
      throw new Error('Request must contain code to analyze');
    }

    // Create a child process with stdin/stdout pipes
    const child = spawn(this.binaryPath, ['analyze'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 10000 // 10 second timeout
    });

    // Setup timeout handler
    let timeoutHandle: NodeJS.Timeout;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutHandle = setTimeout(() => {
        child.kill();
        reject(new Error('Rust binary process timed out'));
      }, 10000);
    });

    // Write request as JSON to stdin
    const requestJson = JSON.stringify({
      code: request.code,
      fileName: request.fileName || 'unnamed_code.rs'
    });
    
    // Handle process errors
    let processError: Error | null = null;
    child.on('error', (err: Error) => {
      processError = err;
    });

    // Handle stdout with chunked processing
    const stdoutChunks: Buffer[] = [];
    child.stdout.on('data', (data) => {
      stdoutChunks.push(data);
    });

    // Handle stderr
    let stderr = '';
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    // Write request and end stdin
    child.stdin.write(requestJson);
    child.stdin.end();

    // Wait for process to complete
    const exitCode = await Promise.race([
      new Promise((resolve) => {
        child.on('close', (code) => {
          clearTimeout(timeoutHandle);
          resolve(code);
        });
      }),
      timeoutPromise
    ]).finally(() => {
      // Ensure process is cleaned up
      child.kill();
      clearTimeout(timeoutHandle);
    });

    // Handle process errors
    if (processError !== null) {
      const errorMessage = processError && typeof processError === 'object' && 'message' in processError 
        ? (processError as Error).message 
        : 'Unknown error';
      throw new Error(`Rust binary process error: ${errorMessage}`);
    }

    // Handle non-zero exit codes
    if (exitCode !== 0) {
      throw new Error(`Rust binary failed with code ${exitCode}: ${stderr}`);
    }

    // Parse output with chunked processing
    try {
      const stdout = Buffer.concat(stdoutChunks).toString();
      const response = JSON.parse(stdout) as RustAnalysisResponse;
      
      // Validate response structure
      if (!response || typeof response !== 'object') {
        throw new Error('Invalid response format from Rust binary');
      }
      
      return response;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      throw new Error(`Failed to parse Rust binary output: ${errorMessage}`);
    }
  }
}

import { spawn } from 'child_process';
import { RustAnalysisRequest, RustAnalysisResponse, Diagnostic, Suggestion } from '../protocols/mcp';
import path from 'path';

/**
 * Bridge to communicate with the Rust analyzer implementation
 */
export class RustBridge {
  private binaryPath: string;
  
  constructor() {
    // Path is relative to where the server will be run from
    this.binaryPath = path.resolve('./rust-bridge/target/release/analyze');
  }

  /**
   * Analyze Rust code using rust-analyzer via our bridge
   */
  async analyze(request: RustAnalysisRequest): Promise<RustAnalysisResponse> {
    return new Promise((resolve, reject) => {
      const process = spawn(this.binaryPath, []);
      
      let stdout = '';
      let stderr = '';
      
      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      process.on('close', (code) => {
        if (code !== 0) {
          console.error(`Process exited with code ${code}: ${stderr}`);
          // Even on error, return an empty response to avoid client errors
          resolve({
            diagnostics: [{
              message: `Analysis failed with error: ${stderr}`,
              severity: 'error',
              source: 'rust-bridge'
            }],
            suggestions: [],
            explanation: `Error during analysis: ${stderr}`
          });
          return;
        }
        
        try {
          const response = JSON.parse(stdout) as RustAnalysisResponse;
          resolve(response);
        } catch (err) {
          console.error('Failed to parse response', err);
          resolve({
            diagnostics: [{
              message: 'Failed to parse analysis response',
              severity: 'error',
              source: 'rust-bridge'
            }],
            suggestions: [],
            explanation: 'Internal error in the analysis service'
          });
        }
      });
      
      // Write the request to the process stdin
      process.stdin.write(JSON.stringify({
        file_path: request.fileName || 'input.rs',
        code: request.code
      }));
      process.stdin.end();
    });
  }
}
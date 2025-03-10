/**
 * MCP Protocol
 * Implementations of the Model Context Protocol for the Rust Analysis Server
 */

import { getMCPSchema } from './schema';
import { exec } from 'child_process';
import { promisify } from 'util';

// Promisify exec for easier usage with async/await
const execPromise = promisify(exec);

/**
 * Interface for MCP messages
 */
export interface MCPMessage {
  type: string;
  data: any;
}

/**
 * Request types
 */
export interface RustAnalysisRequest {
  code: string;
  fileName?: string;
  position?: {
    line: number;
    character: number;
  };
}

/**
 * Response types
 */
export interface RustAnalysisResponse {
  success: boolean;
  message?: string;
  diagnostics: Diagnostic[];
}

/**
 * Diagnostic information
 */
export interface Diagnostic {
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
  suggestions?: Suggestion[];
}

/**
 * Suggestion information
 */
export interface Suggestion {
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
}

/**
 * Handler for MCP protocol messages
 */
export class MCPProtocolHandler {
  private rustBinaryPath: string;
  public rustBridge: any;

  constructor(rustBinaryPath?: string) {
    this.rustBinaryPath = rustBinaryPath || '';
    this.rustBridge = null;
  }

  /**
   * Safely execute async operations with error handling
   */
  private async safeExecute<T>(operation: () => Promise<T>): Promise<{ success: boolean; data?: T; error?: { message: string; stack?: string; name?: string } }> {
    try {
      const result = await operation();
      return { success: true, data: result };
    } catch (error: unknown) {
      if (error instanceof Error) {
        return { 
          success: false,
          error: {
            message: error.message,
            stack: error.stack,
            name: error.name
          }
        };
      }
      return {
        success: false,
        error: {
          message: 'Unknown error occurred'
        }
      };
    }
  }

  /**
   * Validate the Rust binary path and availability
   */
  private async validateBinary(): Promise<boolean> {
    if (!this.rustBinaryPath) {
      return false;
    }

    try {
      const { stdout } = await execPromise(`"${this.rustBinaryPath}" --version`);
      return stdout.includes('rust-analyzer');
    } catch {
      return false;
    }
  }

  /**
   * Handle an incoming MCP message
   * @param message - The MCP message to handle
   * @returns The response message
   */
  async handleMessage(message: MCPMessage): Promise<MCPMessage> {
    switch (message.type) {
      case 'mcp.schema':
        return { 
          type: 'mcp.schema.result', 
          data: getMCPSchema() 
        };
        
      case 'rust.analyze':
        return { 
          type: 'rust.analysis.result', 
          data: await this.analyzeRustCode(message.data) 
        };
        
      case 'rust.suggest':
        return { 
          type: 'rust.suggestion.result', 
          data: await this.suggestRustImprovements(message.data) 
        };
        
      case 'rust.explain':
        return { 
          type: 'rust.explanation.result', 
          data: await this.explainRustCode(message.data) 
        };
        
      default:
        return { 
          type: 'error', 
          data: { message: `Unsupported message type: ${message.type}` } 
        };
    }
  }

  /**
   * Analyze Rust code
   * @param request - The analysis request
   * @returns The analysis response
   */
  private async analyzeRustCode(request: RustAnalysisRequest): Promise<RustAnalysisResponse> {
    if (!this.rustBinaryPath) {
      return {
        success: false,
        message: 'Rust binary path not set',
        diagnostics: []
      };
    }

    try {
      // Prepare the code as base64 to avoid shell escaping issues
      const codeBuffer = Buffer.from(request.code);
      const base64Code = codeBuffer.toString('base64');

      // Create a filename if not provided
      const fileName = request.fileName || 'unnamed_code.rs';

      // Execute the Rust binary with the code
      const command = `"${this.rustBinaryPath}" analyze "${base64Code}" "${fileName}"`;
      const { stdout } = await execPromise(command);

      // Parse the output as JSON
      return JSON.parse(stdout);
    } catch (error: any) {
      console.error('Error analyzing Rust code:', error);
      return {
        success: false,
        message: `Error analyzing code: ${error?.message || 'Unknown error'}`,
        diagnostics: []
      };
    }
  }

  /**
   * Suggest improvements for Rust code
   * @param request - The suggestion request
   * @returns The suggestion response
   */
  private async suggestRustImprovements(request: RustAnalysisRequest): Promise<any> {
    if (!this.rustBinaryPath) {
      return {
        success: false,
        message: 'Rust binary path not set',
        suggestions: []
      };
    }

    try {
      // Prepare the code as base64 to avoid shell escaping issues
      const codeBuffer = Buffer.from(request.code);
      const base64Code = codeBuffer.toString('base64');

      // Create a filename if not provided
      const fileName = request.fileName || 'unnamed_code.rs';

      // Execute the Rust binary with the code
      const command = `"${this.rustBinaryPath}" suggest "${base64Code}" "${fileName}"`;
      const { stdout } = await execPromise(command);

      // Parse the output as JSON
      return JSON.parse(stdout);
    } catch (error: any) {
      console.error('Error generating Rust suggestions:', error);
      return {
        success: false,
        message: `Error generating suggestions: ${error?.message || 'Unknown error'}`,
        suggestions: []
      };
    }
  }

  /**
   * Explain Rust code
   * @param request - The explanation request
   * @returns The explanation response
   */
  private async explainRustCode(request: RustAnalysisRequest): Promise<any> {
    if (!this.rustBinaryPath) {
      return {
        success: false,
        message: 'Rust binary path not set',
        explanation: ''
      };
    }

    try {
      // Prepare the code as base64 to avoid shell escaping issues
      const codeBuffer = Buffer.from(request.code);
      const base64Code = codeBuffer.toString('base64');

      // Create a filename if not provided
      const fileName = request.fileName || 'unnamed_code.rs';

      // Execute the Rust binary with the code
      const command = `"${this.rustBinaryPath}" explain "${base64Code}" "${fileName}"`;
      const { stdout } = await execPromise(command);

      // Parse the output as JSON
      return JSON.parse(stdout);
    } catch (error: any) {
      console.error('Error explaining Rust code:', error);
      return {
        success: false,
        message: `Error explaining code: ${error?.message || 'Unknown error'}`,
        explanation: ''
      };
    }
  }
}

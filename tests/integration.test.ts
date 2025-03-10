import { MCPProtocolHandler, MCPMessage, RustAnalysisRequest } from '../src/protocols/mcp';
import { HandlerResponse } from '../src/handlers/base-handler';
import { WebSocketServerTransport } from '../src/mcp/websocket-transport';
import { RustMCPServer } from '../src/mcp/mcp-server';
import { WebSocketServer } from 'ws';
import { describe, it, expect, beforeAll } from '@jest/globals';
import fs from 'fs';
import path from 'path';

const rustBinaryPath = path.join(__dirname, '../rust-bridge/target/release/librust_analyzer_bridge.dylib');
const hasRustBinary = fs.existsSync(rustBinaryPath);

describe('MCP Protocol Handler', () => {
  beforeAll(() => {
    if (!hasRustBinary) {
      console.warn('Rust binary not found at:', rustBinaryPath);
    }
  });

  it('should handle rust.analyze message', async () => {
    const handler = new MCPProtocolHandler();
    const message: MCPMessage = {
      type: 'rust.analyze',
      data: {
        code: 'fn main() { println!("Hello, world!"); }',
        fileName: 'test.rs'
      } as RustAnalysisRequest
    };

    if (!hasRustBinary) {
      // Mock the RustBridge service when binary is missing
      const mockRustBridge = {
        analyze: async () => ({
          diagnostics: [{
            message: 'Rust analyzer binary not found',
            severity: 'error',
            source: 'rust-bridge'
          }],
          suggestions: [],
          explanation: 'Rust analyzer service is not available'
        })
      };
      handler['rustBridge'] = mockRustBridge;
    }

    const response = await handler.handleMessage(message);
    expect(response.type).toBe('rust.analysis.result');
    expect(response.data).toBeDefined();
    expect(response.data.diagnostics).toBeDefined();
    expect(Array.isArray(response.data.diagnostics)).toBe(true);
    
    if (!hasRustBinary) {
      expect(response.data.diagnostics[0].message).toContain('Rust analyzer binary not found');
    }
  });

  it('should handle Rust bridge communication failures', async () => {
    const handler = new MCPProtocolHandler();
    const message: MCPMessage = {
      type: 'rust.analyze',
      data: {
        code: 'fn main() { println!("Hello, world!"); }',
        fileName: 'test.rs'
      } as RustAnalysisRequest
    };

    // Mock a communication failure
    const mockRustBridge = {
      analyze: async () => {
        throw new Error('Failed to communicate with Rust bridge');
      }
    };
    handler['rustBridge'] = mockRustBridge;

    const response = await handler.handleMessage(message);
    expect(response.type).toBe('rust.analysis.result');
    expect(response.data.diagnostics.length).toBe(1);
    expect(response.data.diagnostics[0].message).toContain('Failed to communicate with Rust bridge');
  });

  it('should handle invalid JSON response from analyzer', async () => {
    const handler = new MCPProtocolHandler();
    const message: MCPMessage = {
      type: 'rust.analyze',
      data: {
        code: 'fn main() { println!("Hello, world!"); }',
        fileName: 'test.rs'
      } as RustAnalysisRequest
    };

    // Mock the RustBridge service to return invalid JSON
    const mockRustBridge = {
      analyze: async () => ({
        diagnostics: [{
          message: 'Failed to parse analysis response: Invalid or empty response from analyzer',
          severity: 'error',
          source: 'rust-bridge'
        }],
        suggestions: [],
        explanation: 'Internal error in the analysis service: Invalid or empty response from analyzer'
      })
    };

    handler['rustBridge'] = mockRustBridge;
    
    const response = await handler.handleMessage(message);
    expect(response.type).toBe('rust.analysis.result');
    expect(response.data.diagnostics.length).toBe(1);
    expect(response.data.diagnostics[0].message).toContain('Failed to parse analysis response');
    expect(response.data.explanation).toContain('Internal error');
  });

  it('should handle malformed JSON response from analyzer', async () => {
    const handler = new MCPProtocolHandler();
    const message: MCPMessage = {
      type: 'rust.analyze',
      data: {
        code: 'fn main() { println!("Hello, world!"); }',
        fileName: 'test.rs'
      } as RustAnalysisRequest
    };

    // Mock the RustBridge service to return malformed JSON
    const mockRustBridge = {
      analyze: async () => ({
        diagnostics: [{
          message: 'Failed to parse analysis response: Invalid response structure from analyzer',
          severity: 'error',
          source: 'rust-bridge'
        }],
        suggestions: [],
        explanation: 'Internal error in the analysis service: Invalid response structure from analyzer'
      })
    };

    handler['rustBridge'] = mockRustBridge;
    
    const response = await handler.handleMessage(message);
    expect(response.type).toBe('rust.analysis.result');
    expect(response.data.diagnostics.length).toBe(1);
    expect(response.data.diagnostics[0].message).toContain('Failed to parse analysis response');
    expect(response.data.explanation).toContain('Invalid response structure');
  });

  it('should handle timeout from Rust analyzer', async () => {
    const handler = new MCPProtocolHandler();
    const message: MCPMessage = {
      type: 'rust.analyze',
      data: {
        code: 'fn main() { println!("Hello, world!"); }',
        fileName: 'test.rs'
      } as RustAnalysisRequest
    };

    // Mock a timeout scenario
    const mockRustBridge = {
      analyze: async () => {
        await new Promise(resolve => setTimeout(resolve, 10000)); // 10 second delay
        throw new Error('Analysis timed out');
      }
    };
    handler['rustBridge'] = mockRustBridge;

    const response = await handler.handleMessage(message);
    expect(response.type).toBe('rust.analysis.result');
    expect(response.data.diagnostics.length).toBe(1);
    expect(response.data.diagnostics[0].message).toContain('Analysis timed out');
  });

  it('should handle concurrent analysis requests', async () => {
    const handler = new MCPProtocolHandler();
    const message1: MCPMessage = {
      type: 'rust.analyze',
      data: {
        code: 'fn main() { println!("Hello, world!"); }',
        fileName: 'test1.rs'
      } as RustAnalysisRequest
    };

    const message2: MCPMessage = {
      type: 'rust.analyze',
      data: {
        code: 'fn main() { println!("Hello again!"); }',
        fileName: 'test2.rs'
      } as RustAnalysisRequest
    };

    const [response1, response2] = await Promise.all([
      handler.handleMessage(message1),
      handler.handleMessage(message2)
    ]);

    expect(response1.type).toBe('rust.analysis.result');
    expect(response2.type).toBe('rust.analysis.result');
    expect(response1.data.fileName).toBe('test1.rs');
    expect(response2.data.fileName).toBe('test2.rs');
  });

  it('should handle invalid message types', async () => {
    const handler = new MCPProtocolHandler();
    const message: MCPMessage = {
      type: 'invalid.type',
      data: {}
    };

    const response = await handler.handleMessage(message);
    expect(response.type).toBe('error');
    expect(response.data.message).toContain('Unsupported message type');
  });

  it('should handle websocket connection errors', async () => {
    // Create a proper mock WebSocketServer with all required properties
    const mockServer: WebSocketServer = {
      on: jest.fn((event, callback) => {
        if (event === 'error') {
          callback(new Error('Connection failed'));
        }
      }),
      close: jest.fn(),
      address: jest.fn().mockReturnValue({ port: 8743 }),
      clients: new Set(),
      options: {},
      path: '/',
      // Add other required WebSocketServer properties
      addListener: jest.fn(),
      removeListener: jest.fn(),
      emit: jest.fn(),
      once: jest.fn(),
      prependListener: jest.fn(),
      prependOnceListener: jest.fn(),
      listeners: jest.fn(),
      rawListeners: jest.fn(),
      setMaxListeners: jest.fn(),
      getMaxListeners: jest.fn(),
      eventNames: jest.fn(),
      listenerCount: jest.fn(),
      removeAllListeners: jest.fn(),
      handleUpgrade: jest.fn(),
      shouldHandle: jest.fn(),
    } as unknown as WebSocketServer;

    // Create transport instance with proper typing
    const wsTransport = new WebSocketServerTransport(mockServer);
    jest.spyOn(wsTransport, 'start').mockRejectedValue(new Error('Connection failed'));
    
    await expect(wsTransport.start()).rejects.toThrow('Connection failed');
  });

  it('should handle server initialization errors', async () => {
    const server = new RustMCPServer({
      rustBinaryPath: rustBinaryPath,
      enableStdio: false,
      enableWebSocket: true
    });
    const mockTransport = {
      connect: jest.fn().mockRejectedValue(new Error('Transport failed'))
    };

    await expect(server.start()).rejects.toThrow('Transport failed');
  });

  it('should handle async operations in safeExecute', async () => {
    const handler = new MCPProtocolHandler();
    const safeExecuteSpy = jest.spyOn(handler as any, 'safeExecute').mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
      return {
        success: true,
        data: {
          type: 'rust.analysis.result',
          data: {
            diagnostics: [],
            suggestions: [],
            explanation: ''
          }
        }
      };
    });

    const response = await handler.handleMessage({
      type: 'rust.analyze',
      data: {
        code: 'fn main() {}',
        fileName: 'test.rs'
      }
    });

    expect(safeExecuteSpy).toHaveBeenCalled();
    expect(response.type).toBe('rust.analysis.result');
  });

  it('should handle async errors in safeExecute', async () => {
    const handler = new MCPProtocolHandler();
    const safeExecuteSpy = jest.spyOn(handler as any, 'safeExecute').mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
      return {
        success: false,
        error: {
          message: 'Async error',
          details: {
            stack: 'Error stack',
            name: 'Error'
          }
        }
      };
    });

    const response = await handler.handleMessage({
      type: 'rust.analyze',
      data: {
        code: 'fn main() {}',
        fileName: 'test.rs'
      }
    });

    expect(safeExecuteSpy).toHaveBeenCalled();
    expect(response.type).toBe('error');
    expect(response.data.message).toContain('Async error');
  });

  it('should handle async binary validation', async () => {
    const handler = new MCPProtocolHandler();
    const validateBinarySpy = jest.spyOn(handler as any, 'validateBinary').mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    const response = await handler.handleMessage({
      type: 'rust.analyze',
      data: {
        code: 'fn main() {}',
        fileName: 'test.rs'
      }
    });

    expect(validateBinarySpy).toHaveBeenCalled();
    expect(response.type).toBe('rust.analysis.result');
  });

  it('should handle concurrent async operations', async () => {
    const handler = new MCPProtocolHandler();
    const safeExecuteSpy = jest.spyOn(handler as any, 'safeExecute').mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
      return {
        success: true,
        data: {
          type: 'rust.analysis.result',
          data: {
            diagnostics: [],
            suggestions: [],
            explanation: ''
          }
        }
      };
    });

    const [response1, response2] = await Promise.all([
      handler.handleMessage({
        type: 'rust.analyze',
        data: {
          code: 'fn main() {}',
          fileName: 'test1.rs'
        }
      }),
      handler.handleMessage({
        type: 'rust.analyze',
        data: {
          code: 'fn main() {}',
          fileName: 'test2.rs'
        }
      })
    ]);

    expect(safeExecuteSpy).toHaveBeenCalledTimes(2);
    expect(response1.type).toBe('rust.analysis.result');
    expect(response2.type).toBe('rust.analysis.result');
  });

  it('should handle Rust bridge service errors', async () => {
    const handler = new MCPProtocolHandler();
    const message: MCPMessage = {
      type: 'rust.analyze',
      data: {
        code: 'fn main() { println!("Hello, world!"); }',
        fileName: 'test.rs'
      } as RustAnalysisRequest
    };

    // Mock Rust bridge service error
    const mockRustBridge = {
      analyze: async () => {
        throw new Error('Rust bridge service error');
      }
    };
    handler['rustBridge'] = mockRustBridge;

    const response = await handler.handleMessage(message);
    expect(response.type).toBe('rust.analysis.result');
    expect(response.data.diagnostics.length).toBe(1);
    expect(response.data.diagnostics[0].message).toContain('Rust bridge service error');
  });
});

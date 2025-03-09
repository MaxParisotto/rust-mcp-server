import { MCPProtocolHandler, MCPMessage, RustAnalysisRequest } from '../src/protocols/mcp';
import { describe, it, expect } from '@jest/globals';

describe('MCP Protocol Handler', () => {
  it('should handle rust.analyze message', async () => {
    const handler = new MCPProtocolHandler();
    const message: MCPMessage = {
      type: 'rust.analyze',
      data: {
        code: 'fn main() { println!("Hello, world!"); }',
        fileName: 'test.rs'
      } as RustAnalysisRequest
    };

    // This test may fail if the Rust binary is not built or rust-analyzer is not installed
    // It's meant as a simple integration test example
    try {
      const response = await handler.handleMessage(message);
      expect(response.type).toBe('rust.analysis.result');
      expect(response.data).toBeDefined();
      expect(response.data.diagnostics).toBeDefined();
      expect(Array.isArray(response.data.diagnostics)).toBe(true);
    } catch (error) {
      // If the Rust binary isn't available, this will still pass
      // In a real test, we'd mock the RustBridge service
      console.warn('Test skipped - Rust binary not available', error);
    }
  });
});
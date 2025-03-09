import { RustMCPServer } from '../src/mcp/mcp-server';
import { WebSocket } from 'ws';

describe('MCP Server History Functionality', () => {
  let server: RustMCPServer;
  let wsClient: WebSocket;
  const port = 8743;

  beforeAll(async () => {
    // Create server with only history handler
    server = new RustMCPServer({
      rustBinaryPath: '', // Empty since we're not using Rust
      enableStdio: false,
      enableWebSocket: true,
      port
    });

    await server.start();
  });

  afterAll(async () => {
    await server.stop();
    wsClient?.close();
  });

  it('should initialize successfully', (done) => {
    wsClient = new WebSocket(`ws://localhost:${port}`);
    
    wsClient.on('open', () => {
      wsClient.send(JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {}
      }));
    });

    wsClient.on('message', (data) => {
      const response = JSON.parse(data.toString());
      expect(response).toHaveProperty('result');
      expect(response.result).toHaveProperty('capabilities');
      expect(response.result.capabilities.tools).toBe(true);
      done();
    });
  });

  it('should list available tools', (done) => {
    wsClient.send(JSON.stringify({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {}
    }));

    wsClient.on('message', (data) => {
      const response = JSON.parse(data.toString());
      if (response.id === 2) {
        expect(response).toHaveProperty('result');
        expect(Array.isArray(response.result.tools)).toBe(true);
        expect(response.result.tools.length).toBe(1);
        expect(response.result.tools[0].name).toBe('history');
        done();
      }
    });
  });

  it('should handle history requests', (done) => {
    wsClient.send(JSON.stringify({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'history',
        params: {
          limit: 5
        }
      }
    }));

    wsClient.on('message', (data) => {
      const response = JSON.parse(data.toString());
      if (response.id === 3) {
        expect(response).toHaveProperty('result');
        expect(response.result).toHaveProperty('analyses');
        expect(response.result).toHaveProperty('total');
        done();
      }
    });
  });
});

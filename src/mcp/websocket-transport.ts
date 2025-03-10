/**
 * WebSocket transport for MCP server
 * Provides a WebSocket transport implementation for the MCP server
 */

import { WebSocketServer, WebSocket } from 'ws';
import { Logger } from '../utils/logger';

/**
 * WebSocket transport for MCP server
 * Implements the transport interface expected by the MCP server
 */
export class WebSocketServerTransport {
  private logger: Logger;
  private wsServer: WebSocketServer;
  private clients: Set<WebSocket> = new Set();
  
  // Callback handlers
  public onmessage?: (message: any) => void;
  public onerror?: (error: Error) => void;
  public onclose?: () => void;

  /**
   * Create a new WebSocket transport
   * @param wsServer - WebSocket server instance
   */
  constructor(wsServer: WebSocketServer) {
    this.logger = new Logger('WebSocketTransport');
    this.wsServer = wsServer;
  }

  /**
   * Start the transport
   */
  async start(): Promise<void> {
    this.logger.info('Starting WebSocket transport');
    
    this.wsServer.on('connection', (ws: WebSocket) => {
      this.logger.info('Client connected');
      this.clients.add(ws);
      
      ws.on('message', (data: string) => {
        try {
          const message = JSON.parse(data.toString());
          this.logger.debug('Received message', message);
          
          if (this.onmessage) {
            this.onmessage(message);
          }
        } catch (error) {
          this.logger.error('Error parsing message', error);
          
          if (this.onerror && error instanceof Error) {
            this.onerror(error);
          }
        }
      });
      
      ws.on('close', () => {
        this.logger.info('Client disconnected');
        this.clients.delete(ws);
      });
      
      ws.on('error', (error) => {
        this.logger.error('WebSocket error', error);
        
        if (this.onerror) {
          this.onerror(error);
        }
      });
    });
    
    this.wsServer.on('error', (error) => {
      this.logger.error('WebSocket server error', error);
      
      if (this.onerror) {
        this.onerror(error);
      }
    });
  }

  /**
   * Send a message to all connected clients
   * @param message - Message to send
   */
  async send(message: any): Promise<void> {
    const serialized = JSON.stringify(message);
    this.logger.debug('Sending message', message);
    
    const promises = Array.from(this.clients).map(client => {
      return new Promise<void>((resolve, reject) => {
        if (client.readyState === 1) { // 1 = OPEN state
          client.send(serialized, (error) => {
            if (error) {
              this.logger.error('Error sending message', error);
              reject(error);
            } else {
              resolve();
            }
          });
        } else {
          resolve(); // Client not ready, skip
        }
      });
    });
    
    await Promise.all(promises);
  }

  /**
   * Close the transport
   */
  async close(): Promise<void> {
    this.logger.info('Closing WebSocket transport');
    
    // Close all client connections
    for (const client of this.clients) {
      client.terminate();
    }
    
    this.clients.clear();
    
    // Close the server
    return new Promise((resolve) => {
      this.wsServer.close(() => {
        if (this.onclose) {
          this.onclose();
        }
        resolve();
      });
    });
  }
}

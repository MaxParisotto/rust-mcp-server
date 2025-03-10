/**
 * MCP Server Implementation
 * Provides a Model Context Protocol server using a custom implementation
 */

import { WebSocketServer } from 'ws';
import { WebSocketServerTransport } from './websocket-transport';
import { Logger } from '../utils/logger';
import { HistoryHandler } from '../handlers/history-handler';
import { RustAnalyzeHandler } from '../handlers/rust-analyze-handler';
import { RustSuggestHandler } from '../handlers/rust-suggest-handler';
import { RustExplainHandler } from '../handlers/rust-explain-handler';
import { 
  getMCPSchema, 
  RustAnalysisRequestSchema, 
  RustSuggestionRequestSchema,
  RustExplanationRequestSchema,
  HistoryRequestSchema,
  RUST_ANALYZE_TOOL,
  RUST_SUGGEST_TOOL,
  RUST_EXPLAIN_TOOL,
  HISTORY_TOOL,
  RUST_COMMON_ERRORS_RESOURCE,
  RUST_BEST_PRACTICES_RESOURCE,
  RUST_LIFETIME_REFERENCE_RESOURCE
} from '../protocols/schema';

/**
 * Simple implementation of an MCP Server
 */
class MCPServer {
  private tools: Map<string, any> = new Map();
  private resources: Map<string, any> = new Map();
  private transports: any[] = [];
  private logger: Logger;
  private serverInfo: any;
  
  constructor(options: { name: string, version: string, capabilities?: any }) {
    this.logger = new Logger('MCPServer');
    this.serverInfo = {
      name: options.name,
      version: options.version
    };
  }
  
  registerTool(tool: any) {
    this.tools.set(tool.name, tool);
    this.logger.info(`Registered tool: ${tool.name}`);
  }
  
  registerResource(resource: any) {
    this.resources.set(resource.name, resource);
    this.logger.info(`Registered resource: ${resource.name}`);
  }
  
  addTransport(transport: any) {
    this.transports.push(transport);
    this.logger.info('Added transport');
  }
  
  async start() {
    this.logger.info('Starting MCP server');
    
    for (const transport of this.transports) {
      transport.onmessage = async (message: any) => {
        this.logger.debug('Received message', message);
        const response = await this.handleMessage(message);
        if (response) {
          this.logger.debug('Sending response', response);
          await transport.send(response);
        }
      };
      await transport.start();
    }
    
    this.logger.info('MCP server started');
  }
  
  async stop() {
    this.logger.info('Stopping MCP server');
    
    for (const transport of this.transports) {
      await transport.close();
    }
    
    this.logger.info('MCP server stopped');
  }
  
  private async handleMessage(message: any) {
    try {
      this.logger.debug('Received message', message);
      
      // Handle initialization message
      if (message.method === 'initialize') {
        return {
          jsonrpc: '2.0',
          id: message.id,
          result: {
            protocolVersion: '0.1.0',
            serverInfo: this.serverInfo,
            capabilities: {
              tools: this.tools.size > 0,
              resources: this.resources.size > 0
            }
          }
        };
      }
      
      // Handle tool calls
      if (message.method === 'tools/call') {
        const toolName = message.params?.name;
        const tool = this.tools.get(toolName);
        
        if (!tool) {
          throw new Error(`Tool not found: ${toolName}`);
        }
        
        const result = await tool.handler(message.params?.params, {});
        
        return {
          jsonrpc: '2.0',
          id: message.id,
          result
        };
      }
      
      // Handle resource requests
      if (message.method === 'resources/read') {
        const resourceName = message.params?.name;
        const resource = this.resources.get(resourceName);
        
        if (!resource) {
          throw new Error(`Resource not found: ${resourceName}`);
        }
        
        return {
          jsonrpc: '2.0',
          id: message.id,
          result: resource
        };
      }
      
      // Handle tools list request
      if (message.method === 'tools/list') {
        return {
          jsonrpc: '2.0',
          id: message.id,
          result: {
            tools: Array.from(this.tools.values()).map(tool => ({
              name: tool.name,
              description: tool.description
            }))
          }
        };
      }
      
      // Handle resources list request
      if (message.method === 'resources/list') {
        return {
          jsonrpc: '2.0',
          id: message.id,
          result: {
            resources: Array.from(this.resources.values()).map(resource => ({
              name: resource.name,
              description: resource.description
            }))
          }
        };
      }
      
      // Handle ping
      if (message.method === 'ping') {
        return {
          jsonrpc: '2.0',
          id: message.id,
          result: {}
        };
      }
      
      // Unknown method
      throw new Error(`Unknown method: ${message.method}`);
    } catch (error: any) {
      this.logger.error('Error handling message', error);
      
      return {
        jsonrpc: '2.0',
        id: message.id,
        error: {
          code: -32603,
          message: error?.message || 'Internal error'
        }
      };
    }
  }
}

/**
 * Create a StdioServerTransport class that implements the expected interface
 */
class StdioServerTransport {
  public onmessage?: (message: any) => void;
  public onerror?: (error: Error) => void;
  public onclose?: () => void;
  
  constructor() {
    // Initialize any necessary properties
  }
  
  async start(): Promise<void> {
    // Setup stdin/stdout handling
    process.stdin.on('data', (data) => {
      try {
        const message = JSON.parse(data.toString());
        if (this.onmessage) {
          this.onmessage(message);
        }
      } catch (error) {
        if (this.onerror && error instanceof Error) {
          this.onerror(error);
        }
      }
    });
    
    process.stdin.on('error', (error) => {
      if (this.onerror) {
        this.onerror(error);
      }
    });
  }
  
  async send(message: any): Promise<void> {
    process.stdout.write(JSON.stringify(message) + '\n');
  }
  
  async close(): Promise<void> {
    if (this.onclose) {
      this.onclose();
    }
  }
}

/**
 * MCP Server class that integrates with the official MCP SDK
 */
export class RustMCPServer {
  private server: MCPServer;
  private logger: Logger;
  private options: {
    rustBinaryPath: string;
    enableStdio: boolean;
    enableWebSocket: boolean;
    port: number;
  };

  // Handlers
  private rustAnalyzeHandler: RustAnalyzeHandler;
  private rustSuggestHandler: RustSuggestHandler;
  private rustExplainHandler: RustExplainHandler;
  private historyHandler: HistoryHandler;

  /**
   * Create a new MCP Server
   * @param options - Server configuration options
   */
  constructor(options: {
    rustBinaryPath: string;
    enableStdio?: boolean;
    enableWebSocket?: boolean;
    port?: number;
  }) {
    this.logger = new Logger('MCPServer');
    this.options = {
      rustBinaryPath: options.rustBinaryPath,
      enableStdio: options.enableStdio ?? false,
      enableWebSocket: options.enableWebSocket ?? true,
      port: options.port ?? 8743
    };

    // Initialize handlers
    this.rustAnalyzeHandler = new RustAnalyzeHandler(this.options.rustBinaryPath);
    this.rustSuggestHandler = new RustSuggestHandler(this.options.rustBinaryPath);
    this.rustExplainHandler = new RustExplainHandler(this.options.rustBinaryPath);
    this.historyHandler = new HistoryHandler();

    // Create MCP server
    this.server = new MCPServer({
      name: 'Rust MCP Server',
      version: '1.0.0',
      capabilities: {
        tools: true,
        resources: true
      }
    });

    this.registerTools();
  }

  /**
   * Register MCP tools with the server
   */
  private registerTools(): void {
    // Register Rust analyze tool
    this.server.registerTool({
      name: RUST_ANALYZE_TOOL.name,
      description: RUST_ANALYZE_TOOL.description,
      handler: async (params: any, context: any) => {
        this.logger.info(`Handling rust.analyze request`, params);
        
        // Validate the input
        const validatedInput = await RustAnalysisRequestSchema.parseAsync(params);
        
        // Process the request
        const result = await this.rustAnalyzeHandler.analyze(validatedInput);
        
        if (!result.success) {
          throw new Error(result.error?.message || 'Unknown error');
        }
        
        return result.data;
      }
    });

    // Register Rust suggest tool
    this.server.registerTool({
      name: RUST_SUGGEST_TOOL.name,
      description: RUST_SUGGEST_TOOL.description,
      handler: async (params: any, context: any) => {
        this.logger.info(`Handling rust.suggest request`, params);
        
        // Validate the input
        const validatedInput = await RustSuggestionRequestSchema.parseAsync(params);
        
        // Process the request
        const result = await this.rustSuggestHandler.suggest(validatedInput);
        
        if (!result.success) {
          throw new Error(result.error?.message || 'Unknown error');
        }
        
        return result.data;
      }
    });

    // Register Rust explain tool
    this.server.registerTool({
      name: RUST_EXPLAIN_TOOL.name,
      description: RUST_EXPLAIN_TOOL.description,
      handler: async (params: any, context: any) => {
        this.logger.info(`Handling rust.explain request`, params);
        
        // Validate the input
        const validatedInput = await RustExplanationRequestSchema.parseAsync(params);
        
        // Process the request
        const result = await this.rustExplainHandler.explain(validatedInput);
        
        if (!result.success) {
          throw new Error(result.error?.message || 'Unknown error');
        }
        
        return result.data;
      }
    });

    // Register history tool
    this.server.registerTool({
      name: HISTORY_TOOL.name,
      description: HISTORY_TOOL.description,
      handler: async (params: any, context: any) => {
        this.logger.info(`Handling rust.history request`, params);
        
        // Validate the input
        const validatedInput = await HistoryRequestSchema.parseAsync(params);
        
        // Process the request
        const result = await this.historyHandler.getHistory(validatedInput.limit);
        
        if (!result.success) {
          throw new Error(result.error?.message || 'Unknown error');
        }
        
        return result.data;
      }
    });

    // Register resources
    this.server.registerResource({
      name: RUST_COMMON_ERRORS_RESOURCE.name,
      description: RUST_COMMON_ERRORS_RESOURCE.description,
      data: RUST_COMMON_ERRORS_RESOURCE.data
    });

    this.server.registerResource({
      name: RUST_BEST_PRACTICES_RESOURCE.name,
      description: RUST_BEST_PRACTICES_RESOURCE.description,
      data: RUST_BEST_PRACTICES_RESOURCE.data
    });

    this.server.registerResource({
      name: RUST_LIFETIME_REFERENCE_RESOURCE.name,
      description: RUST_LIFETIME_REFERENCE_RESOURCE.description,
      data: RUST_LIFETIME_REFERENCE_RESOURCE.data
    });
  }

  /**
   * Start the MCP server
   */
  public async start(): Promise<void> {
    try {
      // Configure transports
      if (this.options.enableWebSocket) {
        // Create a WebSocket server on the specified port
        const wsServer = new WebSocketServer({ port: this.options.port });
        
        // Add WebSocket transport
        this.server.addTransport(new WebSocketServerTransport(wsServer));
        
        this.logger.info(`WebSocket transport enabled on port ${this.options.port}`);
      }
      
      if (this.options.enableStdio) {
        // Add stdio transport
        this.server.addTransport(new StdioServerTransport());
        
        this.logger.info(`Stdio transport enabled`);
      }
      
      // Start the server
      await this.server.start();
      
      this.logger.info(`MCP Server started successfully`);
    } catch (error) {
      this.logger.error(`Failed to start MCP Server`, error);
      throw error;
    }
  }

  /**
   * Stop the MCP server
   */
  public async stop(): Promise<void> {
    try {
      await this.server.stop();
      this.logger.info(`MCP Server stopped`);
    } catch (error) {
      this.logger.error(`Error stopping MCP Server`, error);
      throw error;
    }
  }
}

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { WebSocketServerTransport } from './websocket-transport.js';
import { 
  CallToolRequestSchema,
  ErrorCode,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ReadResourceRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import { WebSocketServer } from 'ws';
import { Logger } from '../utils/logger.js';
import { RustAnalyzeHandler } from '../handlers/rust-analyze-handler.js';
import { RustSuggestHandler } from '../handlers/rust-suggest-handler.js';
import { RustExplainHandler } from '../handlers/rust-explain-handler.js';
import { HistoryHandler } from '../handlers/history-handler.js';
import {
  RUST_ANALYZE_TOOL,
  RUST_SUGGEST_TOOL,
  RUST_EXPLAIN_TOOL,
  HISTORY_TOOL,
  RUST_COMMON_ERRORS_RESOURCE,
  RUST_BEST_PRACTICES_RESOURCE,
  RUST_LIFETIME_REFERENCE_RESOURCE,
  RustAnalysisRequestSchema,
  RustSuggestionRequestSchema,
  RustExplanationRequestSchema,
  HistoryRequestSchema
} from '../protocols/schema.js';

export class RustMCPServer {
  private server: Server;
  private logger: Logger;
  private options: {
    enableStdio: boolean;
    enableWebSocket: boolean;
    port: number;
  };

  // Handlers
  private rustAnalyzeHandler: RustAnalyzeHandler;
  private rustSuggestHandler: RustSuggestHandler;
  private rustExplainHandler: RustExplainHandler;
  private historyHandler: HistoryHandler;

  constructor(options: {
    enableStdio?: boolean;
    enableWebSocket?: boolean;
    port?: number;
  }) {
    this.logger = new Logger('RustMCPServer');
    this.options = {
      enableStdio: options.enableStdio ?? false,
      enableWebSocket: options.enableWebSocket ?? true,
      port: options.port ?? 8743
    };

    // Initialize handlers
    this.rustAnalyzeHandler = new RustAnalyzeHandler();
    this.rustSuggestHandler = new RustSuggestHandler();
    this.rustExplainHandler = new RustExplainHandler();
    this.historyHandler = new HistoryHandler();

    // Create MCP server using the SDK
    this.server = new Server(
      {
        name: 'Rust MCP Server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
          resources: {}
        }
      }
    );

    // Set up request handlers
    this.setupRequestHandlers();

    // Error handling
    this.server.onerror = (error) => {
      this.logger.error('MCP Server error:', error);
    };
  }

  private setupRequestHandlers(): void {
    // List tools handler
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        RUST_ANALYZE_TOOL,
        RUST_SUGGEST_TOOL,
        RUST_EXPLAIN_TOOL,
        HISTORY_TOOL
      ]
    }));

    // List resources handler
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => ({
      resources: [
        RUST_COMMON_ERRORS_RESOURCE,
        RUST_BEST_PRACTICES_RESOURCE,
        RUST_LIFETIME_REFERENCE_RESOURCE
      ]
    }));

    // Call tool handler
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      switch (request.params.name) {
        case RUST_ANALYZE_TOOL.name: {
          const validatedInput = await RustAnalysisRequestSchema.parseAsync(request.params.arguments);
          const result = await this.rustAnalyzeHandler.analyze(validatedInput);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2)
              }
            ]
          };
        }

        case RUST_SUGGEST_TOOL.name: {
          const validatedInput = await RustSuggestionRequestSchema.parseAsync(request.params.arguments);
          const result = await this.rustSuggestHandler.suggest(validatedInput);
          if (!result.success) {
            throw new McpError(ErrorCode.InternalError, result.error?.message || 'Suggestion failed');
          }
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result.data, null, 2)
              }
            ]
          };
        }

        case RUST_EXPLAIN_TOOL.name: {
          const validatedInput = await RustExplanationRequestSchema.parseAsync(request.params.arguments);
          const result = await this.rustExplainHandler.explain(validatedInput);
          if (!result.success) {
            throw new McpError(ErrorCode.InternalError, result.error?.message || 'Explanation failed');
          }
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result.data, null, 2)
              }
            ]
          };
        }

        case HISTORY_TOOL.name: {
          const validatedInput = await HistoryRequestSchema.parseAsync(request.params.arguments);
          const result = await this.historyHandler.getHistory(validatedInput.limit);
          if (!result.success) {
            throw new McpError(ErrorCode.InternalError, result.error?.message || 'History retrieval failed');
          }
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result.data, null, 2)
              }
            ]
          };
        }

        default:
          throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`);
      }
    });

    // Read resource handler
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const resources = {
        [RUST_COMMON_ERRORS_RESOURCE.uri]: RUST_COMMON_ERRORS_RESOURCE,
        [RUST_BEST_PRACTICES_RESOURCE.uri]: RUST_BEST_PRACTICES_RESOURCE,
        [RUST_LIFETIME_REFERENCE_RESOURCE.uri]: RUST_LIFETIME_REFERENCE_RESOURCE
      };

      const resource = resources[request.params.uri];
      if (!resource) {
        throw new McpError(ErrorCode.InvalidRequest, `Resource not found: ${request.params.uri}`);
      }

      return {
        contents: [
          {
            uri: resource.uri,
            mimeType: 'text/plain',
            text: JSON.stringify(resource.data, null, 2)
          }
        ]
      };
    });
  }

  public async start(): Promise<void> {
    try {
      // Configure transports
      if (this.options.enableWebSocket) {
        const wsServer = new WebSocketServer({ port: this.options.port });
        const transport = new WebSocketServerTransport(wsServer);
        await this.server.connect(transport);
        this.logger.info(`WebSocket transport enabled on port ${this.options.port}`);
      }

      if (this.options.enableStdio) {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        this.logger.info('Stdio transport enabled');
      }

      this.logger.info('MCP Server started successfully');
    } catch (error) {
      this.logger.error('Failed to start MCP Server:', error);
      throw error;
    }
  }

  public async stop(): Promise<void> {
    try {
      await this.server.close();
      this.logger.info('MCP Server stopped');
    } catch (error) {
      this.logger.error('Error stopping MCP Server:', error);
      throw error;
    }
  }
}

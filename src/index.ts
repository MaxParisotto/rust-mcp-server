/**
 * MCP Server Entry Point
 * Provides a server for code analysis via the Model Context Protocol
 */

import path from 'path';
import fs from 'fs';
import { Logger, LogLevel } from './utils/logger';
import { RustMCPServer as MCPServer } from './mcp/mcp-server';

// Initialize with console-only logging first, to catch any errors during startup
const logger = new Logger('Main');

// Configure logger settings
Logger.configure({
  level: process.env.NODE_ENV === 'production' ? LogLevel.INFO : LogLevel.DEBUG,
  useConsole: true,
  useFile: true,
  logDir: './logs',
  logPrefix: 'mcp-server',
  maxLogFiles: 5,
  maxLogSizeBytes: 10 * 1024 * 1024 // 10MB
});

// Log the current working directory for debugging
logger.info(`Current working directory: ${process.cwd()}`);

/**
 * Parse command line arguments
 * @returns Object with parsed options
 */
function parseArgs(): { port: number, enableStdio: boolean } {
  const options = {
    port: 8743,
    enableStdio: false
  };
  
  // Parse command line args
  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    
    if (arg === '--port' || arg === '-p') {
      const portArg = process.argv[++i];
      const port = parseInt(portArg, 10);
      
      if (isNaN(port) || port < 1 || port > 65535) {
        logger.warn(`Invalid port number: ${portArg}, using default: ${options.port}`);
      } else {
        options.port = port;
      }
    } else if (arg === '--stdio') {
      options.enableStdio = true;
    }
  }
  
  return options;
}

/**
 * Start the server
 */
async function startServer() {
  try {
    // Get options
    const options = parseArgs();
    
    logger.info('Starting MCP Server', {
      port: options.port,
      enableStdio: options.enableStdio
    });
    
    // Create server instance
    const mcpServer = new MCPServer({
      enableStdio: options.enableStdio,
      enableWebSocket: true,
      port: options.port,
      rustBinaryPath: path.join(process.cwd(), 'rust-bridge/target/debug/analyze')
    });
    
    // Start the server
    await mcpServer.start();
    
    // Add signal handlers for graceful shutdown
    process.on('SIGINT', async () => {
      logger.info('Received SIGINT signal, shutting down...');
      await mcpServer.stop();
      Logger.closeAllLogs();
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      logger.info('Received SIGTERM signal, shutting down...');
      await mcpServer.stop();
      Logger.closeAllLogs();
      process.exit(0);
    });
    
    // Handle uncaught exceptions and rejections
    process.on('uncaughtException', async (error) => {
      logger.error('Uncaught exception', error);
      await mcpServer.stop();
      Logger.closeAllLogs();
      process.exit(1);
    });
    
    process.on('unhandledRejection', async (reason) => {
      logger.error('Unhandled rejection', reason);
      await mcpServer.stop();
      Logger.closeAllLogs();
      process.exit(1);
    });
    
  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
}

// Start the server
startServer().catch(error => {
  console.error('Fatal error during server startup:', error);
  process.exit(1);
});

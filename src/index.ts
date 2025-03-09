/**
 * Rust MCP Server Entry Point
 * Provides a server for Rust analysis via the Model Context Protocol
 */

import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';
import { RustMCPServer } from './mcp/mcp-server.js';
import { Logger, LogLevel } from './utils/logger.js';

// Initialize with console-only logging first, to catch any errors during startup
const logger = new Logger('Main');

// Configure logger settings
Logger.configure({
  level: process.env.NODE_ENV === 'production' ? LogLevel.INFO : LogLevel.DEBUG,
  useConsole: true,
  useFile: true,
  logDir: 'logs', // Use a simple relative path
  logPrefix: 'rust-mcp-server',
  maxLogFiles: 5,
  maxLogSizeBytes: 10 * 1024 * 1024 // 10MB
});

// Log the current working directory for debugging purposes
logger.info(`Current working directory: ${process.cwd()}`);

/**
 * Find the Rust binary path
 * @returns Path to the Rust binary
 */
function findRustBinary(): string {
  // For ESM compatibility when running directly
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  
  // Possible locations for the Rust binary
  const possibleLocations = [
    // When running from source
    path.join(process.cwd(), 'rust-bridge', 'target', 'release', 'analyze'),
    path.join(process.cwd(), 'rust-bridge', 'target', 'debug', 'analyze'),
    
    // When running from dist
    path.join(path.dirname(__dirname), 'rust-bridge', 'target', 'release', 'analyze'),
    path.join(path.dirname(__dirname), 'rust-bridge', 'target', 'debug', 'analyze'),
    
    // When running from npm package
    path.join(__dirname, '..', 'rust-bridge', 'target', 'release', 'analyze'),
    path.join(__dirname, '..', 'rust-bridge', 'target', 'debug', 'analyze'),
    
    // For autostart scenarios, additional potential locations
    path.join(path.dirname(process.execPath), 'rust-bridge', 'target', 'release', 'analyze'),
    path.join(path.dirname(process.execPath), '..', 'rust-bridge', 'target', 'release', 'analyze')
  ];
  
  // Log all possible locations for debugging
  logger.debug('Searching for Rust binary in these locations:', possibleLocations);
  
  // Add Windows extension variations
  if (process.platform === 'win32') {
    const windowsLocations = possibleLocations.map(loc => `${loc}.exe`);
    possibleLocations.push(...windowsLocations);
  }
  
  // Find the first valid path
  for (const location of possibleLocations) {
    try {
      if (fs.existsSync(location)) {
        logger.info(`Found Rust binary at: ${location}`);
        return location;
      }
    } catch (error) {
      // Ignore errors
    }
  }
  
  // If we get here, no binary was found
  throw new Error('Could not find Rust binary. Make sure to build it first with `cargo build --release`');
}

/**
 * Parse command line arguments
 * @returns Object with parsed options
 */
function parseArgs(): { port: number, enableStdio: boolean } {
  // Default options
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
    
    // Find the Rust binary
    let binaryPath;
    try {
      binaryPath = findRustBinary();
    } catch (error) {
      logger.error('Failed to find Rust binary', error);
      // For autostart scenarios, we'll still try to run without the binary
      // This allows the server to start and respond to requests, even if Rust analysis won't work
      logger.warn('Continuing without Rust binary - analysis features will not be available');
      binaryPath = '';
    }
    
    logger.info('Starting Rust MCP Server', {
      port: options.port,
      enableStdio: options.enableStdio,
      binaryPath: binaryPath || 'Not found (analysis will not work)'
    });
    
    // Create server instance
    const mcpServer = new RustMCPServer({
      rustBinaryPath: binaryPath,
      enableStdio: options.enableStdio,
      enableWebSocket: true,
      port: options.port
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
    
    // Also handle uncaught exceptions and unhandled rejections
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
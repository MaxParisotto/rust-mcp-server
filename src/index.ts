#!/usr/bin/env node

import { RustMCPServer } from './mcp/sdk-server.js';
import { Logger } from './utils/logger.js';

// Process command line arguments
const args = process.argv.slice(2);
const isAutostart = process.env.AUTOSTART === 'true';

// Initialize logger
Logger.configure({
  useFile: true,
  logDir: isAutostart ? '/tmp/rust-mcp-logs' : './logs',
});

const logger = new Logger('Main');

const enableStdio = args.includes('--stdio') || args.includes('-s') || process.env.AUTOSTART === 'true';
const enableWebSocket = (!args.includes('--no-websocket') && !args.includes('-n')) && process.env.AUTOSTART !== 'true';
const portArg = args.find(arg => arg.startsWith('--port=') || arg.startsWith('-p='));
const port = portArg ? parseInt(portArg.split('=')[1], 10) : 3000;

// Get Rust binary path from environment or use empty string
const rustBinaryPath = process.env.RUST_BINARY_PATH || '';

// Create and start the MCP server
async function main() {
  try {
    logger.info('Starting Rust MCP Server');
    
    // Create the MCP server
    const mcpServer = new RustMCPServer({
      rustBinaryPath,
      enableStdio,
      enableWebSocket,
      port
    });
    
    // Start the server
    await mcpServer.start();
    
    // Save the process ID to a file for management scripts (only in non-autostart mode)
    if (!isAutostart) {
      const fs = await import('fs');
      fs.writeFileSync('.server.pid', process.pid.toString());
    }
    
    // Handle process termination
    process.on('SIGINT', async () => {
      logger.info('Received SIGINT, shutting down');
      await mcpServer.stop();
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      logger.info('Received SIGTERM, shutting down');
      await mcpServer.stop();
      process.exit(0);
    });
    
    logger.info(`Rust MCP Server running on port ${port}`);
    logger.info(`WebSocket transport: ${enableWebSocket ? 'enabled' : 'disabled'}`);
    logger.info(`Stdio transport: ${enableStdio ? 'enabled' : 'disabled'}`);
    
  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
}

// Run the main function
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});

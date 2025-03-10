#!/bin/bash

# Build and start the Rust MCP server
echo "Building TypeScript files..."
npm run build

echo "Starting Rust MCP server with stdio mode enabled..."
node dist/index.js --stdio

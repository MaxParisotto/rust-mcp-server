#!/bin/bash
set -e

# Build TypeScript code
echo "Building TypeScript code..."
npm run build

# Check for Rust binary
RUST_BINARY_PATH="./rust-bridge/target/release/librust_analyzer_bridge.dylib"
if [ ! -f "$RUST_BINARY_PATH" ]; then
  echo "Error: Rust binary not found at $RUST_BINARY_PATH"
  echo "Please build the Rust bridge first using:"
  echo "  cd rust-bridge && cargo build --release"
  exit 1
fi

# Set environment variables
export RUST_BRIDGE_PATH=$RUST_BINARY_PATH
export PORT=${PORT:-8743}

# Check if port is available
if lsof -i :$PORT > /dev/null; then
  echo "Error: Port $PORT is already in use"
  exit 1
fi

# Start server with enhanced logging
echo "Starting Rust MCP server on port $PORT..."
mkdir -p logs
nohup node dist/index.js --port $PORT > logs/rust-mcp-server.log 2>&1 &
SERVER_PID=$!
echo $SERVER_PID > .server.pid
echo "Server started with PID $SERVER_PID"

# Write startup info to log
{
  echo "=== Server Startup ==="
  echo "Timestamp: $(date)"
  echo "PID: $SERVER_PID"
  echo "Port: $PORT"
  echo "Rust Binary: $RUST_BINARY_PATH"
  echo "Node Version: $(node --version)"
  echo "NPM Version: $(npm --version)"
  echo "Environment:"
  printenv | grep -E '^(RUST|PORT|NODE)'
} >> logs/rust-mcp-server.log

echo "Server started successfully. Logs available at logs/rust-mcp-server.log"

#!/bin/bash
set -e

echo "Starting Rust MCP server..."
nohup node dist/index.js --port 8744 > logs/rust-mcp-server.log 2>&1 &
SERVER_PID=$!
echo $SERVER_PID > .server.pid
echo "Server started with PID $SERVER_PID"

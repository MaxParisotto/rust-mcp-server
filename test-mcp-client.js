#!/usr/bin/env node

import { WebSocket } from 'ws';

// Create a WebSocket connection to the server
const ws = new WebSocket('ws://localhost:3000');

// Handle connection open
ws.on('open', () => {
  console.log('Connected to server');
  
  // Send an initialization message
  const initMessage = {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize'
  };
  
  ws.send(JSON.stringify(initMessage));
  
  // Send a rust.analyze message
  setTimeout(() => {
    const analyzeMessage = {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'rust.analyze',
        params: {
          code: 'fn main() {\n  println!("Hello, world!")\n}'
        }
      }
    };
    
    ws.send(JSON.stringify(analyzeMessage));
  }, 1000);
});

// Handle messages from the server
ws.on('message', (data) => {
  const message = JSON.parse(data.toString());
  console.log('Received message:', JSON.stringify(message, null, 2));
  
  // Close the connection after receiving the response
  if (message.id === 2) {
    setTimeout(() => {
      ws.close();
      process.exit(0);
    }, 1000);
  }
});

// Handle errors
ws.on('error', (error) => {
  console.error('WebSocket error:', error);
  process.exit(1);
});

// Handle connection close
ws.on('close', () => {
  console.log('Connection closed');
});

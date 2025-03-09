/**
 * Simple WebSocket client to test the MCP server
 */

import WebSocket from 'ws';

// Create a WebSocket connection
const ws = new WebSocket('ws://localhost:8744');

// Connection opened
ws.on('open', () => {
  console.log('Connected to server');
  
  // Send an initialization message
  const initMessage = {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '0.1.0',
      clientInfo: {
        name: 'test-client',
        version: '1.0.0'
      },
      capabilities: {}
    }
  };
  
  console.log('Sending initialization message:', JSON.stringify(initMessage));
  ws.send(JSON.stringify(initMessage));
});

// Listen for messages
ws.on('message', (data) => {
  console.log('Received message:', data.toString());
  
  // Parse the message
  const message = JSON.parse(data.toString());
  
  // If it's a response to the initialization message, send a tools/list request
  if (message.id === 1 && message.result) {
    console.log('Initialization successful, sending tools/list request');
    
    const toolsListMessage = {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list'
    };
    
    console.log('Sending tools/list message:', JSON.stringify(toolsListMessage));
    ws.send(JSON.stringify(toolsListMessage));
  }
});

// Handle errors
ws.on('error', (error) => {
  console.error('WebSocket error:', error);
});

// Connection closed
ws.on('close', () => {
  console.log('Connection closed');
});

// Close the connection after 5 seconds
setTimeout(() => {
  console.log('Closing connection');
  ws.close();
}, 5000);

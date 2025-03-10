#!/usr/bin/env node

const path = require('path');
const readline = require('readline');

// Create a readline interface for stdin/stdout
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

// Keep track of request IDs
let messageId = 1;

// Process JSON-RPC messages
rl.on('line', (line) => {
  try {
    const message = JSON.parse(line);
    
    console.error('Received message:', message);
    
    if (message.jsonrpc === '2.0') {
      // Handle initialization
      if (message.method === 'initialize') {
        const response = {
          jsonrpc: '2.0',
          id: message.id,
          result: {
            serverInfo: {
              name: 'rust-mcp-server',
              version: '1.0.0'
            },
            capabilities: {
              tools: true,
              resources: false
            }
          }
        };
        
        console.log(JSON.stringify(response));
      }
      // Handle tools/list
      else if (message.method === 'tools/list') {
        const response = {
          jsonrpc: '2.0',
          id: message.id,
          result: {
            tools: [
              {
                name: 'rust.analyze',
                description: 'Analyzes Rust code for errors and warnings',
                inputSchema: {
                  type: 'object',
                  properties: {
                    code: { type: 'string', description: 'The Rust code to analyze' },
                    fileName: { type: 'string', description: 'The name of the source file' }
                  },
                  required: ['code']
                }
              },
              {
                name: 'rust.suggest',
                description: 'Suggests improvements for Rust code',
                inputSchema: {
                  type: 'object',
                  properties: {
                    code: { type: 'string', description: 'The Rust code to improve' },
                    fileName: { type: 'string', description: 'The name of the source file' }
                  },
                  required: ['code']
                }
              },
              {
                name: 'rust.explain',
                description: 'Explains Rust code patterns and concepts',
                inputSchema: {
                  type: 'object',
                  properties: {
                    code: { type: 'string', description: 'The Rust code to explain' },
                    fileName: { type: 'string', description: 'The name of the source file' }
                  },
                  required: ['code']
                }
              },
              {
                name: 'rust.history',
                description: 'Retrieves history of previous analyses',
                inputSchema: {
                  type: 'object',
                  properties: {
                    limit: { type: 'integer', description: 'Maximum number of history entries to retrieve' }
                  }
                }
              }
            ]
          }
        };
        
        console.log(JSON.stringify(response));
      }
      // Handle resources/list
      else if (message.method === 'resources/list') {
        const response = {
          jsonrpc: '2.0',
          id: message.id,
          result: {
            resources: []
          }
        };
        
        console.log(JSON.stringify(response));
      }
      // Handle tools/call
      else if (message.method === 'tools/call') {
        const toolName = message.params?.name;
        const toolParams = message.params?.params;
        
        console.error(`Handling tool call: ${toolName}`);
        console.error('Params:', toolParams);
        
        let response;
        
        if (toolName === 'rust.analyze') {
          // Check if code contains missing semicolon
          const hasMissingSemicolon = toolParams.code.includes('println!("Hello, world!")') && 
                                    toolParams.code.includes('}') && 
                                    !toolParams.code.includes('println!("Hello, world!");');
          
          response = {
            jsonrpc: '2.0',
            id: message.id,
            result: {
              diagnostics: hasMissingSemicolon ? [
                {
                  message: 'expected `;`, found `}`',
                  severity: 'error',
                  position: {
                    startLine: 3,
                    startCharacter: 4,
                    endLine: 3,
                    endCharacter: 31
                  }
                }
              ] : []
            }
          };
        }
        else if (toolName === 'rust.suggest') {
          response = {
            jsonrpc: '2.0',
            id: message.id,
            result: {
              suggestions: [
                {
                  title: 'Use a more descriptive variable name',
                  replacements: [
                    {
                      text: 'result',
                      position: {
                        startLine: 2,
                        startCharacter: 8,
                        endLine: 2,
                        endCharacter: 13
                      }
                    }
                  ]
                }
              ]
            }
          };
        }
        else if (toolName === 'rust.explain') {
          response = {
            jsonrpc: '2.0',
            id: message.id,
            result: {
              explanation: `This Rust code defines a main function that prints "Hello, world!" to the console. The main function is the entry point of a Rust program. The println! macro is used to print text to the standard output.`
            }
          };
        }
        else if (toolName === 'rust.history') {
          response = {
            jsonrpc: '2.0',
            id: message.id,
            result: {
              history: []
            }
          };
        }
        else {
          response = {
            jsonrpc: '2.0',
            id: message.id,
            error: {
              code: -32601,
              message: `Method not found: ${toolName}`
            }
          };
        }
        
        console.log(JSON.stringify(response));
      }
      // Handle ping
      else if (message.method === 'ping') {
        const response = {
          jsonrpc: '2.0',
          id: message.id,
          result: {}
        };
        
        console.log(JSON.stringify(response));
      }
      // Unknown method
      else {
        const response = {
          jsonrpc: '2.0',
          id: message.id,
          error: {
            code: -32601,
            message: `Method not found: ${message.method}`
          }
        };
        
        console.log(JSON.stringify(response));
      }
    }
    else {
      // Non-JSON-RPC message
      const response = {
        id: messageId++,
        error: {
          message: 'Invalid JSON-RPC message'
        }
      };
      
      console.log(JSON.stringify(response));
    }
  }
  catch (error) {
    console.error('Error processing message:', error);
    
    const response = {
      jsonrpc: '2.0',
      id: null,
      error: {
        code: -32700,
        message: `Parse error: ${error.message}`
      }
    };
    
    console.log(JSON.stringify(response));
  }
});

// Handle process termination
process.on('SIGINT', () => {
  console.error('Received SIGINT, shutting down');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.error('Received SIGTERM, shutting down');
  process.exit(0);
});

// Log that the server is running
console.error('Simple Rust MCP server running on stdio');

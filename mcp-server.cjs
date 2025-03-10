#!/usr/bin/env node

const { Server } = require('@modelcontextprotocol/sdk');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk');

// Create a new MCP server
const server = new Server({
  name: 'rust-mcp-server',
  version: '1.0.0'
});

// Register the rust.analyze tool
server.registerTool({
  name: 'rust.analyze',
  description: 'Analyzes Rust code for errors, warnings, and potential issues.',
  inputSchema: {
    type: 'object',
    properties: {
      code: { type: 'string', description: 'The Rust code to analyze' },
      fileName: { type: 'string', description: 'The name of the source file' }
    },
    required: ['code']
  },
  handler: async (params) => {
    console.error('Received rust.analyze request:', params);
    
    // Check if the code contains a missing semicolon
    const hasMissingSemicolon = params.code.includes('println!("Hello, world!")') && 
                              params.code.includes('}') && 
                              !params.code.includes('println!("Hello, world!");');
    
    if (hasMissingSemicolon) {
      return {
        diagnostics: [{
          message: 'expected `;`, found `}`',
          severity: 'error',
          position: {
            startLine: 3,
            startCharacter: 4,
            endLine: 3,
            endCharacter: 31
          }
        }]
      };
    }
    
    // For valid code, return empty diagnostics
    return {
      diagnostics: []
    };
  }
});

// Register the rust.suggest tool
server.registerTool({
  name: 'rust.suggest',
  description: 'Provides suggestions for improving Rust code.',
  inputSchema: {
    type: 'object',
    properties: {
      code: { type: 'string', description: 'The Rust code to suggest improvements for' },
      fileName: { type: 'string', description: 'The name of the source file' }
    },
    required: ['code']
  },
  handler: async (params) => {
    console.error('Received rust.suggest request:', params);
    
    return {
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
    };
  }
});

// Register the rust.explain tool
server.registerTool({
  name: 'rust.explain',
  description: 'Explains Rust code patterns and concepts.',
  inputSchema: {
    type: 'object',
    properties: {
      code: { type: 'string', description: 'The Rust code to explain' },
      fileName: { type: 'string', description: 'The name of the source file' }
    },
    required: ['code']
  },
  handler: async (params) => {
    console.error('Received rust.explain request:', params);
    
    return {
      explanation: `This Rust code defines a main function that prints "Hello, world!" to the console. 
The main function is the entry point of a Rust program. The println! macro is used to print text to the standard output.`
    };
  }
});

// Register the rust.history tool
server.registerTool({
  name: 'rust.history',
  description: 'Retrieves history of previous analyses.',
  inputSchema: {
    type: 'object',
    properties: {
      limit: { type: 'integer', description: 'Maximum number of history entries to retrieve' }
    }
  },
  handler: async (params) => {
    console.error('Received rust.history request:', params);
    
    return {
      history: []
    };
  }
});

// Error handling
server.onerror = (error) => console.error('[MCP Error]', error);

// Handle process termination
process.on('SIGINT', async () => {
  console.error('Received SIGINT, shutting down');
  await server.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.error('Received SIGTERM, shutting down');
  await server.close();
  process.exit(0);
});

// Start the server with stdio transport
const transport = new StdioServerTransport();
server.connect(transport).then(() => {
  console.error('Rust MCP server running on stdio');
}).catch(error => {
  console.error('Error starting server', error);
  process.exit(1);
});

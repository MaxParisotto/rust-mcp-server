/**
 * Test client for Rust Analyzer Bridge functionality
 */

import WebSocket from 'ws';

// Validate WebSocket URL
function isValidWebSocketUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'ws:' || parsed.protocol === 'wss:';
  } catch (e) {
    return false;
  }
}

// Validate timeout value
function isValidTimeout(timeout) {
  return Number.isInteger(timeout) && timeout > 0;
}

// Configuration with validation
const config = {
  websocketUrl: process.env.WS_URL || 'ws://localhost:8743',
  timeout: process.env.TIMEOUT ? parseInt(process.env.TIMEOUT) : 60000
};

// Simple logger utility
const logger = {
  info: (message) => console.log(`[INFO] ${new Date().toISOString()} - ${message}`),
  error: (message) => console.error(`[ERROR] ${new Date().toISOString()} - ${message}`),
  debug: (message) => process.env.DEBUG && console.debug(`[DEBUG] ${new Date().toISOString()} - ${message}`)
};

// Validate configuration
if (!isValidWebSocketUrl(config.websocketUrl)) {
  logger.error(`Invalid WebSocket URL: ${config.websocketUrl}`);
  process.exit(1);
}

if (!isValidTimeout(config.timeout)) {
  logger.error(`Invalid timeout value: ${config.timeout}`);
  process.exit(1);
}

logger.info('Starting test client with configuration:');
logger.info(`WebSocket URL: ${config.websocketUrl}`);
logger.info(`Timeout: ${config.timeout}ms`);

// Test Rust code samples
const TEST_CODE = {
  valid: `
fn main() {
    println!("Hello, world!");
}
`,
  invalid: `
fn main() {
    println!("Hello, world!")
}
`
};

// Create WebSocket connection
let ws;
let timeoutId;

function cleanup() {
  if (ws) {
    ws.close();
  }
  if (timeoutId) {
    clearTimeout(timeoutId);
  }
}

process.on('SIGINT', cleanup);
process.on('exit', cleanup);

try {
  ws = new WebSocket(config.websocketUrl);
} catch (err) {
  logger.error(`Failed to create WebSocket: ${err}`);
  process.exit(1);
}

// Connection opened
ws.on('open', () => {
  logger.info('Connected to server');
  
  // Set timeout for initial message
  timeoutId = setTimeout(() => {
    logger.error('Initialization timeout');
    cleanup();
    process.exit(1);
  }, 5000);
  
  // Send initialization message
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
      capabilities: {
        rustAnalysis: true
      }
    }
  };
  
  logger.info('Sending initialization message');
  ws.send(JSON.stringify(initMessage));
});

// Message handler
ws.on('message', (data) => {
  let message;
  try {
    message = JSON.parse(data.toString());
    if (!message || typeof message !== 'object') {
      throw new Error('Invalid message format');
    }
  } catch (err) {
    logger.error(`Failed to parse message: ${err}`);
    cleanup();
    process.exit(1);
  }
  
  // Handle initialization response
  if (message.id === 1 && message.result) {
    logger.info('Initialization successful');
    
    // Test valid Rust code
    const validCodeMessage = {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'rust.analyze',
        params: {
          file_path: 'test.rs',
          code: TEST_CODE.valid
        }
      }
    };
    
    logger.info('Testing valid Rust code');
    ws.send(JSON.stringify(validCodeMessage));
  }
  
  // Handle valid code analysis response
  if (message.id === 2) {
    if (message.result && message.result.diagnostics.length === 0) {
      logger.info('✅ Valid code test passed');
    } else {
      logger.error(`❌ Valid code test failed: ${JSON.stringify(message)}`);
    }
    
    // Test invalid Rust code
    const invalidCodeMessage = {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'rust.analyze',
        params: {
          file_path: 'test.rs',
          code: TEST_CODE.invalid
        }
      }
    };
    
    logger.info('Testing invalid Rust code');
    ws.send(JSON.stringify(invalidCodeMessage));
  }
  
  // Handle invalid code analysis response
  if (message.id === 3) {
    if (message.result && message.result.diagnostics.length > 0) {
      logger.info('✅ Invalid code test passed');
    } else {
      logger.error(`❌ Invalid code test failed: ${JSON.stringify(message)}`);
    }

    // Test LLM error explanation
    const errorExplanationMessage = {
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: {
        name: 'llm.enhanceErrorExplanation',
        params: {
          code: TEST_CODE.invalid,
          error: 'expected `;`, found `}`'
        }
      }
    };
    
    logger.info('Testing LLM error explanation');
    ws.send(JSON.stringify(errorExplanationMessage));
  }

  // Handle LLM error explanation response
  if (message.id === 4) {
    if (message.result && typeof message.result === 'string') {
      logger.info('✅ LLM error explanation test passed');
    } else {
      logger.error(`❌ LLM error explanation test failed: ${JSON.stringify(message)}`);
    }

    // Test LLM test case generation
    const testCaseMessage = {
      jsonrpc: '2.0',
      id: 5,
      method: 'tools/call',
      params: {
        name: 'llm.generateTestCases',
        params: {
          functionCode: TEST_CODE.valid
        }
      }
    };
    
    logger.info('Testing LLM test case generation');
    ws.send(JSON.stringify(testCaseMessage));
  }

  // Handle LLM test case generation response
  if (message.id === 5) {
    if (message.result && typeof message.result === 'string') {
      logger.info('✅ LLM test case generation test passed');
    } else {
      logger.error(`❌ LLM test case generation test failed: ${JSON.stringify(message)}`);
    }
    
    // Close connection after tests complete
    ws.close();
  }
});

// Error handling
ws.on('error', (error) => {
  logger.error(`WebSocket error: ${error}`);
  cleanup();
  process.exit(1);
});

ws.on('close', () => {
  logger.info('Connection closed');
  cleanup();
  process.exit(0);
});

// Global timeout
setTimeout(() => {
  logger.error('Test timeout');
  cleanup();
  process.exit(1);
}, config.timeout);

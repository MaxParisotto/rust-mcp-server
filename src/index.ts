import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import { MCPProtocolHandler } from './protocols/mcp.js';
import { Logger as LoggerClass } from './utils/logger.js';
const logger = new LoggerClass('Server');

const app = express();

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const protocolHandler = new MCPProtocolHandler();

// Initialize logger
LoggerClass.configure({
  useFile: true,
  logDir: 'logs',
});

wss.on('connection', (ws) => {
    logger.info('Client connected');

    ws.on('message', async (message) => {
        try {
            const mcpMessage = JSON.parse(message.toString());
            const response = await protocolHandler.handleMessage(mcpMessage);
            ws.send(JSON.stringify(response));
        } catch (err: unknown) {
    let errorMessage = 'Unknown error';
    if (err instanceof Error) {
        logger.error('Error handling message', err);
        errorMessage = err.message;
    } else {
        logger.error('Unknown error type:', { errorDetails: String(err) });
    }

    ws.send(JSON.stringify({
        type: 'error',
        data: { message: errorMessage }
    }));
        }
    });
ws.on('close', () => {
    logger.info('Client disconnected');
});

});

app.use(express.static('public'));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    logger.info(`Rust MCP Server listening on port ${PORT}`);
});

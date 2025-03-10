import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import { MCPProtocolHandler } from './protocols/mcp.js';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const protocolHandler = new MCPProtocolHandler();

wss.on('connection', (ws) => {
    console.log('Client connected');
    ws.on('message', async (message) => {
        try {
            const mcpMessage = JSON.parse(message.toString());
            const response = await protocolHandler.handleMessage(mcpMessage);
            ws.send(JSON.stringify(response));
        } catch (err) {
            console.error('Error handling message', err);
            ws.send(JSON.stringify({
                type: 'error',
                data: { message: err.message || 'Unknown error' }
            }));
        }
    });
    ws.on('close', () => {
        console.log('Client disconnected');
    });
});

app.use(express.static('public'));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Rust MCP Server listening on port ${PORT}`);
});

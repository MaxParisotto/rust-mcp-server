# Rust MCP Server

A specialized Model Context Protocol (MCP) server for enhancing Rust coding capabilities. This server provides a bridge between client applications and Rust analysis tools, offering advanced code analysis, error translation, and suggestions.

## Features

- Deep integration with rust-analyzer for semantic code understanding
- Error message translation and enhancement
- Pattern recognition for common Rust pitfalls
- Borrow checker visualization
- LLM integration for advanced explanations and suggestions
- MCP standard Tools and Resources for AI integration

## Requirements

- Node.js 16+
- Rust and Cargo
- rust-analyzer executable in your PATH

## Installation

```bash
git clone https://github.com/yourusername/rust-mcp-server.git
cd rust-mcp-server
npm install
./scripts/build.sh
```

## Usage

Start the server:

```bash
npm start
```

The server will listen on port 8743 by default. You can change this by setting the PORT environment variable.

### Cursor Integration

To integrate with Cursor, add the following configuration to your `cline_mcp_settings.json` file (located at `~/Library/Application Support/Cursor/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json` on macOS):

```json
"github.com/yourusername/rust-mcp-server": {
  "command": "node",
  "args": [
    "/path/to/your/rust-mcp-server/dist/index.js"
  ],
  "disabled": false,
  "timeout": 30000,
  "autoApprove": [
    "mcp.schema",
    "rust.analyze",
    "rust.suggest",
    "rust.explain"
  ]
}
```

The server will try to use port 8743 by default but will automatically try other ports if this port is already in use. It will log the actual port it's using in the console output.

Make sure to update the path to your actual project location.

### Tools and Resources

The server provides the following MCP tools:

- **Rust Code Analysis**: Analyzes Rust code for errors, warnings, and potential issues
- **Rust Code Suggestions**: Provides recommendations for improving Rust code
- **Rust Code Explanation**: Explains Rust code patterns, errors, and concepts

It also provides these resources:

- **Rust Common Errors**: Reference guide to common Rust compiler errors
- **Rust Best Practices**: Guide to idiomatic Rust coding practices

To view the full schema with all tools and resources, access the `/schema` endpoint when the server is running.

### API

The server exposes a WebSocket endpoint that accepts JSON messages in the following format:

```json
{
  "type": "rust.analyze",
  "data": {
    "code": "fn main() { println!(\"Hello, world!\"); }",
    "fileName": "example.rs"
  }
}
```

#### Message Types

- `mcp.schema`: Get the schema with all tools and resources
- `rust.analyze`: Analyze Rust code and return diagnostics
- `rust.suggest`: Generate suggestions for improving code
- `rust.explain`: Provide explanations for errors or code patterns

#### HTTP Endpoints

- `GET /health`: Health check endpoint
- `GET /schema`: Get the MCP schema
- `GET /version`: Get server version information
- `GET /docs`: View documentation

## Development

For development, you can use:

```bash
npm run dev
```

This will start the server using ts-node, which allows for faster development cycles.

### Building

The project consists of both TypeScript and Rust components which need to be built:

```bash
# Build TypeScript
npm run build

# Build Rust
cd rust-bridge && cargo build --release
```

Or use the convenience script:

```bash
./scripts/build.sh
```

### Testing

Run tests with:

```bash
npm test
```

## Project Structure

- `src/`: TypeScript source code
  - `protocols/`: Protocol definitions and handlers
  - `services/`: Service implementations
- `rust-bridge/`: Rust code for interacting with rust-analyzer
- `tests/`: Test files
- `dist/`: Compiled JavaScript output (generated on build)
- `docs/`: Documentation (generated at runtime)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

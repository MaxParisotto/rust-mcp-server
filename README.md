# Rust MCP Server

A specialized Model Context Protocol (MCP) server for enhancing Rust coding capabilities. This server provides a bridge between client applications and Rust analysis tools, offering advanced code analysis, error translation, and suggestions.

## Features

- Deep integration with rust-analyzer for semantic code understanding
- Error message translation and enhancement
- Pattern recognition for common Rust pitfalls
- Borrow checker visualization
- LLM integration for advanced explanations and suggestions

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

The server will listen on port 3000 by default. You can change this by setting the PORT environment variable.

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

- `rust.analyze`: Analyze Rust code and return diagnostics
- `rust.suggest`: Generate suggestions for improving code
- `rust.explain`: Provide explanations for errors or code patterns

## Development

For development, you can use:

```bash
npm run dev
```

This will start the server using ts-node, which allows for faster development cycles.

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

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

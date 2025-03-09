#!/bin/bash
set -e

echo "Building Rust analyzer bridge..."
cd rust-bridge
cargo build --release
cd ..

echo "Building TypeScript project..."
npx tsc

echo "Build complete!"
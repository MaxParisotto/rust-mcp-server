#!/bin/bash
set -e

echo "Building Rust analyzer bridge..."
cd rust-bridge/rust-analyzer-bridge
cargo build --release
cd ../..
cp rust-bridge/target/release/librust_analyzer_bridge.dylib rust-bridge/target/release/rust-analyzer-bridge.dylib

echo "Building TypeScript project..."
npx tsc

echo "Build complete!"

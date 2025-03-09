use rust_analyzer_bridge::analysis::AnalysisRequest;
use std::io::{self, Read};
use serde_json::{from_str, to_string};
use std::fs;
use clap::Parser;

#[derive(Parser)]
#[command(name = "rust-analyzer-bridge")]
#[command(about = "Rust Analyzer Bridge CLI", long_about = None)]
struct Cli {
    #[arg(long)]
    config: Option<String>,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Parse CLI args
    let args = Cli::parse();

    // Load config if provided
    if let Some(config_path) = args.config {
        let config = fs::read_to_string(config_path)?;
        rust_analyzer_bridge::analysis::set_config(config)?;
    }

    // Read input from stdin
    let mut buffer = String::new();
    io::stdin().read_to_string(&mut buffer)?;

    // Parse the request
    let request: AnalysisRequest = from_str(&buffer)?;

    // Analyze the code
    let response = match rust_analyzer_bridge::analysis::analyze_code(request).await {
        Ok(result) => result,
        Err(err) => {
            // Return error in a structured format
            return Err(err.into());
        }
    };

    // Return the response as JSON
    println!("{}", to_string(&response)?);

    Ok(())
}

use rust_analyzer_bridge::{AnalysisRequest, AnalysisResponse, Diagnostic, DiagnosticSeverity, Position, Range};
use std::io::{self, Read};

fn main() -> io::Result<()> {
    // Read request JSON from stdin
    let mut buffer = String::new();
    io::stdin().read_to_string(&mut buffer)?;
    
    // Parse request
    let request: AnalysisRequest = serde_json::from_str(&buffer)?;
    
    // For now, just return a dummy response
    // In a real implementation, this would call into rust-analyzer
    let response = AnalysisResponse {
        diagnostics: vec![
            Diagnostic {
                message: "Example diagnostic".to_string(),
                severity: DiagnosticSeverity::Information,
                range: Range {
                    start: Position { line: 0, character: 0 },
                    end: Position { line: 0, character: 10 },
                },
            }
        ],
        suggestions: None,
        explanation: Some("This is a placeholder implementation".to_string()),
    };
    
    // Write response as JSON to stdout
    println!("{}", serde_json::to_string(&response)?);
    
    Ok(())
}

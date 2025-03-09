//! Rust Analyzer Bridge
//! 
//! This crate provides functionality to interact with rust-analyzer
//! through external process communication instead of direct library integration.

use serde::{Deserialize, Serialize};
use std::process::{Command, Stdio};
use std::path::PathBuf;
use std::fs;
use std::env;

/// Configuration for the Rust Analyzer connection
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RustAnalyzerConfig {
    /// Path to the rust-analyzer executable
    pub executable_path: String,
    
    /// Working directory for rust-analyzer
    pub working_dir: Option<String>,
}

impl Default for RustAnalyzerConfig {
    fn default() -> Self {
        Self {
            executable_path: "rust-analyzer".to_string(),
            working_dir: None,
        }
    }
}

/// Diagnostic severity levels
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DiagnosticSeverity {
    Error,
    Warning,
    Information,
    Hint,
}

/// Position in a document
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Position {
    pub line: u32,
    pub character: u32,
}

/// Range in a document
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Range {
    pub start: Position,
    pub end: Position,
}

/// Diagnostic information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Diagnostic {
    pub message: String,
    pub severity: DiagnosticSeverity,
    pub range: Option<Range>,
    pub code: Option<String>,
    pub source: Option<String>,
}

/// Suggestion for code improvement
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Suggestion {
    pub title: String,
    pub description: Option<String>,
    pub code: String,
    pub range: Option<Range>,
}

/// Initializes communication with an external rust-analyzer process
/// 
/// Returns a handle to interact with the rust-analyzer process
pub async fn initialize(config: RustAnalyzerConfig) -> Result<RustAnalyzer, String> {
    // Verify that the rust-analyzer executable exists
    if !Command::new(&config.executable_path)
        .arg("--version")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map_err(|e| format!("Failed to execute rust-analyzer: {}", e))?
        .success() {
        return Err(format!("rust-analyzer executable not found at: {}", config.executable_path));
    }
    
    println!("Rust Analyzer Bridge initialized with config: {:?}", config);
    Ok(RustAnalyzer { config })
}

/// Rust Analyzer Client
pub struct RustAnalyzer {
    config: RustAnalyzerConfig,
}

impl RustAnalyzer {
    /// Analyze Rust code and return diagnostics
    pub async fn analyze_code(&self, file_path: &str, code: &str) -> Result<AnalysisResult, String> {
        // Create a temporary file with the code
        let temp_dir = env::temp_dir();
        let path_buf = PathBuf::from(file_path);
        let file_name = path_buf.file_name()
            .ok_or_else(|| "Invalid file path".to_string())?;
        let temp_file_path = temp_dir.join(file_name);
        
        fs::write(&temp_file_path, code)
            .map_err(|e| format!("Failed to write temporary file: {}", e))?;
        
        // Run rust-analyzer in check mode
        let output = Command::new(&self.config.executable_path)
            .arg("--check")
            .arg(&temp_file_path)
            .output()
            .map_err(|e| format!("Failed to run rust-analyzer: {}", e))?;
        
        // Clean up the temporary file
        let _ = fs::remove_file(&temp_file_path);
        
        if !output.status.success() {
            // Parse the error output
            let error_output = String::from_utf8_lossy(&output.stderr);
            return Ok(self.parse_diagnostics(error_output.to_string()));
        }
        
        // No diagnostics if compilation succeeded
        Ok(AnalysisResult {
            diagnostics: vec![],
            suggestions: vec![],
            explanation: None,
        })
    }
    
    /// Simple parsing of diagnostic messages from rust-analyzer output
    fn parse_diagnostics(&self, output: String) -> AnalysisResult {
        let mut diagnostics = Vec::new();
        
        for line in output.lines() {
            if line.contains("error:") || line.contains("warning:") {
                let severity = if line.contains("error:") {
                    DiagnosticSeverity::Error
                } else {
                    DiagnosticSeverity::Warning
                };
                
                diagnostics.push(Diagnostic {
                    message: line.to_string(),
                    severity,
                    range: None,
                    code: None,
                    source: Some("rust-analyzer".to_string()),
                });
            }
        }
        
        // Generate simple suggestions based on diagnostics
        let suggestions = diagnostics.iter()
            .filter(|d| matches!(d.severity, DiagnosticSeverity::Error))
            .map(|d| Suggestion {
                title: "Fix error".to_string(),
                description: Some(format!("Suggestion to fix: {}", d.message)),
                code: "// TODO: Implement fix".to_string(),
                range: None,
            })
            .collect();
        
        AnalysisResult {
            diagnostics,
            suggestions,
            explanation: Some("Analysis performed by rust-analyzer".to_string()),
        }
    }
}

/// Module for code analysis functionality
pub mod analysis {
    use super::*;
    
    /// Simple code analysis request structure
    #[derive(Debug, Serialize, Deserialize)]
    pub struct AnalysisRequest {
        pub file_path: String,
        pub code: String,
    }
    
    /// Simple code analysis response structure
    #[derive(Debug, Serialize, Deserialize)]
    pub struct AnalysisResponse {
        pub diagnostics: Vec<Diagnostic>,
        pub suggestions: Vec<Suggestion>,
        pub explanation: Option<String>,
    }
    
    /// Send code for analysis to rust-analyzer
    pub async fn analyze_code(request: AnalysisRequest) -> Result<AnalysisResponse, String> {
        let config = RustAnalyzerConfig::default();
        let analyzer = initialize(config).await?;
        
        let result = analyzer.analyze_code(&request.file_path, &request.code).await?;
        
        Ok(AnalysisResponse {
            diagnostics: result.diagnostics,
            suggestions: result.suggestions,
            explanation: result.explanation,
        })
    }

    static CONFIG: std::sync::OnceLock<std::sync::Mutex<Option<RustAnalyzerConfig>>> = std::sync::OnceLock::new();

    fn get_config() -> &'static std::sync::Mutex<Option<RustAnalyzerConfig>> {
        CONFIG.get_or_init(|| std::sync::Mutex::new(None))
    }

    /// Set configuration for the analysis module
    pub fn set_config(config: String) -> Result<(), String> {
        // Parse the config string into RustAnalyzerConfig
        let config: RustAnalyzerConfig = serde_json::from_str(&config)
            .map_err(|e| format!("Failed to parse config: {}", e))?;
            
        // Store the config in the global variable
        get_config().lock().unwrap().replace(config);
        Ok(())
    }
}

/// Analysis result from rust-analyzer
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalysisResult {
    pub diagnostics: Vec<Diagnostic>,
    pub suggestions: Vec<Suggestion>,
    pub explanation: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn config_default_works() {
        let config = RustAnalyzerConfig::default();
        assert_eq!(config.executable_path, "rust-analyzer");
        assert!(config.working_dir.is_none());
    }
}

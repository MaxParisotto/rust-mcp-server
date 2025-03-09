//! Rust Analyzer Bridge
//! 
//! This crate provides a bridge between a Node.js server and the rust-analyzer.

use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct AnalysisRequest {
    pub code: String,
    pub file_name: Option<String>,
    pub position: Option<Position>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Position {
    pub line: u32,
    pub character: u32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AnalysisResponse {
    pub diagnostics: Vec<Diagnostic>,
    pub suggestions: Option<Vec<Suggestion>>,
    pub explanation: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Diagnostic {
    pub message: String,
    pub severity: DiagnosticSeverity,
    pub range: Range,
}

#[derive(Debug, Serialize, Deserialize)]
pub enum DiagnosticSeverity {
    Error,
    Warning,
    Information,
    Hint,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Range {
    pub start: Position,
    pub end: Position,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Suggestion {
    pub title: String,
    pub text_edit: TextEdit,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TextEdit {
    pub range: Range,
    pub new_text: String,
}

// TODO: Implement the actual bridge to rust-analyzer

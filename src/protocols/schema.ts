/**
 * MCP Schema definitions for the Rust MCP Server
 * 
 * This file defines the Tools and Resources available in this MCP server
 * following the MCP specification at https://www.aimcp.info/
 */

import { z } from 'zod';

/**
 * Schema for Rust analysis request
 */
export const RustAnalysisRequestSchema = z.object({
  code: z.string().describe("The Rust code to analyze"),
  fileName: z.string().optional().describe("The name of the source file (for error reporting)"),
  position: z.object({
    line: z.number().int().min(0),
    character: z.number().int().min(0)
  }).optional().describe("Cursor position in the file (for focused analysis)")
});

/**
 * Schema for Rust suggestion request
 */
export const RustSuggestionRequestSchema = z.object({
  code: z.string().describe("The Rust code to generate suggestions for"),
  fileName: z.string().optional().describe("The name of the source file")
});

/**
 * Schema for Rust explanation request
 */
export const RustExplanationRequestSchema = z.object({
  code: z.string().describe("The Rust code to explain"),
  fileName: z.string().optional().describe("The name of the source file"),
  focus: z.string().optional().describe("Specific part of the code to focus explanation on")
});

/**
 * Schema for history request
 */
export const HistoryRequestSchema = z.object({
  limit: z.number().int().min(1).max(50).optional().describe("Maximum number of history entries to retrieve")
});

/**
 * Rust Code Analysis Tool Definition
 */
export const RUST_ANALYZE_TOOL = {
  name: "rust.analyze",
  description: 
    "Analyzes Rust code for errors, warnings, and potential issues using rust-analyzer.\n\n" +
    "This tool provides deep semantic analysis of Rust code beyond simple syntax checking. " +
    "It identifies errors, type mismatches, borrow checker violations, and other issues " +
    "with detailed diagnostics that explain the problem and often suggest fixes.\n\n" +
    "The analysis results include:\n" +
    "- Diagnostics with severity levels (error, warning, info, hint)\n" +
    "- Code positions for each diagnostic\n" +
    "- Suggestions for fixing issues where available\n" +
    "- Additional context about the error when relevant\n\n" +
    "This is the primary tool to use when checking Rust code for correctness.",
  inputSchema: {
    type: "object",
    properties: {
      code: { type: "string", description: "The Rust code to analyze" },
      fileName: { type: "string", description: "The name of the source file (for error reporting)" },
      position: { 
        type: "object", 
        properties: {
          line: { type: "integer" },
          character: { type: "integer" }
        },
        description: "Cursor position in the file (for focused analysis)"
      }
    },
    required: ["code"]
  }
};

/**
 * Rust Code Suggestions Tool Definition
 */
export const RUST_SUGGEST_TOOL = {
  name: "rust.suggest",
  description: 
    "Provides recommendations for improving Rust code, even if it's already correct.\n\n" +
    "This tool focuses on optimizing code for idiomatic Rust style, performance, " +
    "safety, and maintainability. It can suggest improvements like:\n" +
    "- More idiomatic ways to express the same logic\n" +
    "- Potential optimizations for better performance\n" +
    "- More robust error handling patterns\n" +
    "- Simplifications of complex expressions\n" +
    "- Better use of Rust's type system and ownership model\n\n" +
    "Each suggestion includes a title, description, and suggested code change with its location.\n\n" +
    "Use this tool when you have code that works but want to improve its quality.",
  inputSchema: {
    type: "object",
    properties: {
      code: { type: "string", description: "The Rust code to generate suggestions for" },
      fileName: { type: "string", description: "The name of the source file" }
    },
    required: ["code"]
  }
};

/**
 * Rust Code Explanation Tool Definition
 */
export const RUST_EXPLAIN_TOOL = {
  name: "rust.explain",
  description: 
    "Provides detailed explanations of Rust code patterns, errors, and concepts.\n\n" +
    "This tool helps users understand complex Rust code or error messages by providing " +
    "clear explanations in natural language. It's particularly useful for:\n" +
    "- Understanding why the borrow checker is rejecting code\n" +
    "- Learning about unfamiliar Rust patterns or idioms\n" +
    "- Getting background on compiler errors and their solutions\n" +
    "- Understanding lifetime annotations and their implications\n" +
    "- Learning how traits and generics are being used\n\n" +
    "The explanation will break down the code or error, explain the concepts involved, " +
    "and offer insights on how to think about it in the Rust mental model.\n\n" +
    "Use this tool when you need to understand \"why\" rather than just fixing an error.",
  inputSchema: {
    type: "object",
    properties: {
      code: { type: "string", description: "The Rust code to explain" },
      fileName: { type: "string", description: "The name of the source file" },
      focus: { type: "string", description: "Specific part of the code to focus explanation on" }
    },
    required: ["code"]
  }
};

/**
 * History Retrieval Tool Definition
 */
export const HISTORY_TOOL = {
  name: "rust.history",
  description:
    "Retrieves the history of previous Rust code analyses.\n\n" +
    "This tool allows you to view past analyses, which can be useful for:\n" +
    "- Comparing changes in code over time\n" +
    "- Reviewing previously fixed errors\n" +
    "- Continuing work on code from previous sessions\n\n" +
    "Results include a list of previous analyses with timestamps, file names, " +
    "and summaries of the diagnostics.",
  inputSchema: {
    type: "object",
    properties: {
      limit: { type: "integer", description: "Maximum number of history entries to retrieve" }
    }
  }
};

/**
 * Rust Common Errors Resource Definition
 */
export const RUST_COMMON_ERRORS_RESOURCE = {
  name: "Rust Common Errors",
  description: "Reference guide to common Rust compiler errors and how to fix them",
  type: "reference",
  uri: "rust://reference/common-errors",
  data: {
    errors: [
      {
        code: "E0308",
        title: "Mismatched types",
        description: "This error occurs when Rust cannot reconcile two different types when required.",
        example: "fn main() { let x: i32 = \"hello\"; }",
        solution: "Ensure type annotations match the actual types or add appropriate type conversions."
      },
      {
        code: "E0382",
        title: "Use of moved value",
        description: "This error occurs when trying to use a value that has been moved due to Rust's ownership rules.",
        example: "fn main() { let s1 = String::from(\"hello\"); let s2 = s1; println!(\"{}\", s1); }",
        solution: "Either clone the value, use references, or restructure code to respect ownership."
      },
      {
        code: "E0502",
        title: "Borrow error - cannot borrow as mutable because it's borrowed as immutable",
        description: "This error occurs when trying to mutably borrow a value that is already borrowed immutably.",
        example: "fn main() { let mut s = String::from(\"hello\"); let r1 = &s; let r2 = &mut s; }",
        solution: "Ensure mutable and immutable borrows don't overlap in their scope."
      },
      {
        code: "E0507",
        title: "Cannot move out of borrowed content",
        description: "This error occurs when trying to move a value out of a borrowed context.",
        example: "fn main() { let s = &String::from(\"hello\"); let s2 = *s; }",
        solution: "Use Clone to get an owned copy or restructure code to avoid the move."
      },
      {
        code: "E0596",
        title: "Cannot borrow as mutable",
        description: "This error occurs when trying to borrow something as mutable when it isn't declared as mutable.",
        example: "fn main() { let s = String::from(\"hello\"); s.push_str(\" world\"); }",
        solution: "Declare the variable as mutable with 'let mut'."
      }
    ]
  }
};

/**
 * Rust Best Practices Resource Definition
 */
export const RUST_BEST_PRACTICES_RESOURCE = {
  name: "Rust Best Practices",
  description: "Guide to idiomatic Rust coding practices and patterns",
  type: "guide",
  uri: "rust://guide/best-practices",
  data: {
    categories: [
      {
        name: "Error Handling",
        practices: [
          {
            title: "Use Result for fallible functions",
            description: "Functions that can fail should return Result<T, E> rather than using panics or unwrap()",
            example: "fn divide(a: i32, b: i32) -> Result<i32, String> {\n  if b == 0 {\n    return Err(\"Division by zero\".to_string());\n  }\n  Ok(a / b)\n}"
          },
          {
            title: "Use ? operator for error propagation",
            description: "The ? operator simplifies error handling by automatically propagating errors",
            example: "fn process_file(path: &str) -> Result<String, io::Error> {\n  let contents = fs::read_to_string(path)?;\n  Ok(contents)\n}"
          }
        ]
      },
      {
        name: "Performance",
        practices: [
          {
            title: "Prefer iterators over loops for collections",
            description: "Iterators are often more expressive and can be optimized better by the compiler",
            example: "// Instead of:\nlet mut sum = 0;\nfor i in 0..nums.len() {\n  sum += nums[i];\n}\n\n// Use:\nlet sum: i32 = nums.iter().sum();"
          },
          {
            title: "Use appropriate data structures",
            description: "Choose data structures based on access patterns",
            example: "// Use HashMap for key-value lookups\nlet mut scores = HashMap::new();\n\n// Use BTreeMap when order matters\nlet mut sorted_scores = BTreeMap::new();"
          }
        ]
      },
      {
        name: "Safety",
        practices: [
          {
            title: "Minimize use of unsafe",
            description: "Avoid unsafe code when possible and isolate it in small, well-documented functions",
            example: "// Create a safe abstraction around unsafe code\nfn get_value(ptr: *const T) -> Option<T> {\n  if ptr.is_null() {\n    return None;\n  }\n  Some(unsafe { *ptr })\n}"
          },
          {
            title: "Use strong typing to prevent errors",
            description: "Create specific types rather than using primitives directly",
            example: "struct UserId(u64);\nstruct GroupId(u64);\n\n// Now these can't be accidentally swapped\nfn add_user_to_group(user: UserId, group: GroupId) { /* ... */ }"
          }
        ]
      }
    ]
  }
};

/**
 * Rust Lifetime Reference Resource Definition
 */
export const RUST_LIFETIME_REFERENCE_RESOURCE = {
  name: "Rust Lifetime Reference",
  description: "Guide to understanding Rust's lifetime system",
  type: "reference",
  uri: "rust://reference/lifetimes",
  data: {
    sections: [
      {
        title: "What are lifetimes?",
        content: "Lifetimes are Rust's way of ensuring that references are valid for as long as they are used. They are a form of type annotation that tells the compiler how references relate to each other in terms of their valid durations."
      },
      {
        title: "Lifetime syntax",
        content: "Lifetimes are denoted with an apostrophe followed by a name, like 'a. They appear in function signatures and struct definitions where references are used.",
        examples: [
          "fn longest<'a>(x: &'a str, y: &'a str) -> &'a str",
          "struct Reference<'a> { value: &'a str }"
        ]
      },
      {
        title: "Lifetime elision",
        content: "In many common cases, the compiler can infer lifetimes without explicit annotations. These are known as 'elision rules'.",
        examples: [
          "fn first_word(s: &str) -> &str  // Compiler infers matching lifetimes",
          "impl<'a> Reference<'a> {  // Lifetimes needed in impl blocks too\n  fn get_value(&self) -> &str {  // Return lifetime tied to self\n    self.value\n  }\n}"
        ]
      },
      {
        title: "Common patterns",
        content: "Several patterns emerge when working with lifetimes in Rust:",
        patterns: [
          "'static lifetime for values that live for the entire program",
          "Input lifetimes for parameters",
          "Output lifetimes for return values",
          "Multiple lifetime parameters when different references have different lifetimes"
        ]
      }
    ]
  }
};

/**
 * Get all MCP tools and resources
 */
export function getMCPSchema() {
  return {
    // Version of the schema
    version: "1.0.0",
    
    // Tools available in this MCP server
    tools: [
      RUST_ANALYZE_TOOL,
      RUST_SUGGEST_TOOL,
      RUST_EXPLAIN_TOOL,
      HISTORY_TOOL
    ],
    
    // Resources available in this MCP server
    resources: [
      RUST_COMMON_ERRORS_RESOURCE,
      RUST_BEST_PRACTICES_RESOURCE,
      RUST_LIFETIME_REFERENCE_RESOURCE
    ]
  };
}

// Export type information for TypeScript
export type MCPSchema = ReturnType<typeof getMCPSchema>;
export type RustAnalysisRequest = z.infer<typeof RustAnalysisRequestSchema>;
export type RustSuggestionRequest = z.infer<typeof RustSuggestionRequestSchema>;
export type RustExplanationRequest = z.infer<typeof RustExplanationRequestSchema>;

export interface RustAnalysisResult {
  diagnostics: Array<{
    message: string;
    severity: 'error' | 'warning' | 'info' | 'hint';
    range?: {
      start: { line: number; character: number };
      end: { line: number; character: number };
    };
    suggestions?: Array<{
      message: string;
      replacement: string;
    }>;
  }>;
}

export interface RustExplanationResult {
  explanation: string;
  references?: Array<{
    title: string;
    url: string;
  }>;
}

export interface RustSuggestionResult {
  suggestions: Array<{
    message: string;
    replacement: string;
    range: {
      start: { line: number; character: number };
      end: { line: number; character: number };
    };
  }>;
}

interface RustError {
    code: string;
    message: string;
    spans: {
      file_name: string;
      line_start: number;
      line_end: number;
      column_start: number;
      column_end: number;
      text: string[];
    }[];
  }
  
  interface TranslatedError {
    originalError: RustError;
    simplifiedMessage: string;
    suggestedFixes: string[];
    explanation: string;
  }
  
  export class ErrorTranslatorService {
    private errorPatterns = [
      {
        code: 'E0502',
        pattern: /borrow of .* as mutable occurs/,
        translator: (error: RustError): TranslatedError => ({
          originalError: error,
          simplifiedMessage: "You can't modify a value while it's being used elsewhere",
          suggestedFixes: [
            "Move the mutable borrow earlier in the code",
            "Create a new scope to limit the immutable borrow's lifetime"
          ],
          explanation: "In Rust, you can have either multiple immutable borrows OR one mutable borrow, but not both at the same time."
        })
      },
      // Add more error patterns and translators
    ];
    
    translateError(error: RustError): TranslatedError {
      for (const pattern of this.errorPatterns) {
        if (
          error.code === pattern.code || 
          (pattern.pattern && pattern.pattern.test(error.message))
        ) {
          return pattern.translator(error);
        }
      }
      
      // Default translator
      return {
        originalError: error,
        simplifiedMessage: error.message,
        suggestedFixes: ["Review the error message and code context carefully"],
        explanation: "This is a standard Rust compile error."
      };
    }
  }
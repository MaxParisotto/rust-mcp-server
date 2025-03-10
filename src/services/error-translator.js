"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorTranslatorService = void 0;
class ErrorTranslatorService {
    constructor() {
        this.errorPatterns = [
            {
                code: 'E0502',
                pattern: /borrow of .* as mutable occurs/,
                translator: (error) => ({
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
    }
    translateError(error) {
        for (const pattern of this.errorPatterns) {
            if (error.code === pattern.code ||
                (pattern.pattern && pattern.pattern.test(error.message))) {
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
exports.ErrorTranslatorService = ErrorTranslatorService;

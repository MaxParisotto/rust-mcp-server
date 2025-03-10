"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PatternRecognitionService = void 0;
class PatternRecognitionService {
    constructor() {
        this.patterns = [
            {
                id: 'borrowing-immutable-then-mutable',
                pattern: /(\w+).borrow\(\).*(\w+).borrow_mut\(\)/,
                description: 'Attempting to borrow mutable after immutable borrow'
            },
            // Add more patterns here
        ];
        this.solutions = [
            {
                patternId: 'borrowing-immutable-then-mutable',
                solution: 'Move the mutable borrow before the immutable borrow or ensure the immutable borrow is dropped',
                description: 'The Rust borrow checker prevents having mutable and immutable borrows active simultaneously'
            },
            // Add more solutions here
        ];
    }
    findPatterns(code) {
        const results = [];
        for (const pattern of this.patterns) {
            const matches = typeof pattern.pattern === 'string'
                ? code.includes(pattern.pattern)
                : pattern.pattern.test(code);
            if (matches) {
                const matchingSolutions = this.solutions.filter(s => s.patternId === pattern.id);
                results.push({ pattern, solutions: matchingSolutions });
            }
        }
        return results;
    }
}
exports.PatternRecognitionService = PatternRecognitionService;

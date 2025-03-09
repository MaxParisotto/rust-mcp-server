interface CodePattern {
    id: string;
    pattern: RegExp | string;
    description: string;
  }
  
  interface Solution {
    patternId: string;
    solution: string;
    description: string;
  }
  
  export class PatternRecognitionService {
    private patterns: CodePattern[] = [
      {
        id: 'borrowing-immutable-then-mutable',
        pattern: /(\w+).borrow\(\).*(\w+).borrow_mut\(\)/,
        description: 'Attempting to borrow mutable after immutable borrow'
      },
      // Add more patterns here
    ];
    
    private solutions: Solution[] = [
      {
        patternId: 'borrowing-immutable-then-mutable',
        solution: 'Move the mutable borrow before the immutable borrow or ensure the immutable borrow is dropped',
        description: 'The Rust borrow checker prevents having mutable and immutable borrows active simultaneously'
      },
      // Add more solutions here
    ];
    
    findPatterns(code: string): {pattern: CodePattern, solutions: Solution[]}[] {
      const results = [];
      
      for (const pattern of this.patterns) {
        const matches = typeof pattern.pattern === 'string' 
          ? code.includes(pattern.pattern)
          : pattern.pattern.test(code);
          
        if (matches) {
          const matchingSolutions = this.solutions.filter(s => s.patternId === pattern.id);
          results.push({pattern, solutions: matchingSolutions});
        }
      }
      
      return results;
    }
  }
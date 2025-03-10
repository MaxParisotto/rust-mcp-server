import { spawn } from 'child_process';
import path from 'path';

export class RustBridge {
    constructor() {
        this.binaryPath = path.resolve(process.cwd(), 'rust-bridge/target/release/analyze');
    }

    async analyze(request) {
        return new Promise((resolve, reject) => {
            const process = spawn(this.binaryPath, []);
            let stdout = '';
            let stderr = '';

            process.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            process.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            process.on('close', (code) => {
                if (code !== 0) {
                    console.error(`Process exited with code ${code}: ${stderr}`);
                    resolve({
                        diagnostics: [{
                            message: `Analysis failed with error: ${stderr}`,
                            severity: 'error',
                            source: 'rust-bridge'
                        }],
                        suggestions: [],
                        explanation: `Error during analysis: ${stderr}`
                    });
                    return;
                }

                try {
                    if (!stdout || !stdout.trim()) {
                        throw new Error('Empty response from analyzer');
                    }

                    // Find first valid JSON line
                    const lines = stdout.split('\n');
                    let jsonStr = '';
                    
                    for (const line of lines) {
                        const trimmed = line.trim();
                        if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
                            jsonStr = trimmed;
                            break;
                        }
                    }
                    
                    if (!jsonStr) {
                        throw new Error('No valid JSON found in analyzer response');
                    }

                    const response = JSON.parse(jsonStr);

                    // Validate response structure
                    if (!response.diagnostics || !response.suggestions || !response.explanation) {
                        throw new Error('Invalid response structure: missing required fields');
                    }

                    if (!Array.isArray(response.diagnostics) || 
                        !Array.isArray(response.suggestions) ||
                        typeof response.explanation !== 'string') {
                        throw new Error('Invalid response structure: incorrect field types');
                    }
                    
                    resolve(response);
                }
                catch (err) {
                    console.error('Failed to parse response:', err.message, '\nResponse:', stdout);
                    resolve({
                        diagnostics: [{
                            message: `Failed to parse analysis response: ${err.message}`,
                            severity: 'error',
                            source: 'rust-bridge'
                        }],
                        suggestions: [],
                        explanation: `Internal error in the analysis service: ${err.message}`
                    });
                }
            });

            process.stdin.write(JSON.stringify({
                file_path: request.fileName || 'input.rs',
                code: request.code
            }));
            process.stdin.end();
        });
    }
}

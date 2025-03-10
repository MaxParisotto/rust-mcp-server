"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LLMIntegrationService = void 0;
class LLMIntegrationService {
    callLLM(request) {
        return __awaiter(this, void 0, void 0, function* () {
            // Implementation depends on which LLM API you want to use
            // This is a placeholder
            console.log('Calling LLM with prompt:', request.prompt);
            return {
                text: `LLM response for: ${request.prompt.substring(0, 20)}...`
            };
        });
    }
    enhanceErrorExplanation(code, error) {
        return __awaiter(this, void 0, void 0, function* () {
            const prompt = `
        Below is Rust code that has a compilation error.
        
        CODE:
        ${code}
        
        ERROR:
        ${error}
        
        Please explain what's causing this error in simple terms, and suggest how to fix it.
      `;
            const response = yield this.callLLM({
                prompt,
                parameters: {
                    temperature: 0.3,
                    maxTokens: 500
                }
            });
            return response.text;
        });
    }
    generateTestCases(functionCode) {
        return __awaiter(this, void 0, void 0, function* () {
            const prompt = `
        Please generate comprehensive test cases for the following Rust function.
        
        FUNCTION:
        ${functionCode}
        
        Generate tests that cover:
        1. Normal case usage
        2. Edge cases
        3. Error cases
        
        Format your response as valid Rust code in a #[cfg(test)] module.
      `;
            const response = yield this.callLLM({
                prompt,
                parameters: {
                    temperature: 0.7,
                    maxTokens: 1000
                }
            });
            return response.text;
        });
    }
}
exports.LLMIntegrationService = LLMIntegrationService;

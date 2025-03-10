/**
 * Handler for analysis history operations
 * Provides functionality to retrieve stored analysis history
 */

import { BaseHandler, HandlerResponse } from './base-handler';
import { StorageService } from '../utils/storage';

/**
 * Interface for history list result
 */
export interface HistoryListResult {
  analyses: HistorySummary[];
  total: number;
}

/**
 * Interface for history summary
 */
export interface HistorySummary {
  id: string;
  timestamp: number;
  fileName?: string;
  type: 'analysis' | 'suggestion' | 'explanation';
  stats: {
    diagnosticCount?: number;
    suggestionCount?: number;
    explanationLength?: number;
  };
}

/**
 * Handler for history operations
 */
export class HistoryHandler extends BaseHandler {
  private storage: StorageService;

  /**
   * Create a new History Handler
   */
  constructor() {
    super('HistoryHandler');
    this.storage = new StorageService();
  }

  /**
   * Get recent analysis history
   * @param limit - Maximum number of history entries to retrieve
   * @returns List of recent analyses with summary information
   */
  public async getHistory(limit: number = 10): Promise<HandlerResponse<HistoryListResult>> {
    return this.safeExecute<HistoryListResult>('get-analysis-history', async () => {
      // Get recent analyses from storage
      const analyses = await this.storage.getRecentAnalyses(limit);
      
      // Map to summary format
      const summaries: HistorySummary[] = analyses.map(analysis => {
        const type = this.determineAnalysisType(analysis);
        
        return {
          id: analysis.id,
          timestamp: typeof analysis.timestamp === 'string' 
            ? Date.parse(analysis.timestamp) 
            : analysis.timestamp,
          fileName: analysis.fileName,
          type,
          stats: this.getAnalysisStats(analysis, type)
        };
      });
      
      // Get total count
      const total = await this.storage.getAnalysisCount();
      
      return {
        analyses: summaries,
        total
      };
    });
  }

  /**
   * Get a specific analysis by ID
   * @param id - The analysis ID to retrieve
   * @returns The complete analysis record
   */
  public async getAnalysisById(id: string): Promise<HandlerResponse<any>> {
    return this.safeExecute<any>('get-analysis-by-id', async () => {
      const analysis = await this.storage.getAnalysisById(id);
      
      if (!analysis) {
        throw new Error(`Analysis with ID ${id} not found`);
      }
      
      return analysis;
    });
  }

  /**
   * Determine the type of analysis
   * @param analysis - The analysis record
   * @returns The type of analysis
   */
  private determineAnalysisType(analysis: any): 'analysis' | 'suggestion' | 'explanation' {
    if (analysis.explanation) {
      return 'explanation';
    } else if (analysis.suggestions && analysis.suggestions.length > 0) {
      return 'suggestion';
    } else {
      return 'analysis';
    }
  }

  /**
   * Get statistics for an analysis
   * @param analysis - The analysis record
   * @param type - The type of analysis
   * @returns Statistics for the analysis
   */
  private getAnalysisStats(analysis: any, type: 'analysis' | 'suggestion' | 'explanation'): any {
    switch (type) {
      case 'analysis':
        return {
          diagnosticCount: analysis.diagnostics?.length || 0
        };
      case 'suggestion':
        return {
          suggestionCount: analysis.suggestions?.length || 0
        };
      case 'explanation':
        return {
          explanationLength: analysis.explanation?.length || 0
        };
      default:
        return {};
    }
  }
}

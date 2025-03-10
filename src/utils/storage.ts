/**
 * Storage utility for the MCP server
 * Provides persistent storage for analysis results
 */

import * as fs from 'fs';
import * as path from 'path';
import { Logger } from './logger';

// Default storage path
const STORAGE_PATH = path.join(process.cwd(), 'data', 'storage.json');

// Ensure folder exists
function ensureDirectoryExists(filePath: string): void {
  const dirname = path.dirname(filePath);
  if (!fs.existsSync(dirname)) {
    fs.mkdirSync(dirname, { recursive: true });
  }
}

/**
 * Interface for storage data structure
 */
export interface StorageData {
  version: string;
  analyses: AnalysisRecord[];
  lastUpdated: string;
}

/**
 * Interface for analysis record
 */
export interface AnalysisRecord {
  id: string;
  timestamp: number;
  fileName?: string;
  code: string;
  diagnostics?: any[];
  suggestions?: any[];
  explanation?: string;
  sections?: any[];
}

/**
 * Storage service for persistent data
 */
export class StorageService {
  private data: StorageData = {
    version: '1.0.0',
    analyses: [],
    lastUpdated: new Date().toISOString()
  };
  private logger: Logger;

  /**
   * Create a new storage service instance
   * @param storagePath - Path to the storage file
   */
  constructor(private storagePath: string = STORAGE_PATH) {
    this.logger = new Logger('StorageService');
  }

  /**
   * Initialize the storage service
   */
  async initialize(): Promise<void> {
    try {
      await this.loadData();
    } catch (error) {
      this.logger.warn('Failed to load storage data, initializing new storage', error);
      
      // Create empty storage file
      ensureDirectoryExists(this.storagePath);
      await this.saveData();
    }
  }

  /**
   * Load data from storage file
   */
  private async loadData(): Promise<void> {
    if (!fs.existsSync(this.storagePath)) {
      throw new Error(`Storage file not found: ${this.storagePath}`);
    }
    
    const fileContent = await fs.promises.readFile(this.storagePath, 'utf-8');
    this.data = JSON.parse(fileContent);
    
    this.logger.info(`Loaded ${this.data.analyses.length} analysis records from storage`);
  }

  /**
   * Save data to storage file
   */
  private async saveData(): Promise<void> {
    this.data.lastUpdated = new Date().toISOString();
    
    try {
      ensureDirectoryExists(this.storagePath);
      await fs.promises.writeFile(
        this.storagePath,
        JSON.stringify(this.data, null, 2),
        'utf-8'
      );
      
      this.logger.info(`Saved ${this.data.analyses.length} analysis records to storage`);
    } catch (error) {
      this.logger.error('Failed to save storage data', error);
      throw error;
    }
  }

  /**
   * Save a new analysis record
   * @param analysis - The analysis record to save
   * @returns The ID of the saved analysis
   */
  async saveAnalysis(analysis: {
    fileName?: string;
    code: string;
    diagnostics?: any[];
    suggestions?: any[];
    explanation?: string;
    sections?: any[];
  }): Promise<string> {
    await this.loadData(); // Make sure we have latest data
    
    const id = `analysis_${Date.now()}_${Math.round(Math.random() * 1000)}`;
    const timestamp = Date.now();
    
    const record: AnalysisRecord = {
      id,
      timestamp,
      ...analysis
    };
    
    // Add to the beginning of the array (most recent first)
    this.data.analyses.unshift(record);
    
    // Keep only the last 100 analyses
    if (this.data.analyses.length > 100) {
      this.data.analyses = this.data.analyses.slice(0, 100);
    }
    
    await this.saveData();
    
    return id;
  }

  /**
   * Get an analysis by ID
   * @param id - The ID of the analysis to retrieve
   * @returns The analysis record or null if not found
   */
  async getAnalysisById(id: string): Promise<AnalysisRecord | null> {
    await this.loadData(); // Make sure we have latest data
    
    const analysis = this.data.analyses.find(a => a.id === id);
    return analysis || null;
  }

  /**
   * Get recent analyses
   * @param limit - Maximum number of analyses to retrieve
   * @returns Array of analysis records
   */
  async getRecentAnalyses(limit = 10): Promise<AnalysisRecord[]> {
    await this.loadData(); // Make sure we have latest data
    
    return this.data.analyses.slice(0, limit);
  }

  /**
   * Get the total count of analyses
   * @returns The total number of analyses stored
   */
  async getAnalysisCount(): Promise<number> {
    await this.loadData(); // Make sure we have latest data
    return this.data.analyses.length;
  }

  /**
   * Clear all analyses
   */
  async clearAllAnalyses(): Promise<void> {
    this.data.analyses = [];
    await this.saveData();
    this.logger.info('Cleared all analyses from storage');
  }
}

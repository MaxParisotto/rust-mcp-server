/**
 * Storage utility for the MCP server
 * Provides persistent storage for analysis results using SQLite
 */

import * as path from 'path';
import { Logger } from './logger.js';
import knex, { Knex } from 'knex';

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
  private logger: Logger;
  private db: Knex;
  private initialized: boolean = false;

  /**
   * Create a new storage service instance
   * @param dbPath - Path to the SQLite database file
   */
  constructor(dbPath: string = 'data/analysis.db') {
    this.logger = new Logger('StorageService');
    
    // Convert relative path to absolute
    const resolvedPath = path.isAbsolute(dbPath) 
      ? dbPath 
      : path.resolve(process.cwd(), dbPath);
    
    this.logger.info(`Database path resolved to: ${resolvedPath}`);

    // Initialize knex with SQLite configuration
    this.db = knex({
      client: 'better-sqlite3',
      connection: {
        filename: resolvedPath
      },
      useNullAsDefault: true
    });
  }

  /**
   * Initialize the storage service
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Create directory if it doesn't exist
      const dirname = path.dirname(this.db.client.config.connection.filename);
      await this.db.raw(`PRAGMA journal_mode=WAL`);

      // Run migrations
      const hasTable = await this.db.schema.hasTable('analyses');
      if (!hasTable) {
        await this.db.schema.createTable('analyses', table => {
          table.string('id').primary();
          table.timestamp('timestamp').notNullable();
          table.string('fileName');
          table.text('code').notNullable();
          table.json('diagnostics');
          table.json('suggestions');
          table.text('explanation');
          table.json('sections');
          table.index(['timestamp']);
        });
        this.logger.info('Created analyses table');
      }

      this.initialized = true;
      this.logger.info('Storage service initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize storage', error);
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
    try {
      const id = `analysis_${Date.now()}_${Math.round(Math.random() * 1000)}`;
      const timestamp = new Date();

      const record = {
        id,
        timestamp,
        ...analysis,
        diagnostics: analysis.diagnostics ? JSON.stringify(analysis.diagnostics) : null,
        suggestions: analysis.suggestions ? JSON.stringify(analysis.suggestions) : null,
        sections: analysis.sections ? JSON.stringify(analysis.sections) : null
      };

      await this.db('analyses').insert(record);
      this.logger.info(`Saved analysis record: ${id}`);

      return id;
    } catch (error) {
      this.logger.error('Failed to save analysis', error);
      throw error;
    }
  }

  /**
   * Get an analysis by ID
   * @param id - The ID of the analysis to retrieve
   * @returns The analysis record or null if not found
   */
  async getAnalysisById(id: string): Promise<AnalysisRecord | null> {
    try {
      const record = await this.db('analyses')
        .where({ id })
        .first();

      if (!record) {
        return null;
      }

      return {
        ...record,
        diagnostics: record.diagnostics ? JSON.parse(record.diagnostics) : [],
        suggestions: record.suggestions ? JSON.parse(record.suggestions) : [],
        sections: record.sections ? JSON.parse(record.sections) : []
      };
    } catch (error) {
      this.logger.error('Failed to get analysis by ID', error);
      throw error;
    }
  }

  /**
   * Get recent analyses
   * @param limit - Maximum number of analyses to retrieve
   * @returns Array of analysis records
   */
  async getRecentAnalyses(limit = 10): Promise<AnalysisRecord[]> {
    try {
      const records = await this.db('analyses')
        .orderBy('timestamp', 'desc')
        .limit(limit);

      return records.map(record => ({
        ...record,
        diagnostics: record.diagnostics ? JSON.parse(record.diagnostics) : [],
        suggestions: record.suggestions ? JSON.parse(record.suggestions) : [],
        sections: record.sections ? JSON.parse(record.sections) : []
      }));
    } catch (error) {
      this.logger.error('Failed to get recent analyses', error);
      throw error;
    }
  }

  /**
   * Get the total count of analyses
   * @returns The total number of analyses stored
   */
  async getAnalysisCount(): Promise<number> {
    try {
      const result = await this.db('analyses').count('id as count').first();
      const count = result?.count;
      return typeof count === 'string' ? parseInt(count, 10) : (count || 0);
    } catch (error) {
      this.logger.error('Failed to get analysis count', error);
      throw error;
    }
  }

  /**
   * Clear all analyses
   */
  async clearAllAnalyses(): Promise<void> {
    try {
      await this.db('analyses').delete();
      this.logger.info('Cleared all analyses from storage');
    } catch (error) {
      this.logger.error('Failed to clear analyses', error);
      throw error;
    }
  }

  /**
   * Close the database connection
   */
  async close(): Promise<void> {
    try {
      await this.db.destroy();
      this.logger.info('Closed database connection');
    } catch (error) {
      this.logger.error('Failed to close database connection', error);
      throw error;
    }
  }
}

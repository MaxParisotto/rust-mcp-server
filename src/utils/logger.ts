/**
 * Logger utility for the MCP server
 * Provides structured logging with configurable levels and formats
 */

import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';
import * as os from 'os';

// Ensure directory exists
function ensureDirectoryExists(directoryPath: string): string {
  // Convert relative path to absolute
  const absolutePath = path.isAbsolute(directoryPath) 
    ? directoryPath 
    : path.join(process.cwd(), directoryPath);

  try {
    if (!fs.existsSync(absolutePath)) {
      fs.mkdirSync(absolutePath, { recursive: true });
    }
    return absolutePath;
  } catch (error) {
    // If we can't create the directory, use a temp directory
    const tempDir = path.join(os.tmpdir(), 'rust-mcp-logs');
    console.warn(`Failed to create log directory at ${absolutePath}, using temp directory: ${tempDir}`);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    return tempDir;
  }
}

// Log levels in order of severity
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

// Configuration for the logger
interface LoggerConfig {
  level: LogLevel;
  useConsole: boolean;
  useFile: boolean;
  logDir: string;
  logPrefix: string;
  maxLogFiles: number;
  maxLogSizeBytes: number;
}

/**
 * Logger class for consistent logging throughout the application
 * Supports console and file logging with configurable levels
 */
export class Logger {
  private name: string;
  private static config: LoggerConfig = {
    level: LogLevel.INFO,
    useConsole: true,
    useFile: true,
    logDir: 'logs', // Default to relative path
    logPrefix: 'mcp-server',
    maxLogFiles: 5,
    maxLogSizeBytes: 10 * 1024 * 1024, // 10MB
  };

  // Map of active file handles
  private static fileHandles: Map<string, fs.WriteStream> = new Map();
  private static logDirInitialized = false;
  private static resolvedLogDir: string = '';

  /**
   * Configure the global logger settings
   * @param config - Logger configuration options
   */
  public static configure(config: Partial<LoggerConfig>): void {
    // Merge configs but ensure logDir is always relative
    Logger.config = { 
      ...Logger.config, 
      ...config,
      // Force logDir to be relative if it's provided
      logDir: config.logDir ? path.relative(process.cwd(), path.resolve(process.cwd(), config.logDir)) : Logger.config.logDir
    };
    
    try {
      if (Logger.config.useFile && !Logger.logDirInitialized) {
        // Resolve the log directory path
        Logger.resolvedLogDir = path.resolve(process.cwd(), Logger.config.logDir);
        
        // Ensure the directory exists
        if (!fs.existsSync(Logger.resolvedLogDir)) {
          fs.mkdirSync(Logger.resolvedLogDir, { recursive: true });
        }
        
        Logger.logDirInitialized = true;
        Logger.rotateLogsIfNeeded();
      }
    } catch (error) {
      // If creating the directory fails, use temp directory
      const tempDir = path.join(os.tmpdir(), 'rust-mcp-logs');
      console.warn(`Failed to create log directory at ${Logger.resolvedLogDir}, using temp directory: ${tempDir}`);
      
      try {
        fs.mkdirSync(tempDir, { recursive: true });
        Logger.resolvedLogDir = tempDir;
        Logger.logDirInitialized = true;
      } catch (tempError) {
        // If even temp directory fails, disable file logging
        console.error('Failed to create temp log directory, falling back to console-only logging:', tempError);
        Logger.config.useFile = false;
        Logger.resolvedLogDir = '';
      }
    }
  }

  /**
   * Rotate log files if they exceed the maximum size
   */
  private static rotateLogsIfNeeded(): void {
    const currentLogFile = path.join(
      Logger.resolvedLogDir,
      `${Logger.config.logPrefix}.log`
    );

    if (fs.existsSync(currentLogFile)) {
      const stats = fs.statSync(currentLogFile);
      if (stats.size >= Logger.config.maxLogSizeBytes) {
        Logger.rotateLogFiles();
      }
    }
  }

  /**
   * Rotate log files, shifting existing logs and creating a new empty log file
   */
  private static rotateLogFiles(): void {
    // Close any open file handles
    for (const [_, handle] of Logger.fileHandles) {
      handle.end();
    }
    Logger.fileHandles.clear();

    // Shift existing log files
    for (let i = Logger.config.maxLogFiles - 1; i > 0; i--) {
      const oldPath = path.join(
        Logger.resolvedLogDir,
        `${Logger.config.logPrefix}.${i - 1}.log`
      );
      const newPath = path.join(
        Logger.resolvedLogDir,
        `${Logger.config.logPrefix}.${i}.log`
      );

      if (fs.existsSync(oldPath)) {
        if (fs.existsSync(newPath)) {
          fs.unlinkSync(newPath);
        }
        fs.renameSync(oldPath, newPath);
      }
    }

    // Rename current log file
    const currentLogFile = path.join(
      Logger.resolvedLogDir,
      `${Logger.config.logPrefix}.log`
    );
    const rotatedLogFile = path.join(
      Logger.resolvedLogDir,
      `${Logger.config.logPrefix}.0.log`
    );

    if (fs.existsSync(currentLogFile)) {
      if (fs.existsSync(rotatedLogFile)) {
        fs.unlinkSync(rotatedLogFile);
      }
      fs.renameSync(currentLogFile, rotatedLogFile);
    }
  }

  /**
   * Create a new logger instance with the specified name
   * @param name - The name/category for this logger instance
   */
  constructor(name: string) {
    this.name = name;
  }

  /**
   * Log a debug message
   * @param message - The message to log
   * @param data - Optional data to include in the log
   */
  public debug(message: string, data?: any): void {
    this.log(LogLevel.DEBUG, message, data);
  }

  /**
   * Log an info message
   * @param message - The message to log
   * @param data - Optional data to include in the log
   */
  public info(message: string, data?: any): void {
    this.log(LogLevel.INFO, message, data);
  }

  /**
   * Log a warning message
   * @param message - The message to log
   * @param data - Optional data to include in the log
   */
  public warn(message: string, data?: any): void {
    this.log(LogLevel.WARN, message, data);
  }

  /**
   * Log an error message
   * @param message - The message to log
   * @param error - The error object or data to include
   */
  public error(message: string, error?: any): void {
    this.log(LogLevel.ERROR, message, error);
  }

  /**
   * Internal method to log a message at the specified level
   * @param level - The log level
   * @param message - The message to log
   * @param data - Optional data to include
   */
  private log(level: LogLevel, message: string, data?: any): void {
    if (level < Logger.config.level) {
      return;
    }

    const timestamp = new Date().toISOString();
    const levelName = LogLevel[level];
    
    // Format the log entry
    let logEntry = `[${timestamp}] [${levelName}] [${this.name}] ${message}`;
    
    // Format any additional data
    if (data !== undefined) {
      if (data instanceof Error) {
        logEntry += `\n${data.stack || data.toString()}`;
      } else if (typeof data === 'object') {
        try {
          logEntry += `\n${util.inspect(data, { depth: null, colors: false })}`;
        } catch (e: any) {
          logEntry += `\n[Unable to stringify object: ${e?.message || 'Unknown error'}]`;
        }
      } else {
        logEntry += ` ${data}`;
      }
    }

    // Output to console if enabled
    if (Logger.config.useConsole) {
      let consoleMethod: 'debug' | 'info' | 'warn' | 'error' = 'info';
      switch (level) {
        case LogLevel.DEBUG:
          consoleMethod = 'debug';
          break;
        case LogLevel.INFO:
          consoleMethod = 'info';
          break;
        case LogLevel.WARN:
          consoleMethod = 'warn';
          break;
        case LogLevel.ERROR:
          consoleMethod = 'error';
          break;
      }
      console[consoleMethod](logEntry);
    }

    // Write to log file if enabled
    if (Logger.config.useFile) {
      try {
        this.writeToLogFile(`${logEntry}\n`);
      } catch (error) {
        // If writing to file fails, at least we've logged to console
        console.error('Failed to write to log file:', error);
      }
    }
  }

  /**
   * Write a log entry to the log file
   * @param entry - The formatted log entry to write
   */
  private writeToLogFile(entry: string): void {
    if (!Logger.config.useFile || !Logger.resolvedLogDir) {
      return;
    }

    try {
      const logFilePath = path.join(
        Logger.resolvedLogDir,
        `${Logger.config.logPrefix}.log`
      );

      // Get or create file stream
      let fileStream = Logger.fileHandles.get(logFilePath);
      if (!fileStream) {
        fileStream = fs.createWriteStream(logFilePath, { flags: 'a' });
        Logger.fileHandles.set(logFilePath, fileStream);
      }

      // Write to the log file
      fileStream.write(entry);
    } catch (error) {
      // If we can't write to the log file, just log to console
      console.error('Failed to write to log file:', error);
      // Disable file logging to prevent further errors
      Logger.config.useFile = false;
    }
  }

  /**
   * Close all log file handles - should be called when shutting down the application
   */
  public static closeAllLogs(): void {
    for (const [_, handle] of Logger.fileHandles) {
      handle.end();
    }
    Logger.fileHandles.clear();
  }
} 
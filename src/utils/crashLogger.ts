import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

const LOG_FILE_NAME = 'app_crash_logs.txt';
const LOG_FILE_PATH = `${FileSystem.documentDirectory}${LOG_FILE_NAME}`;
const MAX_LOG_SIZE = 5 * 1024 * 1024; // 5MB max log file size

interface LogEntry {
  timestamp: string;
  type: 'error' | 'crash' | 'warning' | 'info';
  message: string;
  stack?: string;
  componentStack?: string;
  metadata?: Record<string, any>;
}

class CrashLogger {
  private static instance: CrashLogger;
  private isInitialized = false;
  private logQueue: LogEntry[] = [];
  private isWriting = false;

  private constructor() {}

  static getInstance(): CrashLogger {
    if (!CrashLogger.instance) {
      CrashLogger.instance = new CrashLogger();
    }
    return CrashLogger.instance;
  }

  async initialize() {
    if (this.isInitialized) return;

    try {
      // Check if log file exists, if not create it
      const fileInfo = await FileSystem.getInfoAsync(LOG_FILE_PATH);
      if (!fileInfo.exists) {
        await FileSystem.writeAsStringAsync(
          LOG_FILE_PATH,
          `=== App Crash Log File ===\nCreated: ${new Date().toISOString()}\nPlatform: ${Platform.OS}\n\n`,
          { encoding: FileSystem.EncodingType.UTF8 }
        );
      }

      this.isInitialized = true;
      console.log('[CrashLogger] Initialized successfully');
    } catch (error) {
      console.error('[CrashLogger] Failed to initialize:', error);
    }
  }

  private async rotateLogIfNeeded() {
    try {
      const fileInfo = await FileSystem.getInfoAsync(LOG_FILE_PATH);
      if (fileInfo.exists && fileInfo.size && fileInfo.size > MAX_LOG_SIZE) {
        // Create backup
        const backupPath = `${FileSystem.documentDirectory}app_crash_logs_backup.txt`;
        await FileSystem.copyAsync({
          from: LOG_FILE_PATH,
          to: backupPath,
        });
        // Start fresh log
        await FileSystem.writeAsStringAsync(
          LOG_FILE_PATH,
          `=== App Crash Log File (Rotated) ===\nCreated: ${new Date().toISOString()}\nPlatform: ${Platform.OS}\n\n`,
          { encoding: FileSystem.EncodingType.UTF8 }
        );
      }
    } catch (error) {
      console.error('[CrashLogger] Failed to rotate log:', error);
    }
  }

  private formatLogEntry(entry: LogEntry): string {
    const separator = '\n' + '='.repeat(80) + '\n';
    let log = separator;
    log += `[${entry.type.toUpperCase()}] ${entry.timestamp}\n`;
    log += `Message: ${entry.message}\n`;

    if (entry.stack) {
      log += `\nStack Trace:\n${entry.stack}\n`;
    }

    if (entry.componentStack) {
      log += `\nComponent Stack:\n${entry.componentStack}\n`;
    }

    if (entry.metadata && Object.keys(entry.metadata).length > 0) {
      log += `\nMetadata:\n${JSON.stringify(entry.metadata, null, 2)}\n`;
    }

    log += separator + '\n';
    return log;
  }

  private async writeLog(entry: LogEntry) {
    this.logQueue.push(entry);

    if (this.isWriting) return;

    this.isWriting = true;

    while (this.logQueue.length > 0) {
      const currentEntry = this.logQueue.shift();
      if (!currentEntry) continue;

      try {
        await this.rotateLogIfNeeded();

        const formattedLog = this.formatLogEntry(currentEntry);

        await FileSystem.writeAsStringAsync(LOG_FILE_PATH, formattedLog, {
          encoding: FileSystem.EncodingType.UTF8,
          append: true,
        });
      } catch (error) {
        console.error('[CrashLogger] Failed to write log:', error);
      }
    }

    this.isWriting = false;
  }

  async logError(error: Error, metadata?: Record<string, any>) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      type: 'error',
      message: error.message || 'Unknown error',
      stack: error.stack,
      metadata: {
        ...metadata,
        name: error.name,
      },
    };

    await this.writeLog(entry);
    console.error('[CrashLogger] Error logged:', error.message);
  }

  async logCrash(error: Error, isFatal: boolean = false, componentStack?: string) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      type: 'crash',
      message: error.message || 'App crashed',
      stack: error.stack,
      componentStack,
      metadata: {
        isFatal,
        name: error.name,
        platform: Platform.OS,
        platformVersion: Platform.Version,
      },
    };

    await this.writeLog(entry);
    console.error('[CrashLogger] Crash logged:', error.message, 'Fatal:', isFatal);
  }

  async logWarning(message: string, metadata?: Record<string, any>) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      type: 'warning',
      message,
      metadata,
    };

    await this.writeLog(entry);
  }

  async logInfo(message: string, metadata?: Record<string, any>) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      type: 'info',
      message,
      metadata,
    };

    await this.writeLog(entry);
  }

  async getLogs(): Promise<string> {
    try {
      const fileInfo = await FileSystem.getInfoAsync(LOG_FILE_PATH);
      if (!fileInfo.exists) {
        return 'No logs available';
      }

      const logs = await FileSystem.readAsStringAsync(LOG_FILE_PATH, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      return logs;
    } catch (error) {
      console.error('[CrashLogger] Failed to read logs:', error);
      return 'Error reading logs';
    }
  }

  async getLogFileUri(): Promise<string | null> {
    try {
      const fileInfo = await FileSystem.getInfoAsync(LOG_FILE_PATH);
      if (!fileInfo.exists) {
        return null;
      }
      return LOG_FILE_PATH;
    } catch (error) {
      console.error('[CrashLogger] Failed to get log file URI:', error);
      return null;
    }
  }

  async clearLogs(): Promise<boolean> {
    try {
      const fileInfo = await FileSystem.getInfoAsync(LOG_FILE_PATH);
      if (fileInfo.exists) {
        await FileSystem.deleteAsync(LOG_FILE_PATH);
      }

      // Create fresh log file
      await FileSystem.writeAsStringAsync(
        LOG_FILE_PATH,
        `=== App Crash Log File ===\nCreated: ${new Date().toISOString()}\nPlatform: ${Platform.OS}\n\n`,
        { encoding: FileSystem.EncodingType.UTF8 }
      );

      console.log('[CrashLogger] Logs cleared successfully');
      return true;
    } catch (error) {
      console.error('[CrashLogger] Failed to clear logs:', error);
      return false;
    }
  }

  async getLogFileSize(): Promise<string> {
    try {
      const fileInfo = await FileSystem.getInfoAsync(LOG_FILE_PATH);
      if (!fileInfo.exists || !fileInfo.size) {
        return '0 KB';
      }

      const sizeInKB = fileInfo.size / 1024;
      if (sizeInKB < 1024) {
        return `${sizeInKB.toFixed(2)} KB`;
      }

      const sizeInMB = sizeInKB / 1024;
      return `${sizeInMB.toFixed(2)} MB`;
    } catch (error) {
      console.error('[CrashLogger] Failed to get log file size:', error);
      return 'Unknown';
    }
  }

  async hasLogs(): Promise<boolean> {
    try {
      const fileInfo = await FileSystem.getInfoAsync(LOG_FILE_PATH);
      return fileInfo.exists && fileInfo.size !== undefined && fileInfo.size > 200; // More than header
    } catch (error) {
      return false;
    }
  }
}

export const crashLogger = CrashLogger.getInstance();

// Global error handler setup
export const setupGlobalErrorHandlers = () => {
  // Handle JavaScript errors
  const originalConsoleError = console.error;
  console.error = (...args: any[]) => {
    try {
      // Extract error object if present
      const errorArg = args.find(arg => arg instanceof Error);
      const errorMessage = args.map(arg =>
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');

      if (errorArg instanceof Error) {
        crashLogger.logError(errorArg, {
          context: 'Console Error',
          additionalInfo: errorMessage,
        }).catch(() => {});
      } else {
        crashLogger.logError(new Error(errorMessage), {
          context: 'Console Error',
        }).catch(() => {});
      }
    } catch (loggingError) {
      // Prevent logging errors from crashing the app
    }

    // Call original console.error
    originalConsoleError(...args);
  };

  // Handle warnings
  const originalConsoleWarn = console.warn;
  console.warn = (...args: any[]) => {
    try {
      const warningMessage = args.map(arg =>
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');

      crashLogger.logWarning(warningMessage, {
        context: 'Console Warning',
      }).catch(() => {});
    } catch (loggingError) {
      // Prevent logging errors from crashing the app
    }

    originalConsoleWarn(...args);
  };

  // Handle unhandled promise rejections
  const originalPromiseRejectionHandler = global.Promise.prototype.catch;

  // Set up global unhandled rejection handler
  if (typeof global !== 'undefined' && global.ErrorUtils) {
    const originalHandler = global.ErrorUtils.getGlobalHandler();

    global.ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
      crashLogger.logCrash(error, isFatal || false).catch(() => {});

      // Call original handler
      if (originalHandler) {
        originalHandler(error, isFatal);
      }
    });
  }

  console.log('[CrashLogger] Global error handlers setup complete');
};

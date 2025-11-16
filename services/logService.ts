export type LogLevel = 'INFO' | 'WARN' | 'ERROR';

export interface LogEntry {
  timestamp: Date;
  message: string;
  level: LogLevel;
  context?: any;
}

// In-memory log store
const logs: LogEntry[] = [];
const MAX_LOGS = 100;

const addLog = (level: LogLevel, message: string, context?: any) => {
  if (logs.length >= MAX_LOGS) {
    logs.shift(); // Remove the oldest log
  }
  const newLog = {
    timestamp: new Date(),
    level,
    message,
    context,
  };
  logs.push(newLog);
  // Also console log for real-time debugging
  switch(level) {
    case 'INFO':
        console.log(`[INFO] ${message}`, context || '');
        break;
    case 'WARN':
        console.warn(`[WARN] ${message}`, context || '');
        break;
    case 'ERROR':
        console.error(`[ERROR] ${message}`, context || '');
        break;
  }
};

export const logInfo = (message: string, context?: any) => {
  addLog('INFO', message, context);
};

export const logWarn = (message: string, context?: any) => {
  addLog('WARN', message, context);
};

export const logError = (message: string, context?: any) => {
  addLog('ERROR', message, context);
};

export const getLogs = (): LogEntry[] => {
  return [...logs].reverse(); // Return a copy, newest first
};

export const clearLogs = () => {
  logs.length = 0;
  logInfo('Logs cleared.');
};

// Initial log
logInfo('Log service initialized.');
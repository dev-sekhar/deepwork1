
import React, { useState, useEffect } from 'react';
import { getLogs, clearLogs, LogEntry } from '../services/logService';
import { TrashIcon } from './icons';

interface LogViewerProps {
  onClose: () => void;
}

const getLogLevelClass = (level: LogEntry['level']) => {
  switch (level) {
    case 'ERROR':
      return 'text-red-400 border-red-500/30 bg-red-500/10';
    case 'WARN':
      return 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10';
    case 'INFO':
    default:
      return 'text-slate-300 border-slate-700 bg-slate-900/50';
  }
};

export const LogViewer: React.FC<LogViewerProps> = ({ onClose }) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const refreshLogs = () => {
    setLogs(getLogs());
  };

  useEffect(() => {
    refreshLogs();
  }, []);

  const handleClearLogs = () => {
    clearLogs();
    refreshLogs();
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 animate-fade-in" onClick={onClose}>
      <div className="bg-slate-800 rounded-lg shadow-xl w-full max-w-4xl flex flex-col h-[90vh]" onClick={e => e.stopPropagation()}>
        <header className="flex justify-between items-center p-4 border-b border-slate-700">
          <h2 className="text-xl font-bold text-primary-accent">Developer Logs</h2>
          <div className="flex items-center gap-4">
             <button
              onClick={handleClearLogs}
              className="flex items-center gap-2 px-3 py-1 bg-red-800 text-white text-sm rounded-md hover:bg-red-700 transition"
            >
              <TrashIcon className="w-4 h-4" />
              Clear
            </button>
            <button
              onClick={refreshLogs}
              className="px-4 py-1 bg-slate-600 text-white text-sm rounded-md hover:bg-slate-500 transition"
            >
              Refresh
            </button>
          </div>
        </header>
        
        <main className="flex-1 p-4 overflow-y-auto font-mono text-xs space-y-2">
            {logs.length === 0 ? (
                <div className="flex items-center justify-center h-full text-slate-500">
                    No logs recorded yet.
                </div>
            ) : (
                logs.map((log, index) => (
                    <div key={index} className={`p-3 rounded-md border ${getLogLevelClass(log.level)}`}>
                        <div className="flex justify-between items-center mb-1">
                            <span className="font-bold">{log.level}</span>
                            <span className="text-slate-500">{`${log.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}.${String(log.timestamp.getMilliseconds()).padStart(3, '0')}`}</span>
                        </div>
                        <p className="whitespace-pre-wrap break-words">{log.message}</p>
                        {log.context && (
                            <details className="mt-2 text-slate-400">
                                <summary className="cursor-pointer">Context</summary>
                                <pre className="mt-1 p-2 bg-black/30 rounded-md overflow-x-auto">
                                    {JSON.stringify(log.context, null, 2)}
                                </pre>
                            </details>
                        )}
                    </div>
                ))
            )}
        </main>
        
        <footer className="p-4 border-t border-slate-700 text-right">
            <button onClick={onClose} className="px-6 py-2 bg-primary text-white font-semibold rounded-md hover:bg-primary-focus transition">
                Close
            </button>
        </footer>
      </div>
    </div>
  );
};

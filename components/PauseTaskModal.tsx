
import React, { useState } from 'react';

interface PauseTaskModalProps {
  taskName: string;
  onSubmit: (pauseData: { startDate: string; endDate: string; reason: string }) => void;
  onClose: () => void;
}

export const PauseTaskModal: React.FC<PauseTaskModalProps> = ({ taskName, onSubmit, onClose }) => {
  const toLocalYYYYMMDD = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [startDate, setStartDate] = useState(toLocalYYYYMMDD(new Date()));
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = () => {
    setError('');
    if (!startDate || !endDate) {
      setError('Start and end dates are required.');
      return;
    }
    if (new Date(endDate) < new Date(startDate)) {
      setError('End date cannot be before the start date.');
      return;
    }
    onSubmit({ startDate, endDate, reason });
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-slate-800 rounded-lg shadow-xl p-8 w-full max-w-md space-y-6 transform animate-fade-in-up">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-cyan-400">Pause Task</h2>
          <p className="text-slate-400 mt-1">Temporarily pause "{taskName}"</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="pauseStartDate" className="block text-sm font-medium text-slate-300 mb-2">Start Date</label>
            <input
              id="pauseStartDate"
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              min={toLocalYYYYMMDD(new Date())}
              className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-white placeholder-slate-400 focus:ring-2 focus:ring-cyan-500"
              required
            />
          </div>
          <div>
            <label htmlFor="pauseEndDate" className="block text-sm font-medium text-slate-300 mb-2">End Date</label>
            <input
              id="pauseEndDate"
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              min={startDate}
              className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-white placeholder-slate-400 focus:ring-2 focus:ring-cyan-500"
              required
            />
          </div>
        </div>

        <div>
          <label htmlFor="reason" className="block text-sm font-medium text-slate-300 mb-2">Reason (optional)</label>
          <textarea
            id="reason"
            value={reason}
            onChange={e => setReason(e.target.value)}
            rows={2}
            placeholder="e.g., Vacation, project on hold"
            className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-white placeholder-slate-400 focus:ring-2 focus:ring-cyan-500"
          />
        </div>

        {error && (
            <div className="p-3 bg-red-500/20 text-red-400 text-sm rounded-md text-center animate-fade-in">
                {error}
            </div>
        )}

        <div className="flex justify-end gap-4 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 bg-slate-600 text-white rounded-md hover:bg-slate-500 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="px-6 py-2 bg-cyan-600 text-white font-semibold rounded-md hover:bg-cyan-700 transition"
          >
            Pause Task
          </button>
        </div>
      </div>
    </div>
  );
};

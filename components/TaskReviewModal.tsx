import React from 'react';
import { ScheduleItem, ScheduleItemType } from '../types';

interface TaskReviewModalProps {
  item: ScheduleItem;
  onClose: () => void;
}

const renderStars = (rating: number) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
        stars.push(
            <svg key={i} className={`w-6 h-6 ${rating >= i ? 'text-yellow-400' : 'text-slate-600'}`} fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
        );
    }
    return <div className="flex">{stars}</div>;
};

const moods = {
    focused: { emoji: '🎯', label: 'Focused' },
    distracted: { emoji: '🐿️', label: 'Distracted' },
    tired: { emoji: '😴', label: 'Tired' },
};

export const TaskReviewModal: React.FC<TaskReviewModalProps> = ({ item, onClose }) => {
  if (!item.feedback) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 animate-fade-in" onClick={onClose}>
      <div className="bg-slate-800 rounded-lg shadow-xl p-8 w-full max-w-md space-y-6 transform animate-fade-in-up" onClick={e => e.stopPropagation()}>
        <div className="text-center">
            <h2 className="text-2xl font-bold text-cyan-400">Session Review</h2>
            <p className="text-slate-400 mt-1 truncate">"{item.taskName}"</p>
        </div>

        <div className="space-y-4 text-sm">
            <div className="flex justify-between items-center p-3 bg-slate-700/50 rounded-lg">
                <span className="font-medium text-slate-300">Type</span>
                 <span className={`text-xs font-bold px-2 py-1 rounded-full ${item.type === ScheduleItemType.DEEP_WORK ? 'text-cyan-400 bg-cyan-900/50' : 'text-indigo-400 bg-indigo-900/50'}`}>
                    {item.type === ScheduleItemType.DEEP_WORK ? 'DEEP' : 'SHALLOW'} WORK
                 </span>
            </div>
             <div className="flex justify-between items-center p-3 bg-slate-700/50 rounded-lg">
                <span className="font-medium text-slate-300">Duration</span>
                <span className="text-white font-mono">{item.durationMinutes} minutes</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-slate-700/50 rounded-lg">
                <span className="font-medium text-slate-300">Focus Quality</span>
                {renderStars(item.feedback.focusQuality)}
            </div>
            {item.feedback.mood && (
                <div className="flex justify-between items-center p-3 bg-slate-700/50 rounded-lg">
                    <span className="font-medium text-slate-300">Mood</span>
                    <div className="flex items-center gap-2">
                        <span className="text-xl">{moods[item.feedback.mood].emoji}</span>
                        <span className="text-white">{moods[item.feedback.mood].label}</span>
                    </div>
                </div>
            )}
             {item.feedback.interruptions && (
                <div className="p-3 bg-slate-700/50 rounded-lg">
                    <p className="font-medium text-slate-300 mb-1">Interruptions</p>
                    <p className="text-white italic bg-slate-900/50 p-2 rounded">"{item.feedback.interruptions}"</p>
                </div>
            )}
        </div>

        <button onClick={onClose} className="w-full py-3 bg-slate-600 text-white font-bold rounded-md hover:bg-slate-500 transition">
          Close
        </button>
      </div>
    </div>
  );
};
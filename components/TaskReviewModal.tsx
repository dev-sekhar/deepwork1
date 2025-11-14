
import React from 'react';
import { ScheduleItem, ScheduleItemType, DeepWorkSession, Feedback } from '../types';

interface TaskReviewModalProps {
  item: ScheduleItem;
  reviewDate: Date;
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

const getTypeStyles = (type: ScheduleItemType) => {
    switch (type) {
        case ScheduleItemType.DEEP_WORK:
            return 'text-green-400 bg-green-900/50';
        case ScheduleItemType.SHALLOW_WORK:
            return 'text-orange-400 bg-orange-900/50';
        case ScheduleItemType.AI_ASSISTED_WORK:
            return 'text-violet-400 bg-violet-900/50';
        default:
            return 'text-slate-400 bg-slate-700';
    }
};

export const TaskReviewModal: React.FC<TaskReviewModalProps> = ({ item, reviewDate, onClose }) => {
  const toLocalYYYYMMDD = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  const reviewDateStr = toLocalYYYYMMDD(reviewDate);
  const completion = item.completions?.find(c => c.date === reviewDateStr);
  
  if (!completion?.feedback) return null;
  
  const { feedback } = completion;

  const typeStyleClasses = getTypeStyles(item.type);
  const textColorClass = typeStyleClasses.split(' ').find(c => c.startsWith('text-'));

  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString();

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 animate-fade-in" onClick={onClose}>
      <div className="bg-slate-800 rounded-lg shadow-xl p-8 w-full max-w-md space-y-6 transform animate-fade-in-up" onClick={e => e.stopPropagation()}>
        <div className="text-center">
            <h2 className="text-2xl font-bold text-cyan-400">Session Review</h2>
            <h3 className={`text-xl font-bold ${textColorClass} mt-1 truncate`} title={item.taskName}>{item.taskName}</h3>
        </div>

        <div className="space-y-4 text-sm max-h-[60vh] overflow-y-auto pr-2">
            <div className="flex justify-between items-center p-3 bg-slate-700/50 rounded-lg">
                <span className="font-medium text-slate-300">Type</span>
                 <span className={`text-xs font-bold px-2 py-1 rounded-full ${getTypeStyles(item.type)}`}>
                    {item.type.replace('_', ' ')}
                 </span>
            </div>
             <div className="flex justify-between items-center p-3 bg-slate-700/50 rounded-lg">
                <span className="font-medium text-slate-300">Duration</span>
                <span className="text-white font-mono">{item.durationMinutes} minutes</span>
            </div>
             {item.type === ScheduleItemType.DEEP_WORK && (
                <div className="p-3 bg-slate-700/50 rounded-lg">
                    <p className="font-medium text-slate-300 mb-1">Goal</p>
                    <p className="text-white bg-slate-900/50 p-2 rounded">{(item as DeepWorkSession).goal}</p>
                </div>
            )}
            <div className="flex justify-between items-center p-3 bg-slate-700/50 rounded-lg">
                <span className="font-medium text-slate-300">Focus Quality</span>
                {renderStars(feedback.focusQuality)}
            </div>
            {feedback.mood && (
                <div className="flex justify-between items-center p-3 bg-slate-700/50 rounded-lg">
                    <span className="font-medium text-slate-300">Mood</span>
                    <div className="flex items-center gap-2">
                        <span className="text-xl">{moods[feedback.mood].emoji}</span>
                        <span className="text-white">{moods[feedback.mood].label}</span>
                    </div>
                </div>
            )}
             {feedback.interruptions && (
                <div className="p-3 bg-slate-700/50 rounded-lg">
                    <p className="font-medium text-slate-300 mb-1">Interruptions</p>
                    <p className="text-white italic bg-slate-900/50 p-2 rounded">"{feedback.interruptions}"</p>
                </div>
            )}
            {item.pauses && item.pauses.length > 0 && (
                <div className="p-3 bg-slate-700/50 rounded-lg">
                    <p className="font-medium text-slate-300 mb-2">Pause History</p>
                    <div className="space-y-2">
                        {item.pauses.map((pause, index) => (
                            <div key={index} className="bg-slate-900/50 p-2 rounded">
                                <p className="font-semibold text-blue-300">
                                    {formatDate(pause.startDate)} - {formatDate(pause.endDate)}
                                </p>
                                {pause.reason && <p className="text-slate-300 italic text-xs">Reason: {pause.reason}</p>}
                            </div>
                        ))}
                    </div>
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

import React, { useState, useCallback } from 'react';
import { ScheduleItem, ScheduleItemType, SessionStatus, DeepWorkSession, ShallowWorkTask } from '../types';
import { getPreSessionRitual } from '../services/geminiService';
import { SparklesIcon, CheckIcon } from './icons';

interface SessionSchedulerProps {
  onAddItem: (item: ScheduleItem) => void;
  onCancel: () => void;
  schedule: ScheduleItem[];
}

const WEEK_DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export const SessionScheduler: React.FC<SessionSchedulerProps> = ({ onAddItem, onCancel, schedule }) => {
  const [taskName, setTaskName] = useState('');
  const [duration, setDuration] = useState(90); // Default to a valid deep work duration
  const [ritual, setRitual] = useState<string[] | null>(null);
  const [isFetchingRitual, setIsFetchingRitual] = useState(false);
  const [itemType, setItemType] = useState<ScheduleItemType>(ScheduleItemType.DEEP_WORK);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState(() => {
      const now = new Date();
      now.setMinutes(now.getMinutes() + 15); // Default to 15 mins from now
      return now.toTimeString().slice(0, 5);
  });
  const [repeatFrequency, setRepeatFrequency] = useState<'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY'>('NONE');
  const [repeatOn, setRepeatOn] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);


  const handleGetRitual = useCallback(async () => {
    if (!taskName) return;
    setIsFetchingRitual(true);
    const generatedRitual = await getPreSessionRitual(taskName);
    setRitual(generatedRitual);
    setIsFetchingRitual(false);
  }, [taskName]);
  
  const handleToggleRepeatDay = (dayIndex: number) => {
    setRepeatOn(prev => 
      prev.includes(dayIndex) 
        ? prev.filter(d => d !== dayIndex)
        : [...prev, dayIndex]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!taskName || duration < 1) return;
    
    const newItemStart = new Date(`${startDate}T${startTime}`);

    if (newItemStart < new Date()) {
        setError("Cannot schedule tasks in the past. Please select a future date and time.");
        return;
    }
    
    const newItemEnd = new Date(newItemStart.getTime() + duration * 60 * 1000);

    // --- Conflict validation and suggestion logic ---
    const dayOfWeek = newItemStart.getDay();

    const getEffectiveStartTime = (item: ScheduleItem, date: Date): Date => {
      const itemTime = new Date(item.startDate);
      const effectiveDate = new Date(date);
      effectiveDate.setHours(itemTime.getHours(), itemTime.getMinutes(), itemTime.getSeconds(), itemTime.getMilliseconds());
      return effectiveDate;
    };
    
    const tasksOnSameDay = schedule.filter(item => {
        const itemStartDate = new Date(item.startDate);
        const itemDateOnly = new Date(itemStartDate.getFullYear(), itemStartDate.getMonth(), itemStartDate.getDate());
        const newItemDateOnly = new Date(newItemStart.getFullYear(), newItemStart.getMonth(), newItemStart.getDate());
        
        if (item.repeatFrequency === 'NONE' && itemDateOnly.getTime() !== newItemDateOnly.getTime()) {
          return false;
        }

        switch (item.repeatFrequency) {
            case 'NONE':
                return itemDateOnly.getTime() === newItemDateOnly.getTime();
            case 'DAILY':
                return true;
            case 'WEEKLY':
                return item.repeatOn?.includes(dayOfWeek) ?? false;
            case 'MONTHLY':
                return itemStartDate.getDate() === newItemStart.getDate();
            default:
                return false;
        }
    }).map(item => {
        const start = getEffectiveStartTime(item, newItemStart);
        const end = new Date(start.getTime() + item.durationMinutes * 60000);
        return { ...item, effectiveStart: start, effectiveEnd: end };
    }).sort((a, b) => a.effectiveStart.getTime() - b.effectiveStart.getTime());

    let initialConflict: { taskName: string; effectiveEnd: Date } | null = null;
    for (const existingTask of tasksOnSameDay) {
        if (newItemStart < existingTask.effectiveEnd && newItemEnd > existingTask.effectiveStart) {
            initialConflict = { taskName: existingTask.taskName, effectiveEnd: existingTask.effectiveEnd };
            break;
        }
    }

    if (initialConflict) {
        let proposedStart = initialConflict.effectiveEnd;
        let slotFound = false;

        while (!slotFound) {
            const proposedEnd = new Date(proposedStart.getTime() + duration * 60000);
            const conflictingTask = tasksOnSameDay.find(task => 
                proposedStart < task.effectiveEnd && proposedEnd > task.effectiveStart
            );

            if (conflictingTask) {
                proposedStart = conflictingTask.effectiveEnd;
            } else {
                slotFound = true;
            }
        }
        
        const suggestionTime = proposedStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
        setError(`Time conflict with "${initialConflict.taskName}". Next available slot is at ${suggestionTime}.`);
        return;
    }
    // --- End of validation ---

    const fullStartDate = newItemStart.toISOString();

    const baseItemData = {
        id: new Date().toISOString() + Math.random(),
        taskName,
        durationMinutes: duration,
        startDate: fullStartDate,
        repeatFrequency,
        repeatOn: repeatFrequency === 'WEEKLY' ? repeatOn.sort((a,b) => a-b) : null,
    };

    if (itemType === ScheduleItemType.DEEP_WORK) {
      const newSession: DeepWorkSession = {
        ...baseItemData,
        type: ScheduleItemType.DEEP_WORK,
        status: SessionStatus.PENDING,
        feedback: null,
        ritual,
        ritualChecklist: ritual ? ritual.map(text => ({ text, completed: false })) : null,
        workspaceImageUrl: null,
      };
      onAddItem(newSession);
    } else {
       const newShallowTask: ShallowWorkTask = {
        ...baseItemData,
        type: ScheduleItemType.SHALLOW_WORK,
        status: SessionStatus.PENDING,
        feedback: null,
      };
      onAddItem(newShallowTask);
    }
  };

  const handleItemTypeChange = (newItemType: ScheduleItemType) => {
    setItemType(newItemType);
    if (newItemType === ScheduleItemType.DEEP_WORK) {
        setDuration(90); // Sensible default for deep work
    } else {
        setDuration(15); // Sensible default for shallow work
    }
  };


  return (
    <div className="p-6 bg-slate-800 rounded-lg shadow-lg w-full max-w-md mx-auto animate-fade-in-up">
      <h2 className="text-2xl font-bold text-cyan-400 mb-6">Schedule New Item</h2>
      <form onSubmit={handleSubmit} className="space-y-6">

        <div>
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-700 rounded-lg mb-6">
                <button type="button" onClick={() => handleItemTypeChange(ScheduleItemType.DEEP_WORK)} className={`px-3 py-2 rounded-md text-sm font-semibold transition ${itemType === ScheduleItemType.DEEP_WORK ? 'bg-cyan-500 text-slate-900' : 'bg-transparent hover:bg-slate-600/50'}`}>
                    Deep Work
                </button>
                 <button type="button" onClick={() => handleItemTypeChange(ScheduleItemType.SHALLOW_WORK)} className={`px-3 py-2 rounded-md text-sm font-semibold transition ${itemType === ScheduleItemType.SHALLOW_WORK ? 'bg-cyan-500 text-slate-900' : 'bg-transparent hover:bg-slate-600/50'}`}>
                    Shallow Work
                </button>
            </div>
        </div>

        <div>
          <label htmlFor="taskName" className="block text-sm font-medium text-slate-300 mb-2">
            Task
          </label>
          <input
            id="taskName"
            type="text"
            value={taskName}
            onChange={(e) => setTaskName(e.target.value)}
            placeholder={itemType === ScheduleItemType.DEEP_WORK ? "e.g., Write chapter 3 of novel" : "e.g., Reply to team emails"}
            className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-white placeholder-slate-400 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition"
            required
          />
        </div>

        {itemType === ScheduleItemType.DEEP_WORK && (
            <div className="animate-fade-in space-y-6">
                <div>
                    <button
                        type="button"
                        onClick={handleGetRitual}
                        disabled={!taskName || isFetchingRitual}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:bg-slate-600 disabled:cursor-not-allowed transition-all duration-300"
                    >
                        <SparklesIcon className="w-5 h-5" />
                        {isFetchingRitual ? 'Generating...' : 'Get AI Pre-Session Ritual'}
                    </button>
                </div>
                
                {ritual && (
                    <div className="p-4 bg-slate-700/50 rounded-lg space-y-2 animate-fade-in-up">
                        <h4 className="font-semibold text-cyan-400">Your Ritual:</h4>
                        <ul className="list-none space-y-2">
                            {ritual.map((step, index) => (
                                <li key={index} className="flex items-start gap-3 text-slate-300">
                                <CheckIcon className="w-5 h-5 text-green-400 mt-1 flex-shrink-0" />
                                <span>{step}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        )}


        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Duration (minutes)
          </label>
          {itemType === ScheduleItemType.DEEP_WORK ? (
            <div className="grid grid-cols-3 gap-2 animate-fade-in">
              {[60, 90, 120].map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDuration(d)}
                  className={`px-3 py-2 rounded-md text-sm font-semibold transition ${
                    duration === d ? 'bg-cyan-500 text-slate-900' : 'bg-slate-700 hover:bg-slate-600'
                  }`}
                >
                  {d} min
                </button>
              ))}
            </div>
          ) : (
             <div className="animate-fade-in">
                <input
                    id="duration"
                    type="number"
                    value={duration}
                    onChange={(e) => setDuration(parseInt(e.target.value, 10) || 0)}
                    placeholder="e.g., 15"
                    min="1"
                    className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-white placeholder-slate-400 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition"
                    required
                />
            </div>
          )}
        </div>
        
        <div className="grid grid-cols-2 gap-4">
            <div>
                 <label htmlFor="startDate" className="block text-sm font-medium text-slate-300 mb-2">Date</label>
                 <input
                    id="startDate"
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-white placeholder-slate-400 focus:ring-2 focus:ring-cyan-500"
                 />
            </div>
             <div>
                 <label htmlFor="startTime" className="block text-sm font-medium text-slate-300 mb-2">Time</label>
                 <input
                    id="startTime"
                    type="time"
                    value={startTime}
                    onChange={e => setStartTime(e.target.value)}
                    className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-white placeholder-slate-400 focus:ring-2 focus:ring-cyan-500"
                 />
            </div>
        </div>
        
        <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Repeat</label>
            <div className="grid grid-cols-4 gap-2">
                 {(['NONE', 'DAILY', 'WEEKLY', 'MONTHLY'] as const).map(freq => (
                    <button
                        key={freq}
                        type="button"
                        onClick={() => setRepeatFrequency(freq)}
                        className={`px-3 py-2 rounded-md text-sm font-semibold transition capitalize ${
                            repeatFrequency === freq ? 'bg-cyan-500 text-slate-900' : 'bg-slate-700 hover:bg-slate-600'
                        }`}
                    >
                        {freq.toLowerCase()}
                    </button>
                 ))}
            </div>
        </div>

        {repeatFrequency === 'WEEKLY' && (
             <div className="animate-fade-in">
                <label className="block text-sm font-medium text-slate-300 mb-2">On these days</label>
                <div className="flex justify-center gap-2">
                    {WEEK_DAYS.map((day, index) => (
                        <button
                            key={index}
                            type="button"
                            onClick={() => handleToggleRepeatDay(index)}
                            className={`w-10 h-10 rounded-full font-bold text-sm flex items-center justify-center transition ${
                                repeatOn.includes(index) ? 'bg-cyan-500 text-slate-900' : 'bg-slate-700 hover:bg-slate-600'
                            }`}
                        >{day}</button>
                    ))}
                </div>
            </div>
        )}

        {error && (
            <div className="p-3 bg-red-500/20 text-red-400 text-sm rounded-md text-center animate-fade-in">
                {error}
            </div>
        )}

        <div className="flex justify-end gap-4 pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-2 bg-slate-600 text-white rounded-md hover:bg-slate-500 transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-6 py-2 bg-cyan-600 text-white font-semibold rounded-md hover:bg-cyan-700 transition"
          >
            Add to Schedule
          </button>
        </div>
      </form>
    </div>
  );
};


import React, { useState, useCallback, useEffect, useRef } from 'react';
import { ScheduleItem, ScheduleItemType, SessionStatus, DeepWorkSession, ShallowWorkTask, GoalAnalysisResult } from '../types';
import { getPreSessionRitual, evaluateSMARTGoal, getSuggestedDuration, AIServiceError } from '../services/aiService';
import { SparklesIcon, CheckIcon } from './icons';
import { AppSettings } from '../services/settingsService';

interface SessionSchedulerProps {
  onAddItem: (item: ScheduleItem) => void;
  onCancel: () => void;
  schedule: ScheduleItem[];
  settings: AppSettings;
}

const WEEK_DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export const SessionScheduler: React.FC<SessionSchedulerProps> = ({ onAddItem, onCancel, schedule, settings }) => {
  const toLocalYYYYMMDD = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [taskName, setTaskName] = useState('');
  const [goal, setGoal] = useState('');
  const [duration, setDuration] = useState(90); // Default to a valid deep work duration
  const [ritual, setRitual] = useState<string[] | null>(null);
  const [isFetchingRitual, setIsFetchingRitual] = useState(false);
  const [itemType, setItemType] = useState<ScheduleItemType>(ScheduleItemType.DEEP_WORK);
  const [startDate, setStartDate] = useState(toLocalYYYYMMDD(new Date()));
  const [endDate, setEndDate] = useState('');
  const [startTime, setStartTime] = useState(() => {
      const now = new Date();
      now.setMinutes(now.getMinutes() + 15); // Default to 15 mins from now
      return now.toTimeString().slice(0, 5);
  });
  const [repeatFrequency, setRepeatFrequency] = useState<'ONCE' | 'DAILY' | 'WEEKLY' | 'MONTHLY'>('ONCE');
  const [repeatOn, setRepeatOn] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isAnalyzingGoal, setIsAnalyzingGoal] = useState(false);
  const [goalAnalysis, setGoalAnalysis] = useState<GoalAnalysisResult | null>(null);
  const [isFetchingDuration, setIsFetchingDuration] = useState(false);
  const [suggestedDuration, setSuggestedDuration] = useState<number | null>(null);
  const [aiNotification, setAiNotification] = useState<string | null>(null);
  const [aiAssistanceFetched, setAiAssistanceFetched] = useState(false);

  const debounceTimeoutRef = useRef<number | null>(null);

  const handleStatusUpdate = useCallback((status: string) => {
    setAiNotification(status);
    setTimeout(() => setAiNotification(null), 4000);
  }, []);

  const fetchAIAssistance = useCallback(async () => {
    if (!taskName || !goal || !process.env.API_KEY || itemType !== ScheduleItemType.DEEP_WORK) return;

    setIsFetchingRitual(true);
    setIsAnalyzingGoal(true);
    setIsFetchingDuration(true);
    setRitual(null);
    setGoalAnalysis(null);
    setSuggestedDuration(null);
    setAiAssistanceFetched(false);

    try {
      const [generatedRitual, analysisResult, durationSuggestion] = await Promise.all([
        getPreSessionRitual(taskName, goal, handleStatusUpdate),
        evaluateSMARTGoal(taskName, goal, handleStatusUpdate),
        getSuggestedDuration(taskName, goal, handleStatusUpdate),
      ]);

      setRitual(generatedRitual);
      setGoalAnalysis(analysisResult);
      setSuggestedDuration(durationSuggestion);
      setAiAssistanceFetched(true);
    } catch (error: any) {
      console.error("AI Assistance Error:", error);
      setError("AI assistance failed. Please try again later.");
      if (error instanceof AIServiceError) {
          // You could add more specific error handling here if needed
      }
    } finally {
      setIsFetchingRitual(false);
      setIsAnalyzingGoal(false);
      setIsFetchingDuration(false);
    }
  }, [taskName, goal, itemType, handleStatusUpdate]);

  useEffect(() => {
    if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
    
    const hasInput = taskName.trim().length > 3 && goal.trim().length > 10;
    
    if (hasInput && itemType === ScheduleItemType.DEEP_WORK) {
      debounceTimeoutRef.current = window.setTimeout(() => {
        fetchAIAssistance();
      }, 800);
    }

    return () => {
      if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
    };
  }, [taskName, goal, itemType, fetchAIAssistance]);

  
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
    if (itemType === ScheduleItemType.DEEP_WORK && !goal) {
        setError("A goal is required for Deep Work sessions.");
        return;
    }
    
    const newItemStart = new Date(`${startDate}T${startTime}`);

    // --- Settings Enforcement Validation ---
    
    // 1. Holiday Check
    const holiday = settings.holidays.find(h => startDate >= h.startDate && startDate <= h.endDate);
    if (holiday) {
        setError(`Cannot schedule on a holiday: "${holiday.description}".`);
        return;
    }

    // 2. Availability Day & Time Check
    const dayOfWeek = newItemStart.getDay();
    if (repeatFrequency === 'DAILY') {
        setError("Daily tasks are disabled as they would fall on non-working days. Please use a Weekly schedule and select your working days.");
        return;
    }

    if (repeatFrequency === 'WEEKLY') {
        if (repeatOn.length === 0) {
            setError("Please select at least one day for a weekly task.");
            return;
        }
        const nonWorkingDaySelected = repeatOn.some(day => !settings.availability.days.includes(day));
        if (nonWorkingDaySelected) {
            setError("A selected day is a non-working day. Please adjust your selection or availability settings.");
            return;
        }
    } else { // For ONCE and MONTHLY, check the specific start date
        if (!settings.availability.days.includes(dayOfWeek)) {
            const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek];
            setError(`${dayName} is a non-working day. Please pick a different date or adjust your availability settings.`);
            return;
        }
    }
    
    // 3. Time check
    const [startHour, startMinute] = settings.availability.startTime.split(':').map(Number);
    const [endHour, endMinute] = settings.availability.endTime.split(':').map(Number);
    const [selectedHour, selectedMinute] = startTime.split(':').map(Number);
    
    const scheduleStartTotalMinutes = startHour * 60 + startMinute;
    const scheduleEndTotalMinutes = endHour * 60 + endMinute;
    const selectedStartTotalMinutes = selectedHour * 60 + selectedMinute;
    
    if (selectedStartTotalMinutes < scheduleStartTotalMinutes || selectedStartTotalMinutes > scheduleEndTotalMinutes) {
        setError(`Start time is outside your working hours (${settings.availability.startTime} - ${settings.availability.endTime}).`);
        return;
    }
    
    if (selectedStartTotalMinutes + duration > scheduleEndTotalMinutes) {
        setError(`Session ends after your working hours (${settings.availability.endTime}). Please shorten the duration or start earlier.`);
        return;
    }

    // --- End Settings Validation ---
    
    if (newItemStart < new Date()) {
        setError("Cannot schedule tasks in the past. Please select a future date and time.");
        return;
    }
    
    if (endDate && new Date(endDate) < newItemStart) {
        setError("End date cannot be before the start date.");
        return;
    }
    
    const newItemEnd = new Date(newItemStart.getTime() + duration * 60 * 1000);

    // --- Conflict validation and suggestion logic ---
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
        
        if (item.repeatFrequency === 'ONCE' && itemDateOnly.getTime() !== newItemDateOnly.getTime()) {
          return false;
        }

        switch (item.repeatFrequency) {
            case 'ONCE':
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
        endDate: repeatFrequency !== 'ONCE' && endDate ? new Date(endDate).toISOString() : null,
        repeatFrequency,
        repeatOn: repeatFrequency === 'WEEKLY' ? repeatOn.sort((a,b) => a-b) : null,
        status: SessionStatus.PENDING,
        feedback: null,
        isCancelled: false,
        pauses: [],
    };

    if (itemType === ScheduleItemType.DEEP_WORK) {
      const newSession: DeepWorkSession = {
        ...baseItemData,
        type: ScheduleItemType.DEEP_WORK,
        goal,
        ritual,
        ritualChecklist: ritual ? ritual.map(text => ({ text, completed: false })) : null,
        workspaceImageUrl: null,
        wasCreatedWithAI: aiAssistanceFetched,
      };
      onAddItem(newSession);
    } else {
       const newShallowTask: ShallowWorkTask = {
        ...baseItemData,
        type: ScheduleItemType.SHALLOW_WORK,
      };
      onAddItem(newShallowTask);
    }
  };

  const handleItemTypeChange = (newItemType: ScheduleItemType) => {
    setItemType(newItemType);
    setRitual(null);
    setGoalAnalysis(null);
    setSuggestedDuration(null);
    setAiAssistanceFetched(false);
    if (newItemType === ScheduleItemType.DEEP_WORK) {
        setDuration(90); 
    } else {
        setDuration(15);
    }
  };

  return (
    <div className="p-6 bg-slate-800 rounded-lg shadow-lg w-full max-w-md mx-auto animate-fade-in-up">
      {aiNotification && (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-blue-500/80 backdrop-blur-sm text-white text-sm font-semibold px-4 py-2 rounded-full shadow-lg animate-fade-in-down z-50">
              {aiNotification}
          </div>
      )}
      <h2 className="text-2xl font-bold text-primary-accent mb-6">Schedule New Item</h2>
      <form onSubmit={handleSubmit} className="space-y-6">

        <div>
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-700 rounded-lg mb-6">
                <button type="button" onClick={() => handleItemTypeChange(ScheduleItemType.DEEP_WORK)} className={`px-3 py-2 rounded-md text-sm font-semibold transition ${itemType === ScheduleItemType.DEEP_WORK ? 'bg-green-500 text-slate-900' : 'bg-transparent hover:bg-slate-600/50'}`}>
                    Deep Work
                </button>
                 <button type="button" onClick={() => handleItemTypeChange(ScheduleItemType.SHALLOW_WORK)} className={`px-3 py-2 rounded-md text-sm font-semibold transition ${itemType === ScheduleItemType.SHALLOW_WORK ? 'bg-orange-500 text-white' : 'bg-transparent hover:bg-slate-600/50'}`}>
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
            placeholder={
                itemType === ScheduleItemType.DEEP_WORK ? "e.g., Write chapter 3 of novel" 
                : "e.g., Reply to team emails"
            }
            className={`w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-white placeholder-slate-400 focus:ring-2  transition ${itemType === ScheduleItemType.DEEP_WORK ? 'focus:ring-green-500 focus:border-green-500' : 'focus:ring-orange-500 focus:border-orange-500'}`}
            required
          />
        </div>
        
        {itemType === ScheduleItemType.DEEP_WORK && (
          <div className="animate-fade-in space-y-4">
            <div>
              <label htmlFor="goal" className="block text-sm font-medium text-slate-300 mb-2">
                Task Goal
              </label>
              <textarea
                id="goal"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="e.g., Complete a full draft of the introduction and first two paragraphs."
                className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-white placeholder-slate-400 focus:ring-2 focus:ring-green-500 focus:border-green-500 transition"
                rows={2}
                required
              />
            </div>
            
            {goalAnalysis && !isAnalyzingGoal && (
                <div className={`p-3 rounded-lg text-sm animate-fade-in-up ${goalAnalysis.isSMART ? 'bg-green-500/10 text-green-300' : 'bg-yellow-500/10'}`}>
                    <p className={`${goalAnalysis.isSMART ? '' : 'text-yellow-300'}`}>
                        <strong>Feedback:</strong> {goalAnalysis.feedback}
                    </p>
                    {goalAnalysis.suggestion && (
                        <div className="mt-3 bg-slate-900/30 p-3 rounded-md">
                            <p className="font-semibold text-yellow-200">Suggestion:</p>
                            <p className="text-yellow-300 italic">"{goalAnalysis.suggestion}"</p>
                             <div className="flex gap-2 mt-3">
                                <button type="button" onClick={() => { setGoal(goalAnalysis.suggestion || goal); setGoalAnalysis(null); }} className="text-xs bg-yellow-600/50 hover:bg-yellow-600/80 text-white font-semibold px-3 py-1 rounded-md">
                                    Use Suggestion
                                </button>
                                <button type="button" onClick={() => setGoalAnalysis(null)} className="text-xs bg-slate-600/50 hover:bg-slate-600/80 text-slate-300 px-3 py-1 rounded-md">
                                    Keep Mine
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
          </div>
        )}

        {itemType === ScheduleItemType.DEEP_WORK && ritual && !isFetchingRitual && (
            <div className="animate-fade-in-up space-y-4">
                <div className="p-4 bg-slate-700/50 rounded-lg space-y-2">
                    <h4 className="font-semibold text-green-400">Your AI-Generated Ritual:</h4>
                    <ul className="list-none space-y-2">
                        {ritual.map((step, index) => (
                            <li key={index} className="flex items-start gap-3 text-slate-300">
                            <CheckIcon className="w-5 h-5 text-green-400 mt-1 flex-shrink-0" />
                            <span>{step}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        )}


        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2 flex items-center gap-2">
            Duration (minutes)
            {isFetchingDuration && itemType === ScheduleItemType.DEEP_WORK && (
                <SparklesIcon className="w-4 h-4 text-green-400 animate-spin" />
            )}
          </label>
          {itemType === ScheduleItemType.DEEP_WORK ? (
            <div className="space-y-3 animate-fade-in">
                <div className="grid grid-cols-3 gap-2">
                  {[60, 90, 120].map(d => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDuration(d)}
                      className={`px-3 py-2 rounded-md text-sm font-semibold transition ${
                        duration === d ? 'bg-green-500 text-slate-900' : 'bg-slate-700 hover:bg-slate-600'
                      }`}
                    >
                      {d} min
                    </button>
                  ))}
                </div>
                 {suggestedDuration && !isFetchingDuration && (
                    <div className="p-2 bg-slate-700/50 rounded-lg text-center text-sm animate-fade-in-up">
                      <span className="text-slate-300">
                        ✨ AI Suggestion: <strong className="text-green-400">{suggestedDuration} min</strong>
                      </span>
                      <button
                        type="button"
                        onClick={() => setDuration(suggestedDuration)}
                        className="ml-3 text-xs bg-green-600/50 hover:bg-green-600/80 text-white font-semibold px-3 py-1 rounded-md"
                      >
                        Apply
                      </button>
                    </div>
                )}
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
                    className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-white placeholder-slate-400 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition"
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
                    min={toLocalYYYYMMDD(new Date())}
                    className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-white placeholder-slate-400 focus:ring-2 focus:ring-primary-accent"
                 />
            </div>
             <div>
                 <label htmlFor="startTime" className="block text-sm font-medium text-slate-300 mb-2">Time</label>
                 <input
                    id="startTime"
                    type="time"
                    value={startTime}
                    onChange={e => setStartTime(e.target.value)}
                    className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-white placeholder-slate-400 focus:ring-2 focus:ring-primary-accent"
                 />
            </div>
        </div>
        
        <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Repeat</label>
            <div className="grid grid-cols-4 gap-2">
                 {(['ONCE', 'DAILY', 'WEEKLY', 'MONTHLY'] as const).map(freq => (
                    <button
                        key={freq}
                        type="button"
                        onClick={() => setRepeatFrequency(freq)}
                        className={`px-3 py-2 rounded-md text-sm font-semibold transition capitalize ${
                            repeatFrequency === freq ? 'bg-primary text-slate-900' : 'bg-transparent hover:bg-slate-700'
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
                                repeatOn.includes(index) ? 'bg-primary text-slate-900' : 'bg-slate-700 hover:bg-slate-600'
                            }`}
                        >{day}</button>
                    ))}
                </div>
            </div>
        )}
        
        {repeatFrequency !== 'ONCE' && (
             <div className="animate-fade-in">
                 <label htmlFor="endDate" className="block text-sm font-medium text-slate-300 mb-2">End Date (optional)</label>
                 <input
                    id="endDate"
                    type="date"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    min={startDate}
                    className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-white placeholder-slate-400 focus:ring-2 focus:ring-primary-accent"
                 />
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
            className="px-6 py-2 bg-primary text-white font-semibold rounded-md hover:bg-primary-focus transition"
          >
            Add to Schedule
          </button>
        </div>
      </form>
    </div>
  );
};

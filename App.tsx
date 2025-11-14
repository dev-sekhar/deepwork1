
import React, { useState, useCallback, useMemo } from 'react';
import { ScheduleItem, ScheduleItemType, SessionStatus, Feedback, DeepWorkSession, CompletionRecord } from './types';
import { SessionScheduler } from './components/SessionScheduler';
import { FocusView } from './components/FocusView';
import { FeedbackModal } from './components/FeedbackModal';
import { PreSessionChecklist } from './components/PreSessionChecklist';
import { TaskReviewModal } from './components/TaskReviewModal';
import { PlusIcon, ChartBarIcon, CalendarIcon } from './components/icons';
import { AnalyticsView } from './components/analytics/AnalyticsView';
import { HistoryView } from './components/HistoryView';
import { PauseTaskModal } from './components/PauseTaskModal';

type AppView = 'DASHBOARD' | 'SCHEDULING' | 'FOCUS' | 'PRE_SESSION_CHECKLIST' | 'ANALYTICS' | 'HISTORY';
type ScheduleView = 'TODAY' | 'ONCE' | 'DAILY' | 'WEEKLY' | 'MONTHLY';

// A helper to get YYYY-MM-DD from a Date object in the local timezone.
const toLocalYYYYMMDD = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const scheduleViewOptions: { name: string; value: ScheduleView }[] = [
    { name: 'Today', value: 'TODAY' },
    { name: 'Once', value: 'ONCE' },
    { name: 'Daily', value: 'DAILY' },
    { name: 'Weekly', value: 'WEEKLY' },
    { name: 'Monthly', value: 'MONTHLY' },
];


const Header = () => (
    <header className="p-4 text-center">
        <h1 className="text-3xl font-bold text-cyan-400 tracking-wider">Deep Work</h1>
        <p className="text-slate-400">Your assistant for sustained focus.</p>
    </header>
);

const RepeatIcon: React.FC<{className?: string}> = ({className}) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0011.664 0l3.181-3.183m-11.664 0l3.181-3.183a8.25 8.25 0 00-11.664 0l3.181 3.183" />
    </svg>
);

const getNextExecutionInfo = (item: ScheduleItem): string => {
    const now = new Date();
    const itemStartDate = new Date(item.startDate);
    const itemTime = itemStartDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

    const todayAtItemTime = new Date();
    todayAtItemTime.setHours(itemStartDate.getHours(), itemStartDate.getMinutes(), 0, 0);

    switch (item.repeatFrequency) {
        case 'DAILY':
            if (todayAtItemTime > now) {
                return `Today at ${itemTime}`;
            } else {
                return `Tomorrow at ${itemTime}`;
            }
        case 'WEEKLY': {
            const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            const repeatOn = item.repeatOn?.sort((a, b) => a - b) || [];
            if (repeatOn.length === 0) return '';
            
            const currentDay = now.getDay();

            if (repeatOn.includes(currentDay) && todayAtItemTime > now) {
                return `Today at ${itemTime}`;
            }

            const nextDayThisWeek = repeatOn.find(day => day > currentDay);
            if (nextDayThisWeek !== undefined) {
                return `${weekDays[nextDayThisWeek]} at ${itemTime}`;
            }

            return `${weekDays[repeatOn[0]]} at ${itemTime}`;
        }
        case 'MONTHLY': {
            const dayOfMonth = itemStartDate.getDate();
            const todayDate = now.getDate();
            const currentMonthName = now.toLocaleString('default', { month: 'short' });
            
            const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, dayOfMonth);
            const nextMonthName = nextMonthDate.toLocaleString('default', { month: 'short' });

            if (dayOfMonth > todayDate) {
                return `${currentMonthName} ${dayOfMonth} at ${itemTime}`;
            } else if (dayOfMonth === todayDate && todayAtItemTime > now) {
                return `Today at ${itemTime}`;
            } else {
                 return `${nextMonthName} ${dayOfMonth} at ${itemTime}`;
            }
        }
        default:
            return '';
    }
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

const getTypeText = (type: ScheduleItemType) => {
    switch (type) {
        case ScheduleItemType.DEEP_WORK: return 'DEEP';
        case ScheduleItemType.SHALLOW_WORK: return 'SHALLOW';
        case ScheduleItemType.AI_ASSISTED_WORK: return 'AI ASSISTED';
        default: return 'TASK';
    }
}

interface ScheduleListItemProps {
    item: ScheduleItem;
    displayDate?: Date;
    onStart?: (id: string) => void;
    onReview?: (id: string, date: Date) => void;
    onDelete?: (id: string) => void;
    onPause?: (id: string) => void;
    onUnpause?: (id: string) => void;
    scheduleView: ScheduleView | 'HISTORY';
    isActionable: boolean;
}

const ScheduleListItem: React.FC<ScheduleListItemProps> = ({ item, displayDate, onStart, onReview, onDelete, onPause, onUnpause, scheduleView, isActionable }) => {
    const itemDate = new Date(item.startDate);
    const timeString = itemDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    const dateString = itemDate.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

    const typeStyleClasses = getTypeStyles(item.type);
    const textColorClass = typeStyleClasses.split(' ').find(c => c.startsWith('text-'));

    const lastPause = item.pauses && item.pauses.length > 0 ? item.pauses[item.pauses.length - 1] : null;
    const isCurrentlyPaused = lastPause ? new Date() >= new Date(lastPause.startDate) && new Date() <= new Date(lastPause.endDate) : false;
    
    const isCompleted = useMemo(() => {
        if (!displayDate || !item.completions) return false;
        const displayDateStr = toLocalYYYYMMDD(displayDate);
        return item.completions.some(c => c.date === displayDateStr);
    }, [item.completions, displayDate]);

    const effectiveStatus = isCompleted ? SessionStatus.COMPLETED : item.status;

    return (
        <div className="bg-slate-800 p-4 rounded-lg flex items-start justify-between shadow-md hover:bg-slate-700/50 transition-colors duration-300">
            <div className="flex items-center gap-4 min-w-0">
                 <div className="text-center w-24 flex-shrink-0">
                    <p className={`text-lg font-mono ${textColorClass}`}>{timeString}</p>
                    {scheduleView === 'ONCE' && (
                        <p className="text-xs text-slate-400 mt-1">{dateString}</p>
                    )}
                </div>
                 <div className="min-w-0">
                     <div className="flex items-center gap-3 flex-wrap">
                        <h3 className={`font-semibold text-lg truncate ${textColorClass}`} title={item.taskName}>{item.taskName}</h3>
                        {effectiveStatus === SessionStatus.COMPLETED && (
                            <span className="text-xs font-semibold px-2 py-0.5 bg-green-500/20 text-green-400 rounded-full flex-shrink-0">Completed</span>
                        )}
                         {(effectiveStatus === SessionStatus.PENDING && scheduleView === 'HISTORY') && (
                            <span className="text-xs font-semibold px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded-full flex-shrink-0">Pending</span>
                        )}
                        {isCurrentlyPaused && (
                            <span className="text-xs font-semibold px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded-full flex-shrink-0">Paused</span>
                        )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-slate-400 mt-1">
                         {/* Tag is now only shown on the 'Once' view */}
                        {scheduleView === 'ONCE' && (
                           <span className={`text-xs font-bold px-2 py-1 rounded-full ${typeStyleClasses}`}>
                                {getTypeText(item.type)}
                            </span>
                        )}
                        <p>{item.durationMinutes} min</p>
                        {item.repeatFrequency !== 'ONCE' && (
                            <div className="flex items-center gap-2 text-slate-500">
                                <RepeatIcon className="w-4 h-4" />
                                {scheduleView !== 'TODAY' && scheduleView !== 'HISTORY' && (
                                    <p className="text-sm">{getNextExecutionInfo(item)}</p>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
            <div className="flex flex-col items-end gap-2 flex-shrink-0 ml-2">
                {effectiveStatus === SessionStatus.COMPLETED && onReview && displayDate && (
                     <button onClick={() => onReview(item.id, displayDate)} className="bg-slate-600 text-white font-bold py-1 px-3 text-sm rounded-md hover:bg-slate-500 transition w-full text-center">
                        Review
                    </button>
                )}
                {effectiveStatus === SessionStatus.PENDING && isActionable && (
                    <>
                        {/* START button shown for Today and One-Time tasks */}
                        {(scheduleView === 'TODAY' || scheduleView === 'ONCE') && onStart && (
                            <button onClick={() => onStart(item.id)} className="bg-green-500 text-white font-bold py-1 px-3 text-sm rounded-md hover:bg-green-600 transition w-full text-center">
                                Start
                            </button>
                        )}
                        
                        {/* PAUSE/DELETE container for recurring and one-time tasks (but not Today) */}
                        {(scheduleView !== 'TODAY' && scheduleView !== 'HISTORY') && (
                            <div className="flex gap-2">
                                {/* PAUSE button only for recurring tasks */}
                                {item.repeatFrequency !== 'ONCE' && (
                                    isCurrentlyPaused ? (
                                        onUnpause && <button onClick={() => onUnpause(item.id)} className="bg-blue-500 text-white font-semibold text-xs py-1 px-2 rounded hover:bg-blue-600 transition">Unpause</button>
                                    ) : (
                                        onPause && <button onClick={() => onPause(item.id)} className="bg-slate-600 text-white font-semibold text-xs py-1 px-2 rounded hover:bg-slate-500 transition">Pause</button>
                                    )
                                )}
                                {/* DELETE button for One-time and recurring views */}
                                {onDelete && <button onClick={() => onDelete(item.id)} className="bg-red-800 text-white font-semibold text-xs py-1 px-2 rounded hover:bg-red-700 transition">Delete</button>}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export const getTasksForDate = (schedule: ScheduleItem[], date: Date): ScheduleItem[] => {
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);

    const dayOfWeek = checkDate.getDay();
    const dayOfMonth = checkDate.getDate();
    
    const tasks = schedule.filter(item => {
        // Filter out logically deleted (cancelled) one-time tasks
        if (item.isCancelled) {
            return false;
        }

        const itemStartDate = new Date(item.startDate);
        itemStartDate.setHours(0, 0, 0, 0);
        
        // Filter out recurring tasks that have ended
        if (item.endDate) {
            const itemEndDate = new Date(item.endDate);
            itemEndDate.setHours(0,0,0,0);
            if (checkDate > itemEndDate) {
                return false;
            }
        }
        
        // Filter out tasks that are paused on this date
        if (item.pauses && item.pauses.length > 0) {
            const isPaused = item.pauses.some(pause => {
                const pauseStart = new Date(pause.startDate);
                pauseStart.setHours(0,0,0,0);
                const pauseEnd = new Date(pause.endDate);
                pauseEnd.setHours(0,0,0,0);
                return checkDate >= pauseStart && checkDate <= pauseEnd;
            });
            if (isPaused) {
                return false;
            }
        }

        if (item.repeatFrequency === 'ONCE') {
            return itemStartDate.getTime() === checkDate.getTime();
        }

        // Don't show recurring tasks before their official start date
        if (itemStartDate.getTime() > checkDate.getTime()) {
            return false;
        }

        switch (item.repeatFrequency) {
            case 'DAILY':
                return true;
            case 'WEEKLY':
                return item.repeatOn?.includes(dayOfWeek) ?? false;
            case 'MONTHLY':
                return new Date(item.startDate).getDate() === dayOfMonth;
            default:
                return false;
        }
    });

    return tasks.sort((a, b) => {
        const timeA = new Date(a.startDate).getHours() * 60 + new Date(a.startDate).getMinutes();
        const timeB = new Date(b.startDate).getHours() * 60 + new Date(b.startDate).getMinutes();
        return timeA - timeB;
    });
};


const App: React.FC = () => {
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [currentView, setCurrentView] = useState<AppView>('DASHBOARD');
  const [scheduleView, setScheduleView] = useState<ScheduleView>('TODAY');
  const [activeSession, setActiveSession] = useState<ScheduleItem | null>(null);
  const [sessionForFeedback, setSessionForFeedback] = useState<{item: ScheduleItem, date: Date} | null>(null);
  const [taskForReview, setTaskForReview] = useState<{item: ScheduleItem, date: Date} | null>(null);
  const [taskToPause, setTaskToPause] = useState<ScheduleItem | null>(null);

  const handleAddItem = useCallback((item: ScheduleItem) => {
    setSchedule(prev => [...prev, item]);
    setCurrentView('DASHBOARD');
  }, []);

  const handleStartSession = useCallback((sessionId: string) => {
    const sessionToStart = schedule.find(s => s.id === sessionId);
    if (sessionToStart) {
        setActiveSession(sessionToStart);
        if (sessionToStart.type === ScheduleItemType.DEEP_WORK) {
            setCurrentView('PRE_SESSION_CHECKLIST');
        } else {
            setCurrentView('FOCUS');
        }
    }
  }, [schedule]);

   const handleReviewTask = useCallback((itemId: string, date: Date) => {
      const itemToReview = schedule.find(s => s.id === itemId);
      if(itemToReview) {
          setTaskForReview({ item: itemToReview, date });
      }
  }, [schedule]);
  
  const handleDeleteItem = useCallback((itemId: string) => {
      setSchedule(prev => prev.map(item => {
          if (item.id === itemId) {
              if (item.repeatFrequency === 'ONCE') {
                  return { ...item, isCancelled: true };
              } else {
                  // For recurring tasks, set end date to today to stop future occurrences
                  return { ...item, endDate: new Date().toISOString() };
              }
          }
          return item;
      }));
  }, []);

  const handlePauseItem = useCallback((itemId: string) => {
      const itemToPause = schedule.find(s => s.id === itemId);
      if (itemToPause) {
          setTaskToPause(itemToPause);
      }
  }, [schedule]);
  
  const handleUnpauseItem = useCallback((itemId: string) => {
      setSchedule(prev => prev.map(item => {
          if (item.id === itemId && item.pauses && item.pauses.length > 0) {
              const newPauses = [...item.pauses];
              const lastPause = newPauses[newPauses.length - 1];
              // End the pause effective immediately, if it was supposed to end in the future
              if (new Date(lastPause.endDate) > new Date()) {
                  lastPause.endDate = new Date().toISOString();
              }
              return { ...item, pauses: newPauses };
          }
          return item;
      }));
  }, []);
  
  const handlePauseSubmit = useCallback((pauseData: { startDate: string; endDate: string; reason: string }) => {
      if (taskToPause) {
          setSchedule(prev => prev.map(item => {
              if (item.id === taskToPause.id) {
                  const newPauses = [...(item.pauses || []), pauseData];
                  return { ...item, pauses: newPauses };
              }
              return item;
          }));
          setTaskToPause(null);
      }
  }, [taskToPause]);


  const handleUpdateActiveSession = useCallback((updatedSession: ScheduleItem) => {
      setActiveSession(updatedSession);
      setSchedule(prev => prev.map(s => s.id === updatedSession.id ? updatedSession : s));
  }, []);

  const handleChecklistComplete = useCallback(() => {
    if (activeSession) {
      setCurrentView('FOCUS');
    }
  }, [activeSession]);

  const handleSessionComplete = useCallback(() => {
    if (activeSession) {
      setSessionForFeedback({ item: activeSession, date: new Date() });
      setActiveSession(null);
      setCurrentView('DASHBOARD');
    }
  }, [activeSession]);

  const handleFeedbackSubmit = useCallback((feedback: Feedback) => {
    if (sessionForFeedback) {
        const { item: completedItem, date: completionDate } = sessionForFeedback;
        const completionDateStr = toLocalYYYYMMDD(completionDate);

        setSchedule(prev => prev.map(s => {
            if (s.id === completedItem.id) {
                const newCompletion: CompletionRecord = { date: completionDateStr, feedback };
                const updatedCompletions = [...(s.completions || []), newCompletion];

                // For one-time tasks, also update the main status
                if (s.repeatFrequency === 'ONCE') {
                    return { ...s, completions: updatedCompletions, status: SessionStatus.COMPLETED };
                } else {
                    // For recurring tasks, just add the completion record
                    return { ...s, completions: updatedCompletions };
                }
            }
            return s;
        }));
        setSessionForFeedback(null);
    }
  }, [sessionForFeedback]);
  
  const handleBackToDashboard = useCallback(() => {
      setActiveSession(null);
      setCurrentView('DASHBOARD');
  }, []);
  
  const todaysSchedule = useMemo(() => {
    const today = new Date();
    return getTasksForDate(schedule, today);
  }, [schedule]);

  const oneTimeSchedule = useMemo(() => {
    return schedule
        .filter(item => item.repeatFrequency === 'ONCE' && !item.isCancelled)
        .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  }, [schedule]);

  const recurringSchedules = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    return schedule.filter(item => 
        item.repeatFrequency !== 'ONCE' && 
        (!item.endDate || new Date(item.endDate) >= now)
    );
  }, [schedule]);

  const dailySchedule = useMemo(() => {
    return recurringSchedules.filter(item => item.repeatFrequency === 'DAILY')
      .sort((a, b) => {
        const timeA = new Date(a.startDate).getHours() * 60 + new Date(a.startDate).getMinutes();
        const timeB = new Date(b.startDate).getHours() * 60 + new Date(b.startDate).getMinutes();
        return timeA - timeB;
      });
  }, [recurringSchedules]);

  const weeklySchedule = useMemo(() => {
    return recurringSchedules.filter(item => item.repeatFrequency === 'WEEKLY')
      .sort((a, b) => {
        const timeA = new Date(a.startDate).getHours() * 60 + new Date(a.startDate).getMinutes();
        const timeB = new Date(b.startDate).getHours() * 60 + new Date(b.startDate).getMinutes();
        return timeA - timeB;
      });
  }, [recurringSchedules]);

  const monthlySchedule = useMemo(() => {
    return recurringSchedules.filter(item => item.repeatFrequency === 'MONTHLY')
      .sort((a, b) => {
        const timeA = new Date(a.startDate).getHours() * 60 + new Date(a.startDate).getMinutes();
        const timeB = new Date(b.startDate).getHours() * 60 + new Date(b.startDate).getMinutes();
        return timeA - timeB;
      });
  }, [recurringSchedules]);


  const renderView = () => {
    switch (currentView) {
      case 'SCHEDULING':
        return <SessionScheduler onAddItem={handleAddItem} onCancel={() => setCurrentView('DASHBOARD')} schedule={schedule} />;
      case 'PRE_SESSION_CHECKLIST':
        return activeSession && activeSession.type === ScheduleItemType.DEEP_WORK ? <PreSessionChecklist session={activeSession} onUpdateSession={handleUpdateActiveSession} onStartFocus={handleChecklistComplete} onBack={handleBackToDashboard} /> : null;
      case 'FOCUS':
        return activeSession ? <FocusView session={activeSession} onComplete={handleSessionComplete} onBack={handleBackToDashboard} /> : null;
      case 'ANALYTICS':
        return <AnalyticsView schedule={schedule} onBack={() => setCurrentView('DASHBOARD')} />;
      case 'HISTORY':
        return <HistoryView schedule={schedule} onBack={() => setCurrentView('DASHBOARD')} onReview={handleReviewTask} ListItem={ScheduleListItem} />;
      case 'DASHBOARD':
      default:
        const renderScheduleList = (items: ScheduleItem[], displayDateFunc?: (item: ScheduleItem) => Date) => {
            return items.map(item => (
                <ScheduleListItem 
                    key={item.id} 
                    item={item} 
                    displayDate={displayDateFunc ? displayDateFunc(item) : undefined}
                    onStart={handleStartSession} 
                    onReview={handleReviewTask} 
                    onDelete={handleDeleteItem}
                    onPause={handlePauseItem}
                    onUnpause={handleUnpauseItem}
                    scheduleView={scheduleView} 
                    isActionable={true} 
                />
            ));
        };
      
        return (
          <div className="w-full max-w-2xl mx-auto space-y-6 p-4">
            <div className="grid grid-cols-3 gap-4">
                <button
                onClick={() => setCurrentView('SCHEDULING')}
                className="w-full flex items-center justify-center gap-2 bg-cyan-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-cyan-700 transition shadow-lg"
                >
                <PlusIcon className="w-6 h-6" />
                Schedule
                </button>
                 <button
                onClick={() => setCurrentView('ANALYTICS')}
                className="w-full flex items-center justify-center gap-2 bg-slate-700 text-white font-bold py-3 px-4 rounded-lg hover:bg-slate-600 transition shadow-lg"
                >
                <ChartBarIcon className="w-6 h-6" />
                Analytics
                </button>
                 <button
                onClick={() => setCurrentView('HISTORY')}
                className="w-full flex items-center justify-center gap-2 bg-slate-700 text-white font-bold py-3 px-4 rounded-lg hover:bg-slate-600 transition shadow-lg"
                >
                <CalendarIcon className="w-6 h-6" />
                History
                </button>
            </div>
            
            <div className="grid grid-cols-5 gap-2 p-1 bg-slate-800 rounded-lg">
                {scheduleViewOptions.map(({name, value}) => (
                    <button key={value} onClick={() => setScheduleView(value)} className={`px-3 py-2 rounded-md text-sm font-semibold transition capitalize ${scheduleView === value ? 'bg-cyan-500 text-slate-900' : 'bg-transparent hover:bg-slate-700'}`}>
                        {name}
                    </button>
                ))}
            </div>

            <div className="space-y-4">
                {scheduleView === 'TODAY' && (
                    <>
                        <h2 className="text-xl font-semibold text-slate-300 border-b border-slate-700 pb-2">Today's Plan</h2>
                        {todaysSchedule.length === 0 ? (
                            <p className="text-center text-slate-400 py-8">No items scheduled for today.</p>
                        ) : (
                            todaysSchedule.map(item => (
                                <ScheduleListItem key={item.id} item={item} displayDate={new Date()} onStart={handleStartSession} onReview={handleReviewTask} onDelete={handleDeleteItem} onPause={handlePauseItem} onUnpause={handleUnpauseItem} scheduleView={scheduleView} isActionable={true} />
                            ))
                        )}
                    </>
                )}
                 {scheduleView === 'ONCE' && (
                    <>
                        <h2 className="text-xl font-semibold text-slate-300 border-b border-slate-700 pb-2">One-Time Tasks</h2>
                        {oneTimeSchedule.length === 0 ? (
                            <p className="text-center text-slate-400 py-8">No one-time tasks scheduled.</p>
                        ) : (
                            renderScheduleList(oneTimeSchedule, item => new Date(item.startDate))
                        )}
                    </>
                )}
                 {scheduleView === 'DAILY' && (
                    <>
                        <h2 className="text-xl font-semibold text-slate-300 border-b border-slate-700 pb-2">Daily Tasks</h2>
                        {dailySchedule.length === 0 ? (
                            <p className="text-center text-slate-400 py-8">No daily tasks scheduled.</p>
                        ) : (
                            renderScheduleList(dailySchedule)
                        )}
                    </>
                 )}
                 {scheduleView === 'WEEKLY' && (
                    <>
                        <h2 className="text-xl font-semibold text-slate-300 border-b border-slate-700 pb-2">Weekly Tasks</h2>
                         {weeklySchedule.length === 0 ? (
                            <p className="text-center text-slate-400 py-8">No weekly tasks scheduled.</p>
                        ) : (
                            renderScheduleList(weeklySchedule)
                        )}
                    </>
                 )}
                 {scheduleView === 'MONTHLY' && 
                    <>
                        <h2 className="text-xl font-semibold text-slate-300 border-b border-slate-700 pb-2">Monthly Tasks</h2>
                        {monthlySchedule.length === 0 ? (
                            <p className="text-center text-slate-400 py-8">No monthly tasks scheduled.</p>
                        ) : (
                            renderScheduleList(monthlySchedule)
                        )}
                    </>
                 }
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white font-sans flex flex-col">
      <Header />
      <main className="flex-grow flex justify-center items-start py-4">
        {renderView()}
      </main>
      {sessionForFeedback && (
        <FeedbackModal 
            sessionName={sessionForFeedback.item.taskName} 
            onSubmit={handleFeedbackSubmit} 
        />
      )}
      {taskForReview && (
        <TaskReviewModal item={taskForReview.item} reviewDate={taskForReview.date} onClose={() => setTaskForReview(null)} />
      )}
      {taskToPause && (
        <PauseTaskModal
            taskName={taskToPause.taskName}
            onClose={() => setTaskToPause(null)}
            onSubmit={handlePauseSubmit}
        />
      )}
      <style>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fade-in-down {
          from { opacity: 0; transform: translateY(-20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
        .animate-fade-in-up { animation: fade-in-up 0.4s ease-out forwards; }
        .animate-fade-in-down { animation: fade-in-down 0.4s ease-out forwards; }
        input[type="date"]::-webkit-calendar-picker-indicator {
            filter: invert(1);
        }
      `}</style>
    </div>
  );
};

export default App;

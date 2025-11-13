
import React, { useState, useCallback, useMemo } from 'react';
import { ScheduleItem, ScheduleItemType, SessionStatus, Feedback, DeepWorkSession } from './types';
import { SessionScheduler } from './components/SessionScheduler';
import { FocusView } from './components/FocusView';
import { FeedbackModal } from './components/FeedbackModal';
import { PreSessionChecklist } from './components/PreSessionChecklist';
import { TaskReviewModal } from './components/TaskReviewModal';
import { PlusIcon } from './components/icons';

type AppView = 'DASHBOARD' | 'SCHEDULING' | 'FOCUS' | 'PRE_SESSION_CHECKLIST';
type ScheduleView = 'TODAY' | 'DAILY' | 'WEEKLY' | 'MONTHLY';

const scheduleViewOptions: { name: string; value: ScheduleView }[] = [
    { name: 'Today', value: 'TODAY' },
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


const ScheduleListItem: React.FC<{
    item: ScheduleItem;
    onStart: (id: string) => void;
    onReview: (id: string) => void;
    scheduleView: ScheduleView;
}> = ({ item, onStart, onReview, scheduleView }) => {
    const startTime = new Date(item.startDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

    return (
        <div className="bg-slate-800 p-4 rounded-lg flex items-center justify-between shadow-md hover:bg-slate-700/50 transition-colors duration-300">
            <div className="flex items-center gap-4">
                 <p className="text-lg font-mono text-cyan-400">{startTime}</p>
                 <div>
                    <h3 className="font-semibold text-lg text-white">{item.taskName}</h3>
                    <div className="flex items-center gap-4 text-sm text-slate-400">
                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${item.type === ScheduleItemType.DEEP_WORK ? 'text-cyan-400 bg-cyan-900/50' : 'text-indigo-400 bg-indigo-900/50'}`}>
                            {item.type === ScheduleItemType.DEEP_WORK ? 'DEEP' : 'SHALLOW'}
                        </span>
                        <p>{item.durationMinutes} min</p>
                        {item.repeatFrequency !== 'ONCE' && (
                            <div className="flex items-center gap-2 text-slate-500">
                                <RepeatIcon className="w-4 h-4" />
                                {scheduleView !== 'TODAY' && (
                                    <p className="text-sm">{getNextExecutionInfo(item)}</p>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
            {item.status === SessionStatus.PENDING && (
                <button onClick={() => onStart(item.id)} className="bg-green-500 text-white font-bold py-2 px-4 rounded-md hover:bg-green-600 transition">
                    Start
                </button>
            )}
            {item.status === SessionStatus.COMPLETED && (
                 <button onClick={() => onReview(item.id)} className="bg-slate-600 text-white font-bold py-2 px-4 rounded-md hover:bg-slate-500 transition">
                    Review
                </button>
            )}
        </div>
    );
};

const getTasksForDate = (schedule: ScheduleItem[], date: Date): ScheduleItem[] => {
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);

    const dayOfWeek = checkDate.getDay();
    const dayOfMonth = checkDate.getDate();
    
    const tasks = schedule.filter(item => {
        const itemStartDate = new Date(item.startDate);
        itemStartDate.setHours(0, 0, 0, 0);

        if (item.repeatFrequency === 'ONCE') {
            return itemStartDate.getTime() === checkDate.getTime();
        }

        if (itemStartDate.getTime() > checkDate.getTime()) {
            return false;
        }

        switch (item.repeatFrequency) {
            case 'DAILY':
                return true;
            case 'WEEKLY':
                return item.repeatOn?.includes(dayOfWeek) ?? false;
            case 'MONTHLY':
                return itemStartDate.getDate() === dayOfMonth;
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
  const [sessionForFeedback, setSessionForFeedback] = useState<ScheduleItem | null>(null);
  const [taskForReview, setTaskForReview] = useState<ScheduleItem | null>(null);

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
            setCurrentView('FOCUS'); // Shallow work goes straight to focus
        }
    }
  }, [schedule]);

   const handleReviewTask = useCallback((itemId: string) => {
      const itemToReview = schedule.find(s => s.id === itemId);
      if(itemToReview) {
          setTaskForReview(itemToReview);
      }
  }, [schedule]);

  const handleUpdateActiveSession = useCallback((updatedSession: DeepWorkSession) => {
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
      setSessionForFeedback(activeSession);
      setActiveSession(null);
      setCurrentView('DASHBOARD');
    }
  }, [activeSession]);

  const handleFeedbackSubmit = useCallback((feedback: Feedback) => {
    if (sessionForFeedback) {
      setSchedule(prev => prev.map(s => 
        s.id === sessionForFeedback.id 
        ? { ...s, status: SessionStatus.COMPLETED, feedback } 
        : s
      ));
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

  const dailySchedule = useMemo(() => {
    return schedule.filter(item => item.repeatFrequency === 'DAILY')
      .sort((a, b) => {
        const timeA = new Date(a.startDate).getHours() * 60 + new Date(a.startDate).getMinutes();
        const timeB = new Date(b.startDate).getHours() * 60 + new Date(b.startDate).getMinutes();
        return timeA - timeB;
      });
  }, [schedule]);

  const weeklySchedule = useMemo(() => {
    return schedule.filter(item => item.repeatFrequency === 'WEEKLY')
      .sort((a, b) => {
        const timeA = new Date(a.startDate).getHours() * 60 + new Date(a.startDate).getMinutes();
        const timeB = new Date(b.startDate).getHours() * 60 + new Date(b.startDate).getMinutes();
        return timeA - timeB;
      });
  }, [schedule]);

  const monthlySchedule = useMemo(() => {
    return schedule.filter(item => item.repeatFrequency === 'MONTHLY')
      .sort((a, b) => {
        const timeA = new Date(a.startDate).getHours() * 60 + new Date(a.startDate).getMinutes();
        const timeB = new Date(b.startDate).getHours() * 60 + new Date(b.startDate).getMinutes();
        return timeA - timeB;
      });
  }, [schedule]);


  const renderView = () => {
    switch (currentView) {
      case 'SCHEDULING':
        return <SessionScheduler onAddItem={handleAddItem} onCancel={() => setCurrentView('DASHBOARD')} schedule={schedule} />;
      case 'PRE_SESSION_CHECKLIST':
        return activeSession && activeSession.type === ScheduleItemType.DEEP_WORK ? <PreSessionChecklist session={activeSession} onUpdateSession={handleUpdateActiveSession} onStartFocus={handleChecklistComplete} onBack={handleBackToDashboard} /> : null;
      case 'FOCUS':
        return activeSession ? <FocusView session={activeSession} onComplete={handleSessionComplete} onBack={handleBackToDashboard} /> : null;
      case 'DASHBOARD':
      default:
        return (
          <div className="w-full max-w-2xl mx-auto space-y-6 p-4">
            <button
              onClick={() => setCurrentView('SCHEDULING')}
              className="w-full flex items-center justify-center gap-2 bg-cyan-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-cyan-700 transition shadow-lg"
            >
              <PlusIcon className="w-6 h-6" />
              Schedule New Item
            </button>
            
            <div className="grid grid-cols-4 gap-2 p-1 bg-slate-800 rounded-lg">
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
                                <ScheduleListItem key={item.id} item={item} onStart={handleStartSession} onReview={handleReviewTask} scheduleView={scheduleView} />
                            ))
                        )}
                    </>
                )}
                 {scheduleView === 'DAILY' && (
                    <>
                        <h2 className="text-xl font-semibold text-slate-300 border-b border-slate-700 pb-2">Daily Tasks</h2>
                        {dailySchedule.length === 0 ? (
                            <p className="text-center text-slate-400 py-8">No daily tasks scheduled.</p>
                        ) : (
                            dailySchedule.map(item => (
                                <ScheduleListItem key={item.id} item={item} onStart={handleStartSession} onReview={handleReviewTask} scheduleView={scheduleView} />
                            ))
                        )}
                    </>
                 )}
                 {scheduleView === 'WEEKLY' && (
                    <>
                        <h2 className="text-xl font-semibold text-slate-300 border-b border-slate-700 pb-2">Weekly Tasks</h2>
                         {weeklySchedule.length === 0 ? (
                            <p className="text-center text-slate-400 py-8">No weekly tasks scheduled.</p>
                        ) : (
                            weeklySchedule.map(item => (
                                <ScheduleListItem key={item.id} item={item} onStart={handleStartSession} onReview={handleReviewTask} scheduleView={scheduleView} />
                            ))
                        )}
                    </>
                 )}
                 {scheduleView === 'MONTHLY' && 
                    <>
                        <h2 className="text-xl font-semibold text-slate-300 border-b border-slate-700 pb-2">Monthly Tasks</h2>
                        {monthlySchedule.length === 0 ? (
                            <p className="text-center text-slate-400 py-8">No monthly tasks scheduled.</p>
                        ) : (
                            monthlySchedule.map(item => (
                                <ScheduleListItem key={item.id} item={item} onStart={handleStartSession} onReview={handleReviewTask} scheduleView={scheduleView} />
                            ))
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
      <main className="flex-grow flex items-center justify-center">
        {renderView()}
      </main>
      {sessionForFeedback && (
        <FeedbackModal 
            sessionName={sessionForFeedback.taskName} 
            onSubmit={handleFeedbackSubmit} 
        />
      )}
      {taskForReview && (
        <TaskReviewModal item={taskForReview} onClose={() => setTaskForReview(null)} />
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
        .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
        .animate-fade-in-up { animation: fade-in-up 0.4s ease-out forwards; }
        input[type="date"]::-webkit-calendar-picker-indicator {
            filter: invert(1);
        }
      `}</style>
    </div>
  );
};

export default App;
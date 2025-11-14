import React, { useState, useMemo } from 'react';
import { ScheduleItem } from '../types';
import { getTasksForDate } from '../App';

interface HistoryViewProps {
  schedule: ScheduleItem[];
  onBack: () => void;
  onReview: (id: string, date: Date) => void;
  ListItem: React.FC<any>; // Using 'any' for ListItem to avoid complex prop type drilling
}

const WEEK_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const HistoryView: React.FC<HistoryViewProps> = ({ schedule, onBack, onReview, ListItem }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());

  const firstDayOfMonth = useMemo(() => new Date(currentDate.getFullYear(), currentDate.getMonth(), 1), [currentDate]);
  const daysInMonth = useMemo(() => new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate(), [currentDate]);

  const tasksByDay = useMemo(() => {
    const tasksMap = new Map<string, number>();
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        const taskCount = getTasksForDate(schedule, date).length;
        if (taskCount > 0) {
            tasksMap.set(date.toDateString(), taskCount);
        }
    }
    return tasksMap;
  }, [currentDate, schedule, daysInMonth]);

  const tasksForSelectedDay = useMemo(() => {
    return getTasksForDate(schedule, selectedDate);
  }, [selectedDate, schedule]);

  const changeMonth = (offset: number) => {
    setCurrentDate(prev => {
        const newDate = new Date(prev);
        newDate.setMonth(newDate.getMonth() + offset);
        return newDate;
    });
  };

  const renderCalendar = () => {
    const calendarDays = [];
    const startDayOfWeek = firstDayOfMonth.getDay();

    // Add blank days for the start of the month
    for (let i = 0; i < startDayOfWeek; i++) {
        calendarDays.push(<div key={`blank-${i}`} className="p-2"></div>);
    }
    
    const today = new Date();

    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
        const isToday = date.toDateString() === today.toDateString();
        const isSelected = date.toDateString() === selectedDate.toDateString();
        const tasksCount = tasksByDay.get(date.toDateString());

        let dayClasses = 'relative flex items-center justify-center h-10 w-10 rounded-full cursor-pointer transition-colors ';
        if (isSelected) {
            dayClasses += 'bg-primary text-slate-900 font-bold';
        } else if (isToday) {
            dayClasses += 'bg-slate-700 text-white';
        } else {
            dayClasses += 'hover:bg-slate-700/50';
        }

        calendarDays.push(
            <div key={day} className={dayClasses} onClick={() => setSelectedDate(date)}>
                {day}
                {tasksCount && tasksCount > 0 && 
                    <div className={`absolute -top-1 -right-1 text-xs ${isSelected ? 'text-primary bg-slate-900' : 'text-slate-900 bg-primary'} h-5 w-5 rounded-full flex items-center justify-center font-bold shadow`}>
                        {tasksCount}
                    </div>
                }
            </div>
        );
    }

    return (
        <div className="bg-slate-800 rounded-lg p-4">
            <div className="flex justify-between items-center mb-4">
                <button onClick={() => changeMonth(-1)} className="p-2 rounded-full hover:bg-slate-700">&lt;</button>
                <h3 className="text-xl font-semibold text-white">
                    {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                </h3>
                <button onClick={() => changeMonth(1)} className="p-2 rounded-full hover:bg-slate-700">&gt;</button>
            </div>
            <div className="grid grid-cols-7 gap-2 text-center text-slate-400 text-sm mb-2">
                {WEEK_DAYS.map(day => <div key={day}>{day}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-y-2 place-items-center">{calendarDays}</div>
        </div>
    );
  };


  return (
    <div className="w-full max-w-4xl mx-auto p-4 flex flex-col h-full animate-fade-in-up">
        <div className="mb-6">
            <button onClick={onBack} className="text-slate-400 hover:text-white transition mb-4">
            &larr; Back to Dashboard
            </button>
            <div className="text-center">
                <h2 className="text-2xl font-bold text-primary-accent mt-1">Task History</h2>
            </div>
        </div>

        <div className="flex-grow flex flex-col lg:flex-row gap-6 min-h-0">
            <div className="w-full lg:w-1/2 lg:max-w-md">{renderCalendar()}</div>
            <div className="w-full lg:w-1/2 flex-1 flex flex-col min-h-0">
                <h3 className="text-xl font-semibold text-slate-300 border-b border-slate-700 pb-2 mb-4 flex-shrink-0">
                    Tasks for {selectedDate.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </h3>
                <div className="flex-1 space-y-4 overflow-y-auto pr-2">
                    {tasksForSelectedDay.length > 0 ? (
                        tasksForSelectedDay.map(item => (
                            <ListItem
                                key={item.id}
                                item={item}
                                onReview={onReview}
                                scheduleView="HISTORY"
                                isActionable={false}
                                displayDate={selectedDate}
                            />
                        ))
                    ) : (
                        <div className="flex items-center justify-center h-full">
                            <p className="text-center text-slate-400 py-8">No tasks scheduled for this day.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    </div>
  );
};
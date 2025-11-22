import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeftIcon, ChevronRightIcon, CalendarIcon, ClockIcon } from '@heroicons/react/24/solid';

interface DateTimePickerProps {
    date: string; // "YYYY-MM-DD"
    time: string; // "HH:mm" (24h)
    onChange: (date: string, time: string) => void;
    label?: string;
}

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export const DateTimePicker: React.FC<DateTimePickerProps> = ({ date, time, onChange, label }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // --- State ---
    const [view, setView] = useState<'DATE' | 'TIME'>('DATE');
    const [currentMonth, setCurrentMonth] = useState(() => new Date(date));

    // Parse Time
    const [h, m] = time.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;

    // --- Helpers ---
    const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
    const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

    const formatDate = (d: Date) => d.toISOString().split('T')[0];
    const formatTimeDisplay = (h: number, m: number) => {
        const p = h >= 12 ? 'PM' : 'AM';
        const h12 = h % 12 || 12;
        return `${h12}:${m.toString().padStart(2, '0')} ${p}`;
    };

    // --- Handlers ---
    const handleDateClick = (day: number) => {
        const newDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
        // Adjust for timezone offset to keep the date string correct locally
        const offset = newDate.getTimezoneOffset();
        const localDate = new Date(newDate.getTime() - (offset * 60 * 1000));
        onChange(localDate.toISOString().split('T')[0], time);
        setView('TIME'); // Auto-switch to time after date selection
    };

    const handleMonthNav = (dir: -1 | 1) => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + dir, 1));
    };

    const handleTimeChange = (newH: number, newM: number) => {
        onChange(date, `${newH.toString().padStart(2, '0')}:${newM.toString().padStart(2, '0')}`);
    };

    const togglePeriod = () => {
        let newH = h;
        if (period === 'AM') newH += 12;
        else newH -= 12;
        handleTimeChange(newH, m);
    };

    // --- Effects ---
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        if (isOpen) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    useEffect(() => {
        if (isOpen) {
            setCurrentMonth(new Date(date));
            setView('DATE');
        }
    }, [isOpen, date]);


    // --- Render Helpers ---
    const renderCalendar = () => {
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth();
        const daysInMonth = getDaysInMonth(year, month);
        const firstDay = getFirstDayOfMonth(year, month);
        const days = [];

        // Empty slots
        for (let i = 0; i < firstDay; i++) {
            days.push(<div key={`empty-${i}`} className="w-8 h-8" />);
        }

        // Days
        for (let i = 1; i <= daysInMonth; i++) {
            const d = new Date(year, month, i);
            // Simple local ISO string for comparison
            const dStr = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
            const isSelected = dStr === date;
            const isToday = dStr === new Date().toISOString().split('T')[0];

            days.push(
                <button
                    key={i}
                    type="button"
                    onClick={() => handleDateClick(i)}
                    className={`w-8 h-8 rounded-full text-sm flex items-center justify-center transition
                        ${isSelected ? 'bg-blue-600 text-white font-bold shadow-lg scale-110' : 'text-slate-300 hover:bg-slate-700'}
                        ${isToday && !isSelected ? 'border border-blue-500 text-blue-400' : ''}
                    `}
                >
                    {i}
                </button>
            );
        }

        return (
            <div className="p-2 animate-fade-in">
                <div className="flex items-center justify-between mb-4 px-2">
                    <button type="button" onClick={() => handleMonthNav(-1)} className="p-1 hover:bg-slate-700 rounded-full text-slate-400 hover:text-white transition"><ChevronLeftIcon className="w-5 h-5" /></button>
                    <span className="font-bold text-white">{currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}</span>
                    <button type="button" onClick={() => handleMonthNav(1)} className="p-1 hover:bg-slate-700 rounded-full text-slate-400 hover:text-white transition"><ChevronRightIcon className="w-5 h-5" /></button>
                </div>
                <div className="grid grid-cols-7 gap-1 mb-2">
                    {DAYS.map(d => <div key={d} className="text-center text-xs font-bold text-slate-500">{d}</div>)}
                </div>
                <div className="grid grid-cols-7 gap-1 place-items-center">
                    {days}
                </div>
            </div>
        );
    };

    const renderClock = () => {
        // Clock Face Logic
        // 12 numbers positioned radially
        const numbers = [];
        for (let i = 1; i <= 12; i++) {
            const angle = (i - 3) * 30 * (Math.PI / 180);
            const r = 80; // radius
            const x = 100 + r * Math.cos(angle);
            const y = 100 + r * Math.sin(angle);
            numbers.push(
                <button
                    key={i}
                    type="button"
                    onClick={() => {
                        let newH = i === 12 ? 0 : i;
                        if (period === 'PM') newH += 12;
                        if (period === 'AM' && i === 12) newH = 0;
                        if (period === 'PM' && i === 12) newH = 12; // 12 PM is 12:00
                        handleTimeChange(newH, m);
                    }}
                    className={`absolute w-8 h-8 -ml-4 -mt-4 rounded-full flex items-center justify-center text-sm font-bold transition
                        ${hour12 === i ? 'bg-blue-600 text-white scale-110 z-10' : 'text-slate-400 hover:text-white'}
                    `}
                    style={{ left: x, top: y }}
                >
                    {i}
                </button>
            );
        }

        // Hands
        const hAngle = (hour12 % 12) * 30 + (m / 60) * 30; // 30 deg per hour
        const mAngle = m * 6; // 6 deg per minute

        return (
            <div className="p-4 flex flex-col items-center animate-fade-in">
                <div className="relative w-[200px] h-[200px] bg-slate-800 rounded-full border-4 border-slate-700 shadow-inner mb-4">
                    {/* Center Dot */}
                    <div className="absolute left-1/2 top-1/2 w-2 h-2 bg-blue-500 rounded-full -ml-1 -mt-1 z-20"></div>

                    {/* Hour Hand */}
                    <div
                        className="absolute left-1/2 top-1/2 w-1 bg-blue-500 rounded-full origin-bottom z-10 transition-transform duration-500 ease-out"
                        style={{ height: '50px', marginLeft: '-0.5px', marginTop: '-50px', transform: `rotate(${hAngle}deg)` }}
                    ></div>

                    {/* Minute Hand */}
                    <div
                        className="absolute left-1/2 top-1/2 w-0.5 bg-slate-400 rounded-full origin-bottom z-0 transition-transform duration-500 ease-out"
                        style={{ height: '70px', marginLeft: '-0.25px', marginTop: '-70px', transform: `rotate(${mAngle}deg)` }}
                    ></div>

                    {numbers}
                </div>

                {/* Digital Time & AM/PM */}
                <div className="flex items-center gap-4 bg-slate-700/50 p-2 rounded-lg">
                    <div className="text-2xl font-mono font-bold text-white tracking-wider">
                        {hour12}:{m.toString().padStart(2, '0')}
                    </div>
                    <button
                        type="button"
                        onClick={togglePeriod}
                        className={`px-3 py-1 rounded text-sm font-bold transition ${period === 'AM' ? 'bg-slate-600 text-slate-300' : 'bg-blue-600 text-white'}`}
                    >
                        {period}
                    </button>
                </div>

                {/* Minute Stepper (Fine tuning) */}
                <div className="mt-4 flex gap-2">
                    <button type="button" onClick={() => handleTimeChange(h, Math.max(0, m - 1))} className="p-1 bg-slate-700 rounded hover:bg-slate-600 text-slate-300 text-xs">-1m</button>
                    <button type="button" onClick={() => handleTimeChange(h, Math.min(59, m + 1))} className="p-1 bg-slate-700 rounded hover:bg-slate-600 text-slate-300 text-xs">+1m</button>
                    <button type="button" onClick={() => handleTimeChange(h, Math.max(0, m - 5))} className="p-1 bg-slate-700 rounded hover:bg-slate-600 text-slate-300 text-xs">-5m</button>
                    <button type="button" onClick={() => handleTimeChange(h, Math.min(55, m + 5))} className="p-1 bg-slate-700 rounded hover:bg-slate-600 text-slate-300 text-xs">+5m</button>
                </div>
            </div>
        );
    };

    return (
        <div className="relative w-full" ref={containerRef}>
            {label && <label className="block text-sm font-medium text-slate-300 mb-2">{label}</label>}

            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full bg-slate-700 border border-slate-600 rounded-md px-4 py-3 text-white flex items-center justify-between hover:bg-slate-600 transition focus:ring-2 focus:ring-blue-500 ${isOpen ? 'ring-2 ring-blue-500 border-blue-500' : ''}`}
            >
                <div className="flex items-center gap-3">
                    <CalendarIcon className="w-5 h-5 text-slate-400" />
                    <span className="text-lg">{date}</span>
                    <span className="text-slate-500">|</span>
                    <ClockIcon className="w-5 h-5 text-slate-400" />
                    <span className="text-lg font-mono">{formatTimeDisplay(h, m)}</span>
                </div>
            </button>

            {isOpen && (
                <div className="absolute z-50 mt-2 left-1/2 -translate-x-1/2 sm:left-0 sm:translate-x-0 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden w-[320px] animate-fade-in-up">
                    {/* Header */}
                    <div className="bg-blue-600 p-4 text-white">
                        <div className="flex justify-between items-end">
                            <div>
                                <div className="text-blue-200 text-sm font-semibold uppercase tracking-wide">{new Date(date).getFullYear()}</div>
                                <div className="text-3xl font-bold">{new Date(date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</div>
                            </div>
                            <div className="text-right">
                                <div className="text-3xl font-mono font-bold">{formatTimeDisplay(h, m)}</div>
                            </div>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex border-b border-slate-700">
                        <button
                            type="button"
                            onClick={() => setView('DATE')}
                            className={`flex-1 py-3 text-sm font-semibold transition ${view === 'DATE' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-slate-400 hover:text-slate-200'}`}
                        >
                            Date
                        </button>
                        <button
                            type="button"
                            onClick={() => setView('TIME')}
                            className={`flex-1 py-3 text-sm font-semibold transition ${view === 'TIME' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-slate-400 hover:text-slate-200'}`}
                        >
                            Time
                        </button>
                    </div>

                    {/* Body */}
                    <div className="h-[320px] bg-slate-800 relative">
                        {view === 'DATE' ? renderCalendar() : renderClock()}
                    </div>

                    {/* Footer */}
                    <div className="p-3 border-t border-slate-700 flex justify-end">
                        <button
                            type="button"
                            onClick={() => setIsOpen(false)}
                            className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg transition shadow-lg shadow-blue-900/20"
                        >
                            Confirm
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

import React, { useState, useRef, useEffect } from 'react';
import { ClockIcon, ChevronDownIcon } from '@heroicons/react/24/solid';

interface TimePickerProps {
    value: string; // "HH:mm"
    onChange: (value: string) => void;
    label?: string;
}

export const TimePicker: React.FC<TimePickerProps> = ({ value, onChange, label }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Parse current value
    const [hours, minutes] = value.split(':').map(Number);

    // Generate hours (0-23) and minutes (0-55, step 5)
    const hourOptions = Array.from({ length: 24 }, (_, i) => i);
    const minuteOptions = Array.from({ length: 12 }, (_, i) => i * 5);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const handleHourClick = (h: number) => {
        const newTime = `${h.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        onChange(newTime);
    };

    const handleMinuteClick = (m: number) => {
        const newTime = `${hours.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
        onChange(newTime);
        setIsOpen(false); // Auto-close on minute selection for smoother flow
    };

    return (
        <div className="relative" ref={containerRef}>
            {label && <label className="block text-sm font-medium text-slate-300 mb-2">{label}</label>}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-white flex items-center justify-between hover:bg-slate-600 transition focus:ring-2 focus:ring-primary-accent ${isOpen ? 'ring-2 ring-primary-accent border-primary-accent' : ''}`}
            >
                <div className="flex items-center gap-2">
                    <ClockIcon className="w-5 h-5 text-slate-400" />
                    <span className="font-mono text-lg">{value}</span>
                </div>
                <ChevronDownIcon className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute z-50 mt-2 bg-slate-800 border border-slate-700 rounded-lg shadow-2xl p-4 w-64 animate-fade-in-up left-0 sm:left-auto sm:right-0">
                    <div className="flex gap-4 h-60">
                        {/* Hours Column */}
                        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-transparent pr-1">
                            <div className="text-xs font-bold text-slate-400 mb-2 text-center sticky top-0 bg-slate-800 py-1">Hour</div>
                            <div className="space-y-1">
                                {hourOptions.map(h => (
                                    <button
                                        key={h}
                                        type="button"
                                        onClick={() => handleHourClick(h)}
                                        className={`w-full text-center py-1.5 rounded-md text-sm transition ${hours === h ? 'bg-primary text-white font-bold' : 'text-slate-300 hover:bg-slate-700'}`}
                                    >
                                        {h.toString().padStart(2, '0')}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Separator */}
                        <div className="w-px bg-slate-700 my-2"></div>

                        {/* Minutes Column */}
                        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-transparent pl-1">
                            <div className="text-xs font-bold text-slate-400 mb-2 text-center sticky top-0 bg-slate-800 py-1">Min</div>
                            <div className="space-y-1">
                                {minuteOptions.map(m => (
                                    <button
                                        key={m}
                                        type="button"
                                        onClick={() => handleMinuteClick(m)}
                                        className={`w-full text-center py-1.5 rounded-md text-sm transition ${minutes === m ? 'bg-primary text-white font-bold' : 'text-slate-300 hover:bg-slate-700'}`}
                                    >
                                        {m.toString().padStart(2, '0')}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-slate-700">
                        <p className="text-xs text-slate-500 text-center">
                            Select hour, then minute to close.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};

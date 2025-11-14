
import React, { useState, useEffect } from 'react';
import { AppSettings, Holiday } from '../services/settingsService';
import { TrashIcon } from './icons';

interface SettingsModalProps {
  currentSettings: AppSettings;
  onClose: () => void;
  onSave: (settings: AppSettings) => void;
}

type Tab = 'availability' | 'timeOff' | 'appearance' | 'personalization';

const WEEK_DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const TabButton: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({ active, onClick, children }) => (
    <button
        onClick={onClick}
        className={`px-4 py-2 text-sm font-semibold rounded-t-lg border-b-2 transition ${
            active
                ? 'border-primary-accent text-primary-accent'
                : 'border-transparent text-slate-400 hover:text-white hover:border-slate-500'
        }`}
    >
        {children}
    </button>
);

export const SettingsModal: React.FC<SettingsModalProps> = ({ currentSettings, onClose, onSave }) => {
  const [settings, setSettings] = useState<AppSettings>(currentSettings);
  const [activeTab, setActiveTab] = useState<Tab>('availability');
  
  const [newHoliday, setNewHoliday] = useState({ description: '', startDate: '', endDate: '' });

  const handleSave = () => {
    onSave(settings);
  };

  const handleDayToggle = (dayIndex: number) => {
    const days = settings.availability.days.includes(dayIndex)
        ? settings.availability.days.filter(d => d !== dayIndex)
        : [...settings.availability.days, dayIndex].sort();
    setSettings(s => ({ ...s, availability: { ...s.availability, days } }));
  };
  
  const handleAddHoliday = () => {
      if (newHoliday.description && newHoliday.startDate && newHoliday.endDate) {
          const holidays = [...settings.holidays, { ...newHoliday, id: Date.now().toString() }];
          setSettings(s => ({ ...s, holidays }));
          setNewHoliday({ description: '', startDate: '', endDate: '' });
      }
  };
  
  const handleRemoveHoliday = (id: string) => {
      const holidays = settings.holidays.filter(h => h.id !== id);
      setSettings(s => ({...s, holidays}));
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-slate-800 rounded-lg shadow-xl w-full max-w-lg flex flex-col h-[90vh] max-h-[700px]">
        <header className="p-6 text-center border-b border-slate-700">
          <h2 className="text-2xl font-bold text-primary-accent">Settings</h2>
        </header>

        <div className="border-b border-slate-700 px-6">
            <nav className="flex -mb-px">
                <TabButton active={activeTab === 'availability'} onClick={() => setActiveTab('availability')}>Availability</TabButton>
                <TabButton active={activeTab === 'timeOff'} onClick={() => setActiveTab('timeOff')}>Time Off</TabButton>
                <TabButton active={activeTab === 'appearance'} onClick={() => setActiveTab('appearance')}>Appearance</TabButton>
                <TabButton active={activeTab === 'personalization'} onClick={() => setActiveTab('personalization')}>AI Coach</TabButton>
            </nav>
        </div>

        <main className="flex-1 p-6 space-y-6 overflow-y-auto">
            {activeTab === 'availability' && (
                <div className="space-y-6 animate-fade-in">
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Working Days</label>
                        <div className="flex justify-center gap-2">
                            {WEEK_DAYS.map((day, index) => (
                                <button
                                    key={index}
                                    type="button"
                                    onClick={() => handleDayToggle(index)}
                                    className={`w-10 h-10 rounded-full font-bold text-sm flex items-center justify-center transition ${
                                        settings.availability.days.includes(index) ? 'bg-primary text-slate-900' : 'bg-slate-700 hover:bg-slate-600'
                                    }`}
                                >{day}</button>
                            ))}
                        </div>
                    </div>
                     <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="startTime" className="block text-sm font-medium text-slate-300 mb-2">Start Time</label>
                            <input
                                id="startTime"
                                type="time"
                                value={settings.availability.startTime}
                                onChange={e => setSettings(s => ({ ...s, availability: { ...s.availability, startTime: e.target.value } }))}
                                className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-white placeholder-slate-400 focus:ring-2 focus:ring-primary-accent"
                            />
                        </div>
                        <div>
                            <label htmlFor="endTime" className="block text-sm font-medium text-slate-300 mb-2">End Time</label>
                            <input
                                id="endTime"
                                type="time"
                                value={settings.availability.endTime}
                                onChange={e => setSettings(s => ({ ...s, availability: { ...s.availability, endTime: e.target.value } }))}
                                className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-white placeholder-slate-400 focus:ring-2 focus:ring-primary-accent"
                            />
                        </div>
                    </div>
                    <p className="text-xs text-slate-500 text-center">Note: These settings are not yet enforced during scheduling but will be used for future AI-powered suggestions.</p>
                </div>
            )}
            
            {activeTab === 'timeOff' && (
                <div className="space-y-6 animate-fade-in">
                    <div>
                        <h3 className="text-lg font-semibold text-slate-300 mb-3">Add Holiday / Time Off</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                             <input type="text" placeholder="Description (e.g., Vacation)" value={newHoliday.description} onChange={e => setNewHoliday(h => ({...h, description: e.target.value}))} className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-white placeholder-slate-400 focus:ring-2 focus:ring-primary-accent" />
                             <div className="grid grid-cols-2 gap-2">
                                <input type="date" value={newHoliday.startDate} onChange={e => setNewHoliday(h => ({...h, startDate: e.target.value}))} className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-white" />
                                <input type="date" value={newHoliday.endDate} min={newHoliday.startDate} onChange={e => setNewHoliday(h => ({...h, endDate: e.target.value}))} className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-white" />
                             </div>
                        </div>
                        <button onClick={handleAddHoliday} className="w-full py-2 bg-slate-600 text-white rounded-md hover:bg-slate-500 transition">Add Time Off</button>
                    </div>
                     <div>
                        <h3 className="text-lg font-semibold text-slate-300 mb-3">Scheduled Time Off</h3>
                        <div className="space-y-2">
                            {settings.holidays.length === 0 ? <p className="text-slate-500 text-center">No time off scheduled.</p> :
                            settings.holidays.map(holiday => (
                                <div key={holiday.id} className="flex justify-between items-center p-3 bg-slate-700/50 rounded-lg">
                                    <div>
                                        <p className="font-semibold text-white">{holiday.description}</p>
                                        <p className="text-sm text-slate-400">{holiday.startDate} to {holiday.endDate}</p>
                                    </div>
                                    <button onClick={() => handleRemoveHoliday(holiday.id)} className="p-2 text-slate-500 hover:text-red-400">
                                        <TrashIcon className="w-5 h-5" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'appearance' && (
                 <div className="space-y-6 animate-fade-in">
                     <div>
                        <label className="block text-sm font-medium text-slate-300 mb-3">Color Scheme</label>
                        <div className="grid grid-cols-3 gap-4">
                            {(['cyan', 'green', 'orange'] as const).map(theme => (
                                <button key={theme} onClick={() => setSettings(s => ({...s, theme}))} className={`p-4 rounded-lg border-2 transition ${settings.theme === theme ? `border-${theme}-500` : 'border-slate-700 hover:border-slate-500'}`}>
                                    <div className={`w-full h-8 rounded bg-${theme}-500 mb-2`}></div>
                                    <p className="capitalize font-semibold">{theme}</p>
                                </button>
                            ))}
                        </div>
                    </div>
                 </div>
            )}
            
            {activeTab === 'personalization' && (
                 <div className="space-y-2 animate-fade-in">
                    <label htmlFor="aiPersonalization" className="block text-sm font-medium text-slate-300">Your AI Coach Persona</label>
                    <p className="text-xs text-slate-400 mb-2">Tell Gemini how you want it to behave. This will be included in instructions to the AI.</p>
                    <textarea
                        id="aiPersonalization"
                        rows={6}
                        value={settings.aiPersonalization}
                        onChange={e => setSettings(s => ({ ...s, aiPersonalization: e.target.value }))}
                        placeholder="e.g., Act as a direct and concise coach. Focus on actionable advice."
                        className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-white placeholder-slate-400 focus:ring-2 focus:ring-primary-accent"
                    />
                 </div>
            )}
        </main>

        <footer className="flex justify-end gap-4 p-4 border-t border-slate-700">
          <button onClick={onClose} className="px-6 py-2 bg-slate-600 text-white rounded-md hover:bg-slate-500 transition">
            Cancel
          </button>
          <button onClick={handleSave} className="px-6 py-2 bg-primary text-white font-semibold rounded-md hover:bg-primary-focus transition">
            Save Settings
          </button>
        </footer>
      </div>
    </div>
  );
};

import React, { useState, useMemo, useCallback } from 'react';
import { DeepWorkSession, RitualItem } from '../types';
import { CameraIcon } from './icons';

interface PreSessionChecklistProps {
  session: DeepWorkSession;
  onUpdateSession: (updatedSession: DeepWorkSession) => void;
  onStartFocus: () => void;
  onBack: () => void;
}

const defaultRitual: RitualItem[] = [
    { text: "Clear your physical workspace.", completed: false },
    { text: "Close all unnecessary browser tabs and applications.", completed: false },
    { text: "Set your phone to silent and place it out of reach.", completed: false },
    { text: "Take a moment to review your main goal for this session.", completed: false },
];

export const PreSessionChecklist: React.FC<PreSessionChecklistProps> = ({ session, onUpdateSession, onStartFocus, onBack }) => {
  const [checklist, setChecklist] = useState<RitualItem[]>(session.ritualChecklist || defaultRitual);
  const [imageUrl, setImageUrl] = useState<string | null>(session.workspaceImageUrl);

  const handleToggleItem = (index: number) => {
    const updatedList = checklist.map((item, i) => i === index ? { ...item, completed: !item.completed } : item);
    setChecklist(updatedList);
    onUpdateSession({ ...session, ritualChecklist: updatedList });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        const reader = new FileReader();
        reader.onloadend = () => {
            const newImageUrl = reader.result as string;
            setImageUrl(newImageUrl);
            onUpdateSession({ ...session, workspaceImageUrl: newImageUrl });
        };
        reader.readAsDataURL(file);
    }
  };
  
  const allItemsCompleted = useMemo(() => checklist.every(item => item.completed), [checklist]);
  const isReady = allItemsCompleted && !!imageUrl;

  return (
    <div className="p-6 bg-slate-800 rounded-lg shadow-lg w-full max-w-2xl mx-auto animate-fade-in-up">
      <div className="relative text-center mb-6">
        <button onClick={onBack} className="absolute top-0 left-0 text-slate-400 hover:text-white transition">
           &larr; Back
        </button>
        <h2 className="text-2xl font-bold text-cyan-400">Pre-flight Checklist</h2>
        <p className="text-slate-400">Prepare for deep focus on "{session.taskName}"</p>
        <p className="text-slate-300 mt-1"><strong>Goal:</strong> {session.goal}</p>
      </div>
      
      <div className="space-y-4">
        {checklist.map((item, index) => (
          <label key={index} className={`flex items-center gap-4 p-4 rounded-lg transition cursor-pointer ${item.completed ? 'bg-green-500/10' : 'bg-slate-700/50 hover:bg-slate-700'}`}>
            <input 
              type="checkbox"
              checked={item.completed}
              onChange={() => handleToggleItem(index)}
              className="h-6 w-6 rounded border-slate-600 bg-slate-700 text-cyan-500 focus:ring-cyan-500 cursor-pointer"
            />
            <span className={`flex-1 ${item.completed ? 'text-slate-400 line-through' : 'text-slate-200'}`}>{item.text}</span>
          </label>
        ))}

        {/* Image Upload */}
        <div className={`p-4 rounded-lg transition ${imageUrl ? 'bg-green-500/10' : 'bg-slate-700/50 hover:bg-slate-700'}`}>
           <label className="flex items-center gap-4 cursor-pointer">
                <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                <div className={`h-6 w-6 rounded border-slate-600 bg-slate-700 grid place-content-center flex-shrink-0 ${imageUrl ? 'border-green-500' : ''}`}>
                    {imageUrl && <div className="w-3 h-3 bg-green-500 rounded-sm"></div>}
                </div>
                <div className="flex-1">
                    <span className="text-slate-200">Upload image of your clean workspace.</span>
                    {imageUrl ? (
                        <p className="text-xs text-green-400">Image uploaded successfully!</p>
                    ) : (
                        <p className="text-xs text-slate-400">A visual commitment helps lock in focus.</p>
                    )}
                </div>
                <div className="flex-shrink-0">
                    {imageUrl ? (
                        <img src={imageUrl} alt="Workspace" className="w-16 h-12 object-cover rounded-md"/>
                    ) : (
                        <div className="w-16 h-12 bg-slate-600 rounded-md flex items-center justify-center">
                            <CameraIcon className="w-6 h-6 text-slate-400"/>
                        </div>
                    )}
                </div>
           </label>
        </div>
      </div>

      <div className="mt-8">
        <button
          onClick={onStartFocus}
          disabled={!isReady}
          className="w-full py-3 bg-cyan-600 text-white font-bold rounded-md hover:bg-cyan-700 transition disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed"
        >
          {isReady ? 'Begin Focus Session' : 'Complete all steps to begin'}
        </button>
      </div>

    </div>
  );
};
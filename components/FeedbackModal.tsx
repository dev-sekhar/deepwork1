
import React, { useState } from 'react';
import { Feedback } from '../types';

interface FeedbackModalProps {
  sessionName: string;
  onSubmit: (feedback: Feedback) => void;
}

const moods = [
    { name: 'focused', emoji: '🎯', label: 'Focused' },
    { name: 'distracted', emoji: '🐿️', label: 'Distracted' },
    { name: 'tired', emoji: '😴', label: 'Tired' },
] as const;


export const FeedbackModal: React.FC<FeedbackModalProps> = ({ sessionName, onSubmit }) => {
  const [focusQuality, setFocusQuality] = useState(3);
  const [mood, setMood] = useState<'focused' | 'distracted' | 'tired' | null>(null);
  const [interruptions, setInterruptions] = useState('');

  const handleSubmit = () => {
    onSubmit({ focusQuality, mood, interruptions });
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-slate-800 rounded-lg shadow-xl p-8 w-full max-w-md space-y-6 transform animate-fade-in-up">
        <div className="text-center">
            <h2 className="text-2xl font-bold text-primary-accent">Session Complete!</h2>
            <p className="text-slate-400 mt-1">How was your focus on "{sessionName}"?</p>
        </div>

        <div>
            <label className="block text-sm font-medium text-slate-300 mb-2 text-center">Focus Quality</label>
            <div className="flex justify-center gap-2">
                {[1, 2, 3, 4, 5].map(star => (
                    <button key={star} onClick={() => setFocusQuality(star)}>
                        <svg className={`w-10 h-10 ${focusQuality >= star ? 'text-yellow-400' : 'text-slate-600'}`} fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                    </button>
                ))}
            </div>
        </div>

         <div>
            <label className="block text-sm font-medium text-slate-300 mb-2 text-center">Mood</label>
            <div className="flex justify-center gap-4">
                {moods.map(({ name, emoji, label }) => (
                    <button 
                        key={name} 
                        onClick={() => setMood(name)} 
                        className={`p-4 rounded-full text-3xl transition transform hover:scale-110 ${mood === name ? 'bg-primary/20 ring-2 ring-primary-accent' : 'bg-slate-700'}`}
                        title={label}
                        aria-label={label}
                    >
                        {emoji}
                    </button>
                ))}
            </div>
        </div>

        <div>
            <label htmlFor="interruptions" className="block text-sm font-medium text-slate-300 mb-2">Interruptions (optional)</label>
            <textarea 
                id="interruptions"
                value={interruptions}
                onChange={e => setInterruptions(e.target.value)}
                rows={2}
                placeholder="e.g., Checked phone, colleague asked a question"
                className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-white placeholder-slate-400 focus:ring-2 focus:ring-primary-accent"
            />
        </div>

        <button onClick={handleSubmit} className="w-full py-3 bg-primary text-white font-bold rounded-md hover:bg-primary-focus transition">
          Save & Finish
        </button>
      </div>
    </div>
  );
};
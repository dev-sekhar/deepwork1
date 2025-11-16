import React from 'react';
import { CheckIcon } from './icons';

interface ClassificationGuideModalProps {
  onClose: () => void;
}

const BulletPoint: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <li className="flex items-start gap-3">
        <CheckIcon className="w-5 h-5 text-green-400 mt-1 flex-shrink-0" />
        <span>{children}</span>
    </li>
);

export const ClassificationGuideModal: React.FC<ClassificationGuideModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 animate-fade-in" onClick={onClose}>
      <div className="bg-slate-800 rounded-lg shadow-xl p-8 w-full max-w-lg space-y-6 transform animate-fade-in-up" onClick={e => e.stopPropagation()}>
        <div className="text-center">
            <h2 className="text-2xl font-bold text-primary-accent">Classification Guide</h2>
            <p className="text-slate-400 mt-1">Understanding Deep vs. Shallow Work</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
            <div className="p-4 bg-slate-900/50 rounded-lg">
                <h3 className="text-lg font-bold text-green-400 mb-3">🎯 Deep Work</h3>
                <ul className="space-y-3 text-slate-300">
                    <BulletPoint><strong>Cognitively Demanding:</strong> Requires intense, uninterrupted concentration.</BulletPoint>
                    <BulletPoint><strong>Creates High Value:</strong> Produces new insights, skills, or content that is hard to replicate.</BulletPoint>
                    <BulletPoint><strong>Pushes Your Skills:</strong> Stretches your current abilities and leads to growth.</BulletPoint>
                    <BulletPoint><strong>Examples:</strong> Writing a report, learning a new skill, coding a difficult feature, strategic planning.</BulletPoint>
                </ul>
            </div>
             <div className="p-4 bg-slate-900/50 rounded-lg">
                <h3 className="text-lg font-bold text-orange-400 mb-3">🐿️ Shallow Work</h3>
                <ul className="space-y-3 text-slate-300">
                    <BulletPoint><strong>Non-Demanding:</strong> Can often be performed while distracted.</BulletPoint>
                    <BulletPoint><strong>Logistical in Nature:</strong> Tends to be administrative or organizational.</BulletPoint>
                    <BulletPoint><strong>Creates Little New Value:</strong> Easy for others to replicate; doesn't leverage expert skills.</BulletPoint>
                    <BulletPoint><strong>Examples:</strong> Answering routine emails, scheduling meetings, data entry, social media browsing.</BulletPoint>
                </ul>
            </div>
        </div>

        <button onClick={onClose} className="w-full py-3 bg-slate-600 text-white font-bold rounded-md hover:bg-slate-500 transition">
          Got it
        </button>
      </div>
    </div>
  );
};

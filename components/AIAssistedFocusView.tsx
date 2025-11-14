
import React, { useEffect, useState } from 'react';
import { AIAssistedWorkSession, ScheduleItem } from '../types';
import { useTimer } from '../hooks/useTimer';
import { PlayIcon, PauseIcon, StopIcon } from './icons';
import { AIChatPanel } from './AIChatPanel';

interface AIAssistedFocusViewProps {
  session: AIAssistedWorkSession;
  onComplete: () => void;
  onBack: () => void;
  onUpdateSession: (updatedSession: ScheduleItem) => void;
}

export const AIAssistedFocusView: React.FC<AIAssistedFocusViewProps> = ({ session, onComplete, onBack, onUpdateSession }) => {
  const [wasStarted, setWasStarted] = useState(false);
  const { secondsLeft, isActive, start, pause } = useTimer(session.durationMinutes * 60);

  useEffect(() => {
    if (secondsLeft === 0 && wasStarted) {
      onComplete();
    }
  }, [secondsLeft, onComplete, wasStarted]);

  const handleStartClick = () => {
    if (!wasStarted) {
      setWasStarted(true);
    }
    start();
  };

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;

  return (
    <div className="flex h-full w-full max-w-6xl mx-auto p-4 gap-6 animate-fade-in-up">
      {/* Left Panel: Timer & Controls */}
      <div className="w-1/2 flex flex-col items-center justify-center">
        <div className="w-full bg-slate-800 rounded-2xl shadow-2xl p-6 sm:p-8 relative">
          <button onClick={onBack} className="absolute top-4 left-4 text-slate-400 hover:text-white transition z-10">
            &larr; Back to Dashboard
          </button>
          <div className="flex flex-col gap-6 sm:gap-8">
            <div className="flex flex-col text-center w-full">
              <h2 className="text-xl sm:text-2xl text-slate-400 mb-2 mt-8 sm:mt-0">Focusing on:</h2>
              <h1 className="text-3xl sm:text-4xl font-bold text-violet-400 mb-2 truncate" title={session.taskName}>
                {session.taskName}
              </h1>
              
              <div className="my-8">
                <p className="text-8xl sm:text-9xl font-mono font-bold tracking-tighter text-white">
                  {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
                </p>
              </div>

              <div className="flex justify-center items-center gap-6 mt-8">
                <button
                  onClick={onComplete}
                  disabled={!wasStarted}
                  className={`p-4 rounded-full transition-all duration-300 ${
                    !wasStarted 
                    ? 'bg-slate-700 text-slate-500 cursor-not-allowed' 
                    : 'bg-red-600/20 text-red-400 hover:bg-red-600/40 hover:text-red-300'
                  }`}
                  aria-label="Stop Session"
                >
                  <StopIcon className="w-8 h-8" />
                </button>

                <button
                  onClick={isActive ? pause : handleStartClick}
                  className="p-6 bg-violet-500 text-slate-900 rounded-full hover:bg-violet-400 shadow-lg shadow-violet-500/20 transform hover:scale-105 transition-all duration-300"
                  aria-label={isActive ? 'Pause' : 'Start'}
                >
                  {isActive ? <PauseIcon className="w-12 h-12" /> : <PlayIcon className="w-12 h-12" />}
                </button>
                 <div className="w-20"></div> {/* Spacer */}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Right Panel: AI Chat */}
      <div className="w-1/2 bg-slate-800 rounded-2xl shadow-2xl p-6">
        <AIChatPanel session={session} onUpdateSession={onUpdateSession} />
      </div>
    </div>
  );
};

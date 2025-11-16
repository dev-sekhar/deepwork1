import React, { useEffect, useRef } from 'react';
import { useVoiceAssistant } from '../hooks/useVoiceAssistant';
import { ScheduleItem } from '../types';
import { MicrophoneIcon, SparklesIcon, UserIcon } from './icons';

interface VoiceAssistantModalProps {
  onClose: () => void;
  onTaskCreate: (item: ScheduleItem) => void;
}

export const VoiceAssistantModal: React.FC<VoiceAssistantModalProps> = ({ onClose, onTaskCreate }) => {
  const {
    assistantState,
    conversation,
    errorMessage,
    startAssistant,
    stopAssistant,
  } = useVoiceAssistant({ onTaskCreate, onClose });
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    startAssistant();
    return () => {
      stopAssistant();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation]);

  const getStatusIndicator = () => {
    if (errorMessage) {
      return <p className="text-sm text-red-400 text-center">{errorMessage}</p>;
    }

    switch (assistantState) {
      case 'LISTENING':
        return (
          <div className="flex flex-col items-center">
            <MicrophoneIcon className="w-8 h-8 text-primary-accent animate-pulse" />
            <p className="text-sm text-primary-accent mt-2">Listening...</p>
          </div>
        );
      case 'THINKING':
        return (
          <div className="flex flex-col items-center">
            <SparklesIcon className="w-8 h-8 text-violet-400 animate-spin" />
            <p className="text-sm text-violet-400 mt-2">Thinking...</p>
          </div>
        );
      case 'SPEAKING':
        return (
           <div className="flex flex-col items-center">
            <div className="w-8 h-8 text-cyan-400 relative flex justify-center items-center">
                <div className="absolute h-full w-full bg-cyan-400/50 rounded-full animate-ping"></div>
                <SparklesIcon className="w-6 h-6" />
            </div>
            <p className="text-sm text-cyan-400 mt-2">Speaking...</p>
          </div>
        );
      case 'ERROR':
         return (
          <div className="flex flex-col items-center">
            <SparklesIcon className="w-8 h-8 text-yellow-400 animate-spin" />
            <p className="text-sm text-yellow-400 mt-2">Reconnecting...</p>
          </div>
        );
      default:
        return <p className="text-sm text-slate-500">Initializing...</p>;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex flex-col items-center justify-end p-4 z-50 animate-fade-in" onClick={onClose}>
      <div className="bg-slate-800 rounded-2xl shadow-xl w-full max-w-2xl h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <header className="p-4 text-center border-b border-slate-700">
          <h2 className="text-xl font-bold text-primary-accent">AI Voice Scheduler</h2>
          <p className="text-sm text-slate-400">Describe the task you want to schedule</p>
        </header>

        <main className="flex-1 p-4 space-y-4 overflow-y-auto">
          {conversation.map((msg, index) => (
            <div key={index} className={`flex items-start gap-3 animate-fade-in-up ${msg.speaker === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.speaker === 'assistant' && (
                <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0">
                  <SparklesIcon className="w-5 h-5 text-violet-400" />
                </div>
              )}
              <div className={`max-w-xs md:max-w-sm lg:max-w-md p-3 rounded-xl ${msg.speaker === 'user' ? 'bg-primary' : 'bg-slate-700'}`}>
                <p className="text-white whitespace-pre-wrap">{msg.text}</p>
              </div>
              {msg.speaker === 'user' && (
                <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center flex-shrink-0">
                  <UserIcon className="w-5 h-5 text-slate-300" />
                </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </main>

        <footer className="p-4 border-t border-slate-700 h-28 flex flex-col justify-center items-center">
          {getStatusIndicator()}
        </footer>
      </div>
       <button onClick={onClose} className="mt-4 px-6 py-2 bg-slate-600 text-white rounded-full hover:bg-slate-500 transition">
        Close
      </button>
    </div>
  );
};
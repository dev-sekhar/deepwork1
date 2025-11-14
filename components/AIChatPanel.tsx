
import React, { useState, useRef, useEffect } from 'react';
import { AIAssistedWorkSession, ScheduleItem } from '../types';
import { getChatResponse } from '../services/geminiService';
import { PaperAirplaneIcon, SparklesIcon, UserIcon } from './icons';

interface AIChatPanelProps {
  session: AIAssistedWorkSession;
  onUpdateSession: (updatedSession: ScheduleItem) => void;
}

export const AIChatPanel: React.FC<AIChatPanelProps> = ({ session, onUpdateSession }) => {
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [session.chatHistory]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedInput = userInput.trim();
    if (!trimmedInput || isLoading) return;

    const newUserMessage = { role: 'user' as const, parts: [{ text: trimmedInput }] };
    const updatedHistory = [...session.chatHistory, newUserMessage];
    
    onUpdateSession({ ...session, chatHistory: updatedHistory });
    setUserInput('');
    setIsLoading(true);

    const responseText = await getChatResponse(session.taskName, session.chatHistory, trimmedInput);
    
    const newModelMessage = { role: 'model' as const, parts: [{ text: responseText }] };
    onUpdateSession({ ...session, chatHistory: [...updatedHistory, newModelMessage] });
    
    setIsLoading(false);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 mb-4">
        <SparklesIcon className="w-6 h-6 text-violet-400" />
        <h3 className="text-lg font-bold text-violet-400">Gemini Assistant</h3>
      </div>
      
      <div className="flex-1 overflow-y-auto pr-2 space-y-4">
        {session.chatHistory.map((msg, index) => (
           <div key={index} className={`flex items-start gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'model' && (
                <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0">
                    <SparklesIcon className="w-5 h-5 text-violet-400" />
                </div>
              )}
              <div className={`max-w-xs md:max-w-sm lg:max-w-md p-3 rounded-lg ${msg.role === 'user' ? 'bg-cyan-800' : 'bg-slate-700'}`}>
                <p className="text-white whitespace-pre-wrap">{msg.parts[0].text}</p>
              </div>
              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center flex-shrink-0">
                    <UserIcon className="w-5 h-5 text-slate-300" />
                </div>
              )}
          </div>
        ))}
        {isLoading && (
            <div className="flex items-start gap-3 justify-start">
              <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0">
                  <SparklesIcon className="w-5 h-5 text-violet-400" />
              </div>
              <div className="max-w-sm p-3 rounded-lg bg-slate-700">
                  <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-slate-400 rounded-full animate-pulse [animation-delay:-0.3s]"></div>
                      <div className="w-2 h-2 bg-slate-400 rounded-full animate-pulse [animation-delay:-0.15s]"></div>
                      <div className="w-2 h-2 bg-slate-400 rounded-full animate-pulse"></div>
                  </div>
              </div>
            </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSendMessage} className="mt-4 flex gap-2">
        <input
          type="text"
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          placeholder="Ask for help..."
          className="flex-1 bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-white placeholder-slate-400 focus:ring-2 focus:ring-cyan-500"
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading || !userInput.trim()}
          className="p-3 bg-cyan-600 text-white rounded-md hover:bg-cyan-700 transition disabled:bg-slate-600 disabled:cursor-not-allowed"
          aria-label="Send message"
        >
          <PaperAirplaneIcon className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
};

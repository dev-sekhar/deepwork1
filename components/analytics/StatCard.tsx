import React from 'react';

interface StatCardProps {
  title: string;
  value: string;
}

export const StatCard: React.FC<StatCardProps> = ({ title, value }) => {
  return (
    <div className="bg-slate-800 p-6 rounded-lg shadow-lg text-center w-full max-w-xs mx-auto animate-fade-in-up">
      <h3 className="text-lg font-semibold text-slate-400 mb-2 truncate" title={title}>
        {title}
      </h3>
      <p className="text-5xl font-bold text-primary-accent">{value}</p>
    </div>
  );
};
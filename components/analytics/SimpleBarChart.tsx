import React from 'react';

interface BarChartData {
  label: string;
  value: number;
}

interface SimpleBarChartProps {
  data: BarChartData[];
  title: string;
}

export const SimpleBarChart: React.FC<SimpleBarChartProps> = ({ data, title }) => {
  const maxValue = Math.max(...data.map(item => item.value), 0);
  
  return (
    <div className="bg-slate-800 p-6 rounded-lg shadow-lg w-full">
      <h3 className="text-lg font-semibold text-white text-center mb-4">{title}</h3>
      <div className="flex justify-around items-end gap-4 h-64 border-l border-b border-slate-600 p-4">
        {data.map(item => (
          <div key={item.label} className="flex-1 flex flex-col items-center gap-2">
            <div
              className="w-3/4 rounded-t-sm transition-colors bg-primary hover:bg-primary-focus"
              style={{ height: `${maxValue > 0 ? (item.value / maxValue) * 100 : 0}%` }}
              title={`${item.label}: ${item.value}`}
            />
            <span className="text-xs text-slate-400">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
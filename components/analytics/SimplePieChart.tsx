import React from 'react';

interface PieChartData {
  label: string;
  value: number;
  color: string;
}

interface SimplePieChartProps {
  data: PieChartData[];
}

export const SimplePieChart: React.FC<SimplePieChartProps> = ({ data }) => {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  if (total === 0) return null;

  let cumulativePercentage = 0;
  const gradientParts = data.map(item => {
    const percentage = (item.value / total) * 100;
    const part = `${item.color} ${cumulativePercentage}% ${cumulativePercentage + percentage}%`;
    cumulativePercentage += percentage;
    return part;
  });

  const conicGradient = `conic-gradient(${gradientParts.join(', ')})`;

  return (
    <div className="flex flex-col md:flex-row items-center justify-center gap-8">
      <div 
        className="w-48 h-48 rounded-full"
        style={{ background: conicGradient }}
        role="img"
        aria-label="Pie chart showing work type breakdown"
      />
      <div className="space-y-2">
        {data.map(item => (
          <div key={item.label} className="flex items-center gap-3 text-sm">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: item.color }} />
            <span className="text-slate-300">{item.label}</span>
            <span className="font-semibold text-white">{((item.value / total) * 100).toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
};

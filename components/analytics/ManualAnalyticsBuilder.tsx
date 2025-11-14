

import React, { useState } from 'react';
import { AnalyticsQuery, AnalysisType, Timeframe, ScheduleItemType, SessionStatus } from '../../types';

interface ManualAnalyticsBuilderProps {
  onGenerateQuery: (query: AnalyticsQuery) => void;
}

const analysisTypeOptions: { label: string, value: AnalysisType }[] = [
    { label: 'Session Count', value: 'SESSION_COUNT' },
    { label: 'Total Duration', value: 'TOTAL_DURATION' },
    { label: 'Average Focus', value: 'AVERAGE_FOCUS' },
    { label: 'Type Breakdown', value: 'TYPE_BREAKDOWN' },
];

const timeframeOptions: { label: string, value: Timeframe }[] = [
    { label: 'Today', value: 'TODAY' },
    { label: 'Last 7 Days', value: 'LAST_7_DAYS' },
    { label: 'This Month', value: 'THIS_MONTH' },
    { label: 'All Time', value: 'ALL_TIME' },
];

// Fix: Use enum members for values instead of string literals to match the defined types.
const taskTypeOptions: { label: string, value: ScheduleItemType | 'ALL' }[] = [
    { label: 'All Types', value: 'ALL' },
    { label: 'Deep Work', value: ScheduleItemType.DEEP_WORK },
    { label: 'Shallow Work', value: ScheduleItemType.SHALLOW_WORK },
    { label: 'AI Assisted', value: ScheduleItemType.AI_ASSISTED_WORK },
];

// Fix: Use enum members for values instead of string literals to match the defined types.
const statusOptions: { label: string, value: SessionStatus | 'ALL' }[] = [
    { label: 'All Statuses', value: 'ALL' },
    { label: 'Pending', value: SessionStatus.PENDING },
    { label: 'Completed', value: SessionStatus.COMPLETED },
];

export const ManualAnalyticsBuilder: React.FC<ManualAnalyticsBuilderProps> = ({ onGenerateQuery }) => {
  const [analysisType, setAnalysisType] = useState<AnalysisType>('SESSION_COUNT');
  const [timeframe, setTimeframe] = useState<Timeframe>('THIS_MONTH');
  const [taskTypeFilter, setTaskTypeFilter] = useState<ScheduleItemType | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<SessionStatus | 'ALL'>('ALL');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const selectedAnalysis = analysisTypeOptions.find(opt => opt.value === analysisType);
    const selectedTimeframe = timeframeOptions.find(opt => opt.value === timeframe);
    const selectedType = taskTypeOptions.find(opt => opt.value === taskTypeFilter);
    const selectedStatus = statusOptions.find(opt => opt.value === statusFilter);

    const titleParts = [selectedAnalysis?.label];
    if (taskTypeFilter !== 'ALL') titleParts.push(selectedType?.label);
    if (statusFilter !== 'ALL') titleParts.push(selectedStatus?.label);
    titleParts.push(`(${selectedTimeframe?.label})`);

    const query: AnalyticsQuery = {
      analysisType,
      timeframe,
      filters: {
        taskType: taskTypeFilter === 'ALL' ? undefined : taskTypeFilter,
        status: statusFilter === 'ALL' ? undefined : statusFilter,
      },
      chartType: analysisType === 'TYPE_BREAKDOWN' ? 'PIE_CHART' : 'STAT_CARD',
      title: titleParts.join(' '),
    };
    onGenerateQuery(query);
  };

  const SelectInput: React.FC<{
    label: string,
    value: string,
    onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void,
    options: { label: string, value: string }[]
  }> = ({ label, value, onChange, options }) => (
    <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">{label}</label>
        <select
            value={value}
            onChange={onChange}
            className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-white placeholder-slate-400 focus:ring-2 focus:ring-cyan-500"
        >
            {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
    </div>
  );

  return (
    <div className="w-full max-w-2xl mx-auto bg-slate-800 p-6 rounded-lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SelectInput 
                label="Analysis Type"
                value={analysisType}
                onChange={e => setAnalysisType(e.target.value as AnalysisType)}
                options={analysisTypeOptions}
            />
             <SelectInput 
                label="Timeframe"
                value={timeframe}
                onChange={e => setTimeframe(e.target.value as Timeframe)}
                options={timeframeOptions}
            />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SelectInput 
                label="Filter by Task Type"
                value={taskTypeFilter}
                onChange={e => setTaskTypeFilter(e.target.value as ScheduleItemType | 'ALL')}
                options={taskTypeOptions}
            />
             <SelectInput 
                label="Filter by Status"
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value as SessionStatus | 'ALL')}
                options={statusOptions}
            />
        </div>
        <div className="pt-2">
            <button type="submit" className="w-full py-3 bg-cyan-600 text-white font-bold rounded-md hover:bg-cyan-700 transition">
                Generate Chart
            </button>
        </div>
      </form>
    </div>
  );
};
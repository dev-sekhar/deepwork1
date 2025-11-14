import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { ScheduleItem, AnalyticsQuery, SessionStatus, ScheduleItemType, Timeframe, AnalysisType, Feedback } from '../../types';
import { getAnalyticsQuery, RateLimitError } from '../../services/geminiService';
import { PaperAirplaneIcon, SparklesIcon } from '../icons';
import { StatCard } from './StatCard';
import { SimplePieChart } from './SimplePieChart';
import { SimpleBarChart } from './SimpleBarChart';
import { ManualAnalyticsBuilder } from './ManualAnalyticsBuilder';

interface AnalyticsViewProps {
  schedule: ScheduleItem[];
  onBack: () => void;
}

const TYPE_COLORS: { [key in ScheduleItemType]: string } = {
    [ScheduleItemType.DEEP_WORK]: '#4ade80', // green-400
    [ScheduleItemType.SHALLOW_WORK]: '#fb923c', // orange-400
    [ScheduleItemType.AI_ASSISTED_WORK]: '#a78bfa', // violet-400
};

// Helper function to get all tasks for a specific date, including recurring ones.
const getTasksForDate = (schedule: ScheduleItem[], date: Date): ScheduleItem[] => {
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);

    const dayOfWeek = checkDate.getDay();
    const dayOfMonth = checkDate.getDate();
    
    const tasks = schedule.filter(item => {
        const itemStartDate = new Date(item.startDate);
        itemStartDate.setHours(0, 0, 0, 0);

        if (item.repeatFrequency === 'ONCE') {
            return itemStartDate.getTime() === checkDate.getTime();
        }

        if (itemStartDate.getTime() > checkDate.getTime()) {
            return false;
        }

        switch (item.repeatFrequency) {
            case 'DAILY':
                return true;
            case 'WEEKLY':
                return item.repeatOn?.includes(dayOfWeek) ?? false;
            case 'MONTHLY':
                return itemStartDate.getDate() === dayOfMonth;
            default:
                return false;
        }
    });

    return tasks;
};

const generateExplanation = (query: AnalyticsQuery): string | null => {
    if (!query?.analysisType) return null;

    const analysisPrefix = {
        'TOTAL_DURATION': 'Showing total duration of',
        'SESSION_COUNT': 'Showing total count of',
        'AVERAGE_FOCUS': 'Showing average focus score for',
        'TYPE_BREAKDOWN': 'Showing time breakdown across',
    }[query.analysisType];

    const timeframeSuffix = {
        'TODAY': 'today',
        'LAST_7_DAYS': 'in the last 7 days',
        'THIS_MONTH': 'this month',
        'ALL_TIME': 'for all time',
    }[query.timeframe];

    let subject = '';
    const status = query.filters?.status?.toLowerCase();
    const type = query.filters?.taskType?.replace(/_/g, ' ').toLowerCase();

    if (status && type) {
        subject = `${status} ${type} sessions`;
    } else if (status) {
        subject = `${status} sessions of all types`;
    } else if (type) {
        subject = `all ${type} sessions`;
    } else {
        subject = 'all sessions';
    }
    
    if (query.analysisType === 'TYPE_BREAKDOWN') {
        subject = subject.replace('sessions', 'types');
    }

    return `${analysisPrefix} ${subject} ${timeframeSuffix}.`;
};


export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ schedule, onBack }) => {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [analyticsResult, setAnalyticsResult] = useState<AnalyticsQuery | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resultSource, setResultSource] = useState<'AI' | 'MANUAL' | null>(null);
  const [aiNotification, setAiNotification] = useState<string | null>(null);
  const [rateLimitResetTime, setRateLimitResetTime] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [limitType, setLimitType] = useState<'MINUTE' | 'DAY' | null>(null);


  const handleModelSwitch = useCallback((modelName: string) => {
    setAiNotification(`Switching to fallback model (${modelName})...`);
    setTimeout(() => setAiNotification(null), 4000);
  }, []);

  const handleQuerySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsLoading(true);
    setError(null);
    setAnalyticsResult(null);
    setResultSource(null);
    setRateLimitResetTime(null);
    setCountdown(null);
    if (limitType !== 'DAY') {
        setLimitType(null);
    }

    try {
        const result = await getAnalyticsQuery(query, handleModelSwitch);
        if (result) {
            if (result.error) {
                setError(result.error);
            } else {
                setAnalyticsResult(result);
                setResultSource('AI');
            }
        } else {
            setError("An unexpected error occurred.");
        }
    } catch (err: any) {
        if (err instanceof RateLimitError) {
            setLimitType(err.limitType);
            if (err.limitType === 'DAY') {
                setError("You've reached the daily AI query limit.");
            } else { // MINUTE
                setError("AI models have reached their per-minute rate limit.");
                setRateLimitResetTime(new Date(Date.now() + 60 * 1000));
            }
        } else {
            setError("Sorry, I couldn't process that request.");
            setLimitType(null);
        }
    }

    setIsLoading(false);
    setQuery('');
  };

  useEffect(() => {
    if (!rateLimitResetTime) {
        return;
    }
    
    const intervalId = setInterval(() => {
        const secondsLeft = Math.ceil((rateLimitResetTime.getTime() - Date.now()) / 1000);
        if (secondsLeft > 0) {
            setCountdown(secondsLeft);
        } else {
            setCountdown(null);
            setRateLimitResetTime(null);
            setError(null);
            setLimitType(null);
            clearInterval(intervalId);
        }
    }, 1000);
    
    // Initial countdown value
    setCountdown(Math.ceil((rateLimitResetTime.getTime() - Date.now()) / 1000));

    return () => clearInterval(intervalId);
  }, [rateLimitResetTime]);

  const handleManualQuery = (manualQuery: AnalyticsQuery) => {
    setAnalyticsResult(manualQuery);
    setResultSource('MANUAL');
  }

  const filteredData = useMemo(() => {
    if (!analyticsResult) return [];
    
    const filters = analyticsResult.filters || {};
    const statusFilter = filters.status;
    const typeFilter = filters.taskType;

    const applyFilters = (item: ScheduleItem) => {
        const statusMatch = statusFilter ? item.status === statusFilter : true;
        const typeMatch = typeFilter ? item.type === typeFilter : true;
        return statusMatch && typeMatch;
    };

    if (analyticsResult.timeframe === 'TODAY') {
        const now = new Date();
        const todaysTasks = getTasksForDate(schedule, now);
        return todaysTasks.filter(applyFilters);
    }

    const now = new Date();
    let startDate = new Date(0);
    switch (analyticsResult.timeframe) {
        case 'LAST_7_DAYS':
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
            break;
        case 'THIS_MONTH':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            break;
        case 'ALL_TIME':
        default:
            break;
    }

    return schedule.filter(item => {
        const itemDate = new Date(item.startDate);
        const dateMatch = itemDate >= startDate;
        if (!dateMatch) return false;
        return applyFilters(item);
    });
  }, [analyticsResult, schedule]);

  const renderChart = () => {
    if (!analyticsResult || !analyticsResult.analysisType) return null;

    const themeColor = resultSource === 'AI' ? 'cyan' : 'green';
    const explanation = generateExplanation(analyticsResult);

    const ChartWrapper: React.FC<{children: React.ReactNode}> = ({ children }) => (
        <div className="w-full animate-fade-in-up">
            {children}
            {explanation && (
                <p className="text-center text-sm text-slate-400 mt-4 italic max-w-md mx-auto">
                    {explanation}
                </p>
            )}
        </div>
    );

    if (filteredData.length === 0 && analyticsResult.analysisType !== 'SESSION_COUNT' && analyticsResult.analysisType !== 'TOTAL_DURATION') {
        return (
            <div className="text-center text-slate-400 bg-slate-800 p-6 rounded-lg">
                <h3 className="text-xl font-semibold mb-2">{analyticsResult.title}</h3>
                <p>No sessions match your query.</p>
            </div>
        );
    }
    
    switch (analyticsResult.analysisType) {
      case 'TOTAL_DURATION': {
        const totalMinutes = filteredData.reduce((sum, item) => sum + item.durationMinutes, 0);
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        return <ChartWrapper><StatCard title={analyticsResult.title} value={`${hours}h ${minutes}m`} themeColor={themeColor} /></ChartWrapper>;
      }
      case 'SESSION_COUNT': {
        return <ChartWrapper><StatCard title={analyticsResult.title} value={filteredData.length.toString()} themeColor={themeColor} /></ChartWrapper>;
      }
      // Fix: Correctly calculate average focus by iterating through completions instead of assuming a 'feedback' property on ScheduleItem.
      case 'AVERAGE_FOCUS': {
        const typeFilter = analyticsResult.filters?.taskType;
        const statusFilter = analyticsResult.filters?.status;

        // If filtering by PENDING status, there's no feedback to average.
        if (statusFilter === SessionStatus.PENDING) {
             return <ChartWrapper><StatCard title={analyticsResult.title} value="N/A" themeColor={themeColor} /></ChartWrapper>;
        }

        const now = new Date();
        now.setHours(0,0,0,0); // for day-level comparison
        let startDate = new Date(0);
        
        switch (analyticsResult.timeframe) {
            case 'TODAY':
                startDate = now;
                break;
            case 'LAST_7_DAYS':
                startDate = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
                break;
            case 'THIS_MONTH':
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                break;
            // 'ALL_TIME' uses default startDate
        }

        const allFeedbacks: Feedback[] = schedule.flatMap(item => {
            if (typeFilter && item.type !== typeFilter) {
                return [];
            }
            return item.completions || [];
        })
        .filter(completion => {
            if (!completion.feedback) return false;
            
            // Fix timezone issue by creating date in local time
            const [y, m, d] = completion.date.split('-').map(Number);
            const completionDate = new Date(y, m - 1, d);

            return completionDate >= startDate;
        })
        .map(completion => completion.feedback!);


        if (allFeedbacks.length === 0) {
            return <ChartWrapper><StatCard title={analyticsResult.title} value="N/A" themeColor={themeColor} /></ChartWrapper>;
        }
        const totalFocus = allFeedbacks.reduce((sum, item) => sum + (item.focusQuality || 0), 0);
        const avgFocus = (totalFocus / allFeedbacks.length).toFixed(1);
        return <ChartWrapper><StatCard title={analyticsResult.title} value={`${avgFocus} / 5`} themeColor={themeColor} /></ChartWrapper>;
      }
      case 'TYPE_BREAKDOWN': {
        const breakdown = filteredData.reduce((acc, item) => {
            acc[item.type] = (acc[item.type] || 0) + item.durationMinutes;
            return acc;
        }, {} as { [key in ScheduleItemType]?: number });

        const chartData = Object.entries(breakdown).map(([key, value]) => ({
            label: key.replace(/_/g, ' ').replace('WORK', '').trim(),
            value,
            color: TYPE_COLORS[key as ScheduleItemType]
        }));
        
        if (chartData.length === 0) {
             return (
                 <div className="text-center text-slate-400 bg-slate-800 p-6 rounded-lg">
                    <h3 className="text-xl font-semibold mb-2">{analyticsResult.title}</h3>
                    <p>No data available for this breakdown.</p>
                </div>
            );
        }

        if (analyticsResult.chartType === 'BAR_CHART') {
            const barChartData = chartData.map(d => ({ label: d.label, value: d.value }));
            return <ChartWrapper><SimpleBarChart data={barChartData} title={analyticsResult.title} themeColor={themeColor} /></ChartWrapper>;
        }

        return (
            <ChartWrapper>
                <div className="bg-slate-800 p-6 rounded-lg">
                    <h3 className="text-lg font-semibold text-white text-center mb-4">{analyticsResult.title}</h3>
                    <SimplePieChart data={chartData} />
                </div>
            </ChartWrapper>
        );
      }
      default:
        return null;
    }
  };

  const renderContent = () => {
    if (isLoading) {
        return (
            <div className="flex flex-col items-center gap-4 text-slate-300">
                <SparklesIcon className="w-12 h-12 animate-spin text-cyan-400" />
                <p>Analyzing your data...</p>
            </div>
        );
    }
    
    if (limitType) {
        return (
            <div className="w-full animate-fade-in space-y-6">
                <div className={`text-center p-4 rounded-lg ${limitType === 'MINUTE' ? 'bg-yellow-900/40' : 'bg-red-500/10'}`}>
                    <p className={`font-semibold ${limitType === 'MINUTE' ? 'text-yellow-400' : 'text-red-400'}`}>{error}</p>
                    {limitType === 'MINUTE' && (
                        <p className="text-sm text-slate-300 mt-1">
                            You can use manual mode, or wait {countdown || '...'}s for AI to return.
                        </p>
                    )}
                </div>
                <ManualAnalyticsBuilder onGenerateQuery={handleManualQuery} />
                {analyticsResult && renderChart()}
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center text-red-400 bg-red-500/10 p-4 rounded-lg">
                <p><strong>Oops! An error occurred.</strong></p>
                <p>{error}</p>
            </div>
        );
    }
    
    if (analyticsResult) {
        return <div className="w-full h-full flex items-center justify-center animate-fade-in">{renderChart()}</div>;
    }

    return (
        <div className="text-center text-slate-400">
            <h3 className="text-xl font-semibold mb-2">Ask me anything about your productivity.</h3>
            <p className="text-sm">Try things like:</p>
            <ul className="text-xs mt-2 space-y-1">
                <li>"Show me my total deep work hours"</li>
                <li>"How many sessions did I complete last week?"</li>
                <li>"Breakdown of my work this month"</li>
            </ul>
        </div>
    );
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-4 flex flex-col h-[calc(100vh-100px)] animate-fade-in-up relative">
       {aiNotification && (
        <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-blue-500/80 backdrop-blur-sm text-white text-sm font-semibold px-4 py-2 rounded-full shadow-lg animate-fade-in-down z-20">
            {aiNotification}
        </div>
      )}
      <div className="mb-6">
        <div className="mb-4">
            <button onClick={onBack} className="text-slate-400 hover:text-white transition whitespace-nowrap">
                &larr; Back to Dashboard
            </button>
        </div>
        <h2 className="text-3xl font-bold text-cyan-400 text-center">
            {limitType ? "Analytics Dashboard (Manual)" : "Analytics Dashboard"}
        </h2>
      </div>

      <div className="flex-grow bg-slate-800/50 rounded-lg p-6 overflow-y-auto">
        {renderContent()}
      </div>

      {!limitType && (
          <form onSubmit={handleQuerySubmit} className="mt-6 flex gap-2 animate-fade-in">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g., How much deep work did I do this month?"
              className="flex-1 bg-slate-700 border border-slate-600 rounded-md px-4 py-3 text-white placeholder-slate-400 focus:ring-2 focus:ring-cyan-500 transition"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !query.trim()}
              className="p-4 bg-cyan-600 text-white rounded-md hover:bg-cyan-700 transition disabled:bg-slate-600 disabled:cursor-not-allowed"
              aria-label="Send query"
            >
              <PaperAirplaneIcon className="w-5 h-5" />
            </button>
          </form>
      )}
    </div>
  );
};





export enum SessionStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  COMPLETED = 'COMPLETED',
}

export enum ScheduleItemType {
  DEEP_WORK = 'DEEP_WORK',
  SHALLOW_WORK = 'SHALLOW_WORK',
  // Fix: Add AI_ASSISTED_WORK type for the new feature.
  AI_ASSISTED_WORK = 'AI_ASSISTED_WORK',
}


export interface Feedback {
  focusQuality: number; // 1-5
  mood: 'focused' | 'distracted' | 'tired' | null;
  interruptions: string;
}

export interface RitualItem {
  text: string;
  completed: boolean;
}

// Fix: Add ChatMessage type for AI chat history.
export interface ChatMessage {
  role: 'user' | 'model';
  parts: Array<{ text: string }>;
}

export interface GoalAnalysisResult {
  isSMART: boolean;
  feedback: string;
  suggestion?: string;
}

export interface CompletionRecord {
  date: string; // YYYY-MM-DD
  feedback: Feedback | null;
}

export interface BaseScheduleItem {
  id: string;
  taskName: string;
  durationMinutes: number;
  startDate: string; // ISO string for the start date and time
  endDate?: string | null; // Optional: ISO string for when a recurring task ends
  repeatFrequency: 'ONCE' | 'DAILY' | 'WEEKLY' | 'MONTHLY';
  repeatOn: number[] | null; // e.g., [1, 3, 5] for Mon, Wed, Fri (0=Sun, 6=Sat)
  isCancelled?: boolean; // For logically deleting one-time tasks
  pauses?: { startDate: string; endDate: string; reason: string }[]; // To track pause periods
  completions?: CompletionRecord[];
}

export interface DeepWorkSession extends BaseScheduleItem {
  type: ScheduleItemType.DEEP_WORK;
  goal: string;
  status: SessionStatus;
  ritual: string[] | null;
  ritualChecklist: RitualItem[] | null;
  workspaceImageUrl: string | null;
  wasCreatedWithAI?: boolean;
}

export interface ShallowWorkTask extends BaseScheduleItem {
  type: ScheduleItemType.SHALLOW_WORK;
  status: SessionStatus;
}

// Fix: Add AIAssistedWorkSession for the new feature.
export interface AIAssistedWorkSession extends BaseScheduleItem {
  type: ScheduleItemType.AI_ASSISTED_WORK;
  status: SessionStatus;
  chatHistory: ChatMessage[];
}

// Add types for the new Analytics Dashboard feature.
export type AnalysisType = 'TOTAL_DURATION' | 'SESSION_COUNT' | 'AVERAGE_FOCUS' | 'TYPE_BREAKDOWN';
export type Timeframe = 'TODAY' | 'LAST_7_DAYS' | 'THIS_MONTH' | 'ALL_TIME';
export type ChartType = 'STAT_CARD' | 'PIE_CHART' | 'BAR_CHART' | 'NOT_APPLICABLE';

export interface AnalyticsQuery {
  analysisType: AnalysisType | null;
  timeframe: Timeframe;
  filters: {
    taskType?: ScheduleItemType;
    status?: SessionStatus;
  };
  chartType: ChartType;
  title: string;
  error?: string;
}


export type ScheduleItem = DeepWorkSession | ShallowWorkTask | AIAssistedWorkSession;
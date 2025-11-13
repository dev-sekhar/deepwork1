
export enum SessionStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  COMPLETED = 'COMPLETED',
}

// Fix: Add AI_ASSISTED_WORK to ScheduleItemType enum.
export enum ScheduleItemType {
  DEEP_WORK = 'DEEP_WORK',
  SHALLOW_WORK = 'SHALLOW_WORK',
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

// Fix: Add ChatPart and ChatMessage types for AI chat feature.
export interface ChatPart {
  text: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  parts: ChatPart[];
}

export interface GoalAnalysisResult {
  isSMART: boolean;
  feedback: string;
  suggestion?: string;
}

export interface BaseScheduleItem {
  id: string;
  taskName: string;
  durationMinutes: number;
  startDate: string; // ISO string for the start date and time
  repeatFrequency: 'ONCE' | 'DAILY' | 'WEEKLY' | 'MONTHLY';
  repeatOn: number[] | null; // e.g., [1, 3, 5] for Mon, Wed, Fri (0=Sun, 6=Sat)
}

export interface DeepWorkSession extends BaseScheduleItem {
  type: ScheduleItemType.DEEP_WORK;
  goal: string;
  status: SessionStatus;
  feedback: Feedback | null;
  ritual: string[] | null;
  ritualChecklist: RitualItem[] | null;
  workspaceImageUrl: string | null;
}

export interface ShallowWorkTask extends BaseScheduleItem {
  type: ScheduleItemType.SHALLOW_WORK;
  status: SessionStatus;
  feedback: Feedback | null;
}

// Fix: Add AIAssistedWorkSession interface for the new session type.
export interface AIAssistedWorkSession extends BaseScheduleItem {
  type: ScheduleItemType.AI_ASSISTED_WORK;
  status: SessionStatus;
  feedback: Feedback | null;
  chatHistory: ChatMessage[];
}

// Fix: Add AIAssistedWorkSession to the ScheduleItem union type.
export type ScheduleItem = DeepWorkSession | ShallowWorkTask | AIAssistedWorkSession;
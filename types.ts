export enum SessionStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  COMPLETED = 'COMPLETED',
}

export enum ScheduleItemType {
  DEEP_WORK = 'DEEP_WORK',
  SHALLOW_WORK = 'SHALLOW_WORK',
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

export interface BaseScheduleItem {
  id: string;
  taskName: string;
  durationMinutes: number;
  startDate: string; // ISO string for the start date and time
  repeatFrequency: 'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY';
  repeatOn: number[] | null; // e.g., [1, 3, 5] for Mon, Wed, Fri (0=Sun, 6=Sat)
}

export interface DeepWorkSession extends BaseScheduleItem {
  type: ScheduleItemType.DEEP_WORK;
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

export type ScheduleItem = DeepWorkSession | ShallowWorkTask;
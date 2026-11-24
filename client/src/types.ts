export type HabitType = 'binary' | 'counter';
export type HabitStatus = 'active' | 'archive';
export type DayCode = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
export type HeatState = 'done' | 'skipped' | 'partial' | 'unmarked' | 'unscheduled';

export interface User {
  id: string;
  email: string;
  name: string;
  timezone: string;
  createdAt: string;
}

export interface Habit {
  id: string;
  name: string;
  type: HabitType;
  frequency: DayCode[];
  target: number | null;
  unit: string | null;
  description: string | null;
  status: HabitStatus;
  created_at: string;
  updated_at: string;
}

export interface HabitInput {
  name: string;
  type: HabitType;
  frequency: DayCode[];
  target?: number | null;
  unit?: string | null;
  description?: string | null;
  status?: HabitStatus;
}

export interface RecordItem {
  id: string;
  user_id: string;
  habit_id: string;
  date: string;
  value: number;
  created_at: string;
  updated_at: string;
}

export interface HeatmapDay {
  date: string;
  state: HeatState;
  value?: number | null;
  done?: number;
  scheduled?: number;
}

export interface Rate {
  completed: number;
  scheduled: number;
  percent: number;
}

export interface HabitStat {
  id: string;
  name: string;
  type: HabitType;
  target: number | null;
  unit: string | null;
  status: HabitStatus;
  streak: number;
  completion7d: Rate;
  completion30d: Rate;
  heatmap: HeatmapDay[];
}

export interface ChartData {
  period: 'week' | 'month';
  labels: string[];
  datasets: Array<{
    habitId: string;
    name: string;
    unit: string;
    data: Array<number | null>;
  }>;
}

export interface Stats {
  today: string;
  timezone: string;
  summary: {
    totalCompletedDays: number;
    currentStreak: number;
    completion7d: Rate;
    completion30d: Rate;
  };
  heatmap: HeatmapDay[];
  habits: HabitStat[];
  chart: ChartData;
}

export interface PublicConfig {
  appName: string;
  version: string;
  pushEnabled: boolean;
  vapidPublicKey: string | null;
  reminderTime: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  devToken?: string;
  devUrl?: string;
}

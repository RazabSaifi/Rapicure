export type TriagePriority = 'HIGH' | 'MODERATE' | 'LOW';

export interface TriageVitals {
  bp: string;
  pulse: string;
  temp: string;
  spo2: string;
}

export interface PatientInfo {
  token: string;
  name: string;
  age: string;
  gender: string;
  queueTime: string;
}

export interface AttachedImage {
  data: string; // base64 string
  mimeType: string;
  name: string;
  previewUrl: string;
  sizeKb?: number;
}

export interface TriageResult {
  priority: TriagePriority;
  priority_reason: string;
  subjective: string;
  objective: string;
  red_flags: string;
  plan: string[];
  source?: string;
  timestamp?: string;
  actionsCompleted?: Record<number, boolean>;
}

export interface DemoCase {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  language: 'hi-IN' | 'en-IN';
  patientInfo: PatientInfo;
  vitals: TriageVitals;
  symptoms: string;
  hasSampleReport?: boolean;
  sampleReportName?: string;
  sampleReportSummary?: string;
}

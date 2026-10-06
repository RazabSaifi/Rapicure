export type PriorityLevel = "HIGH" | "MODERATE" | "ROUTINE";

export interface VitalsData {
  bpSystolic: string;
  bpDiastolic: string;
  pulse: string;
  temp: string;
  spo2: string;
}

export interface PatientInfo {
  name: string;
  age: string;
  gender: "Male" | "Female" | "Other";
  uhid: string;
  tokenNo: string;
}

export interface ChatMessage {
  id: string;
  sender: "patient" | "gemini";
  text: string;
  timestamp: string;
}

export interface GeminiSOAPResponse {
  priority: PriorityLevel;
  priority_reason: string;
  subjective: string;
  objective: string;
  red_flags: string;
  doctor_audio_brief: string;
  plan: string[];
}

export interface TriageResult extends GeminiSOAPResponse {
  patientInfo: PatientInfo;
  vitals: VitalsData;
  narrativeText: string;
  timestamp: string;
  labImagePreview?: string | null;
  conversationHistory?: ChatMessage[];
}

export interface DemoCase {
  id: string;
  name: string;
  description: string;
  patientInfo: PatientInfo;
  vitals: VitalsData;
  narrative: string;
  language: "hi-IN" | "en-IN";
  labImageBase64?: string;
  simulatedResponse: GeminiSOAPResponse;
}

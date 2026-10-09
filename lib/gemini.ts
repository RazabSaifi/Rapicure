import { GeminiSOAPResponse, VitalsData, PatientInfo, ChatMessage } from "./types";
import { DEMO_CASES } from "./demoData";

/**
 * Multi-turn Conversational AI Nurse/Doctor Assistant for Pre-OPD Voice Intake
 * Uses server-side API proxy route `/api/gemini/converse` with process.env.GEMINI_API_KEY
 */
export async function converseClinicalIntakeWithGemini(params: {
  apiKey?: string;
  language: "hi-IN" | "en-IN";
  conversationHistory: ChatMessage[];
  patientInput: string;
  patientInfo?: PatientInfo;
  vitals?: VitalsData;
  voiceName?: "Aoede" | "Charon" | "Puck" | "Kore" | "Fenrir";
}): Promise<{
  reply: string;
  spokenRomaji?: string;
  audioBase64?: string | null;
  voiceMode?: string;
}> {
  const {
    apiKey,
    language,
    conversationHistory = [],
    patientInput,
    patientInfo,
    vitals,
    voiceName = "Aoede",
  } = params;

  try {
    const res = await fetch("/api/gemini/converse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apiKey,
        language,
        conversationHistory,
        patientInput,
        patientInfo,
        vitals,
        voiceName,
      }),
    });

    if (!res.ok) {
      throw new Error(`Server returned ${res.status}`);
    }

    const data = await res.json();
    return {
      reply:
        data.reply ||
        (language === "hi-IN"
          ? "मैं समझ गया। कृपया बताएं कि क्या आपको पेट में दर्द या चक्कर भी आ रहे हैं?"
          : "I understand. Are you experiencing any dizziness or severe discomfort?"),
      spokenRomaji: data.spokenRomaji || data.reply,
      audioBase64: data.audioBase64 || null,
      voiceMode: data.voiceMode || "neural_tts",
    };
  } catch (error) {
    console.warn("Converse API error, utilizing clinical fallback:", error);
    if (language === "hi-IN") {
      if (conversationHistory.length === 0) {
        return {
          reply: "नमस्ते! मैं रापिक्योर (RapiCure) एआई हूँ। कृपया बताइए कि आपको क्या तकलीफ हो रही है?",
          spokenRomaji: "Namaste! Main RapiCure AI hoon. Kripya batayein ki aapko kya takleef ho rahi hai?",
          audioBase64: null,
          voiceMode: "offline_fallback",
        };
      }
      return {
        reply: "क्या आपको बुखार या दर्द के साथ चक्कर, उल्टी या सांस लेने में परेशानी महसूस हो रही है?",
        spokenRomaji: "Kya aapko bukhar ya dard ke saath chakkar, ulti ya saans lene mein pareshani mehsoos ho rahi hai?",
        audioBase64: null,
        voiceMode: "offline_fallback",
      };
    } else {
      if (conversationHistory.length === 0) {
        return {
          reply: "Hello! I am RapiCure AI. Please describe your symptoms and when they started.",
          spokenRomaji: "Hello! I am RapiCure AI. Please describe your symptoms and when they started.",
        };
      }
      return {
        reply: "I understand. Are you experiencing any severe dizziness, vomiting, or difficulty breathing?",
        spokenRomaji: "I understand. Are you experiencing any severe dizziness, vomiting, or difficulty breathing?",
      };
    }
  }
}

/**
 * Final Multimodal SOAP Synthesis from Conversation History / Transcripts + Vitals + Lab
 * Uses server-side API proxy route `/api/gemini/triage` with process.env.GEMINI_API_KEY
 */
export async function processClinicalTriageWithGemini(params: {
  apiKey?: string;
  narrativeText: string;
  vitals: VitalsData;
  patientInfo: PatientInfo;
  labImageBase64?: string | null;
  conversationHistory?: ChatMessage[];
  useFailsafeFallback?: boolean;
}): Promise<GeminiSOAPResponse> {
  const {
    apiKey,
    narrativeText,
    vitals,
    patientInfo,
    labImageBase64,
    conversationHistory = [],
    useFailsafeFallback,
  } = params;

  try {
    const response = await fetch("/api/gemini/triage", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        apiKey,
        narrativeText,
        vitals,
        patientInfo,
        labImageBase64,
        conversationHistory,
      }),
    });

    if (!response.ok) {
      throw new Error(`Server returned HTTP ${response.status}`);
    }

    const data: GeminiSOAPResponse = await response.json();
    return data;
  } catch (err: any) {
    console.error("Clinical Triage AI Error:", err);
    if (useFailsafeFallback !== false) {
      console.warn("Falling back to simulated demo result due to error:", err.message);
      return DEMO_CASES[0].simulatedResponse;
    }
    throw err;
  }
}

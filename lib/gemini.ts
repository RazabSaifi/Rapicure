import { GeminiSOAPResponse, VitalsData, PatientInfo, ChatMessage } from "./types";
import { DEMO_CASES } from "./demoData";

/**
 * Multi-turn Conversational AI Nurse/Doctor Assistant for Pre-OPD Voice Intake
 * Uses server-side API proxy route `/api/gemini/converse` with process.env.GEMINI_API_KEY
 */
export async function converseClinicalIntakeWithGemini(params: {
  apiKey?: string;
  elevenLabsApiKey?: string;
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
  isLiveAI?: boolean;
}> {
  const {
    apiKey,
    elevenLabsApiKey,
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
        elevenLabsApiKey,
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
      isLiveAI: data.isLiveAI ?? false,
    };
  } catch (error) {
    console.warn("Converse API error, utilizing clinical fallback:", error);
    const turnCount = Math.floor((conversationHistory || []).length / 2);

    if (language === "hi-IN") {
      if (turnCount === 0) {
        return {
          reply: "नमस्ते! मैं रापिक्योर (RapiCure) एआई हूँ। कृपया बताइए कि आपको क्या तकलीफ हो रही है?",
          spokenRomaji: "Namaste! Main RapiCure AI hoon. Kripya batayein ki aapko kya takleef ho rahi hai?",
          audioBase64: null,
          voiceMode: "offline_fallback",
        };
      }
      if (turnCount === 1) {
        return {
          reply: "यह तकलीफ कितने दिनों से शुरू हुई है और क्या इसके साथ कमजोरी या चक्कर आ रहे हैं?",
          spokenRomaji: "Yeh takleef kitne dino se shuru hui hai aur kya iske saath kamzori ya chakkar aa rahe hain?",
          audioBase64: null,
          voiceMode: "offline_fallback",
        };
      }
      if (turnCount === 2) {
        return {
          reply: "क्या आपने इसके लिए कोई दवा ली है, और क्या दर्द या बुखार में कोई आराम मिला?",
          spokenRomaji: "Kya aapne iske liye koi dawa li hai, aur kya dard ya bukhar mein koi aaram mila?",
          audioBase64: null,
          voiceMode: "offline_fallback",
        };
      }
      return {
        reply: "मैंने आपके लक्षण दर्ज कर लिए हैं। कृपया नीचे 'Finish & Generate SOAP Note' बटन दबाकर ओपीडी पर्ची तैयार करें।",
        spokenRomaji: "Maine aapke lakshan darj kar liye hain. Kripya neeche Finish & Generate SOAP Note button dabakar OPD parchi taiyar karein.",
        audioBase64: null,
        voiceMode: "offline_fallback",
      };
    } else {
      if (turnCount === 0) {
        return {
          reply: "Hello! I am RapiCure AI. Please describe your symptoms and when they started.",
          spokenRomaji: "Hello! I am RapiCure AI. Please describe your symptoms and when they started.",
          audioBase64: null,
          voiceMode: "offline_fallback",
        };
      }
      if (turnCount === 1) {
        return {
          reply: "How many days ago did these symptoms begin, and are you feeling dizzy or weak?",
          spokenRomaji: "How many days ago did these symptoms begin, and are you feeling dizzy or weak?",
          audioBase64: null,
          voiceMode: "offline_fallback",
        };
      }
      if (turnCount === 2) {
        return {
          reply: "Have you taken any medications for relief, and has the discomfort improved?",
          spokenRomaji: "Have you taken any medications for relief, and has the discomfort improved?",
          audioBase64: null,
          voiceMode: "offline_fallback",
        };
      }
      return {
        reply: "I have recorded your symptoms. Please click 'Finish & Generate SOAP Note' below to generate your OPD slip.",
        spokenRomaji: "I have recorded your symptoms. Please click 'Finish & Generate SOAP Note' below to generate your OPD slip.",
        audioBase64: null,
        voiceMode: "offline_fallback",
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

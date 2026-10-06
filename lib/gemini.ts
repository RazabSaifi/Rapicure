import { GeminiSOAPResponse, VitalsData, PatientInfo, ChatMessage } from "./types";
import { DEMO_CASES } from "./demoData";

const GEMINI_API_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

/**
 * Multi-turn Conversational AI Nurse/Doctor Assistant for Pre-OPD Voice Intake
 */
export async function converseClinicalIntakeWithGemini(params: {
  apiKey: string;
  language: "hi-IN" | "en-IN";
  conversationHistory: ChatMessage[];
  patientInput: string;
  patientInfo?: PatientInfo;
  vitals?: VitalsData;
}): Promise<string> {
  const { apiKey, language, conversationHistory, patientInput, patientInfo, vitals } = params;

  // Failsafe fallback simulation if no API key is provided
  if (!apiKey) {
    await new Promise((resolve) => setTimeout(resolve, 800));
    if (language === "hi-IN") {
      if (conversationHistory.length === 0) {
        return "नमस्ते! मैं मेदअसिस्ट एआई हूँ। कृपया बताइए कि आपको क्या तकलीफ हो रही है और यह कब से शुरू हुई?";
      }
      if (patientInput.includes("बुखार") || patientInput.includes("fever") || patientInput.includes("ताप")) {
        return "क्या आपको बुखार के साथ ठंड या कंपकंपी लग रही है, और क्या सिर में या आँखों के पीछे दर्द है?";
      }
      if (patientInput.includes("दर्द") || patientInput.includes("pain") || patientInput.includes("पेट")) {
        return "क्या पेट में दर्द के साथ उल्टी या चक्कर भी आ रहे हैं? क्या शरीर पर कोई लाल चकत्ते या निशान दिखे हैं?";
      }
      return "समझ गया। क्या आपको सांस लेने में कोई परेशानी या बहुत ज्यादा कमजोरी महसूस हो रही है?";
    } else {
      if (conversationHistory.length === 0) {
        return "Hello! I am MedAssist AI. Please tell me what symptoms you are experiencing and since when?";
      }
      return "I understand. Are you also experiencing any severe pain, chills, vomiting, or dizziness?";
    }
  }

  const systemInstruction = `You are "MedAssist AI", an empathetic, intelligent pre-OPD clinical triage assistant at AIIMS Jodhpur hospital.
You are having an interactive SPOKEN voice conversation with a patient waiting outside the OPD cabin.

RULES FOR YOUR RESPONSE:
1. Spoken Language: ${
    language === "hi-IN"
      ? "Reply in natural, empathetic, conversational Hindi (using Devanagari script). Keep language simple and easy for patients from Rajasthan/North India."
      : "Reply in simple, clear, empathetic medical English."
  }
2. Brevity is Critical: You are speaking aloud over audio. Keep your reply strictly between 1 to 2 short sentences.
3. Clinical Goal: Acknowledge the patient's complaint with empathy, and ask ONE focused follow-up medical question (e.g. onset, severity, associated red-flag symptoms like chest pain, breathlessness, rash, chills, severe abdominal pain).
4. Do NOT diagnose or give prescription drugs yet; you are conducting the pre-consultation triage interview.
5. Return ONLY the spoken response text. Do not add markdown, quotes, or JSON formatting.`;

  // Build the conversation transcript
  const historyFormatted = conversationHistory
    .map((msg) => `${msg.sender === "patient" ? "Patient" : "MedAssist AI"}: ${msg.text}`)
    .join("\n");

  const promptText = `
PATIENT CONTEXT:
Name: ${patientInfo?.name || "Patient"}, Age: ${patientInfo?.age || "--"}, Gender: ${patientInfo?.gender || "--"}
Vitals: BP ${vitals?.bpSystolic || "--"}/${vitals?.bpDiastolic || "--"}, Pulse ${vitals?.pulse || "--"} bpm, Temp ${vitals?.temp || "--"}°F, SpO2 ${vitals?.spo2 || "--"}%

CONVERSATION TRANSCRIPT SO FAR:
${historyFormatted}

LATEST PATIENT INPUT:
"${patientInput}"

Provide your next spoken clinical response (1-2 short sentences only):`;

  try {
    const response = await fetch(`${GEMINI_API_ENDPOINT}?key=${apiKey.trim()}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: systemInstruction }],
        },
        contents: [
          {
            role: "user",
            parts: [{ text: promptText }],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 100,
        },
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err?.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
    return reply;
  } catch (error: any) {
    console.warn("Conversational AI Error:", error);
    // Fallback response
    return language === "hi-IN"
      ? "मैं आपकी बात समझ रहा हूँ। क्या आपको इसके अलावा शरीर में कोई और दर्द या परेशानी है?"
      : "I understand. Are you experiencing any other associated symptoms or severe discomfort?";
  }
}

/**
 * Final Multimodal SOAP Synthesis from Conversation History / Transcripts + Vitals + Lab
 */
export async function processClinicalTriageWithGemini(params: {
  apiKey: string;
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
    conversationHistory,
    useFailsafeFallback,
  } = params;

  // Fallback simulator if no API key is provided during live test
  if (!apiKey && useFailsafeFallback !== false) {
    console.warn("No Gemini API key provided; utilizing clinical failsafe simulation.");
    await new Promise((resolve) => setTimeout(resolve, 1400));
    return DEMO_CASES[0].simulatedResponse;
  }

  if (!apiKey) {
    throw new Error(
      "Gemini API key is required. Please set your API key in the top navigation bar."
    );
  }

  const systemInstruction = `You are an expert Clinical Triage Consultant & Medical Scribe AI operating in a high-volume Indian government tertiary hospital OPD (such as AIIMS or Dr. S.N. Medical College Jodhpur).
Your task is to review:
1. Patient Demographics: Name, Age, Gender.
2. Patient Chief Complaint & Multi-turn Conversational Transcript (spoken in vernacular Hindi/English/Hinglish).
3. 4 Standard Objective Vitals (BP, Pulse, Temperature °F, SpO2 %).
4. Optional attached diagnostic lab image (CBC, LFT, Prescription, or physical report).

Translate the informal narrative/conversation into professional, evidence-based medical English and synthesize a structured SOAP note.

CRITICAL INSTRUCTIONS:
- Identify and highlight life-threatening RED FLAGS immediately (e.g. Dengue Warning Signs, Impending Sepsis, Acute Coronary Syndrome, Acute Hypoxemic Respiratory Failure, Severe Dehydration, Malignant Hypertension).
- Stratify risk priority strictly into:
  - "HIGH": Immediate life threat, shock, severe hypoxemia, unstable vitals, dengue warning signs, petechiae, chest pain.
  - "MODERATE": Significant symptoms requiring prompt attention (high fever, severe localized pain, decompensating chronic illness).
  - "ROUTINE": Stable chronic illness followup, mild viral URTI, routine refill.
- Produce a crisp, 15-second natural spoken audio summary for the doctor's earphone briefing ("doctor_audio_brief").
- Return ONLY a valid, single JSON object adhering strictly to this schema:
{
  "priority": "HIGH" | "MODERATE" | "ROUTINE",
  "priority_reason": "string - 1-2 sentence clinical justification",
  "subjective": "string - structured clinical synthesis of history, symptoms, onset, aggravating/relieving factors in medical terminology",
  "objective": "string - objective vitals review with flagged abnormal values and any extracted lab/report markers",
  "red_flags": "string - immediate life-threatening warning signs for the consulting physician",
  "doctor_audio_brief": "string - spoken 15-second audio briefing script in fluent clinical English",
  "plan": ["string - clear bulleted actionable physician checklist items, STAT tests, medications, and triage destination"]
}`;

  let conversationalContext = narrativeText;
  if (conversationHistory && conversationHistory.length > 0) {
    conversationalContext += "\n\nFULL INTERACTIVE VOICE CONVERSATION TRANSCRIPT:\n" +
      conversationHistory
        .map((m) => `${m.sender === "patient" ? "Patient" : "MedAssist AI"}: ${m.text}`)
        .join("\n");
  }

  const promptText = `
PATIENT DETAILS:
- Name: ${patientInfo.name || "Unknown"}
- Age: ${patientInfo.age || "N/A"} years | Gender: ${patientInfo.gender}
- UHID / Token: ${patientInfo.uhid || "N/A"} / ${patientInfo.tokenNo || "N/A"}

OBJECTIVE VITALS:
- Blood Pressure: ${vitals.bpSystolic || "--"}/${vitals.bpDiastolic || "--"} mmHg
- Pulse Rate: ${vitals.pulse || "--"} bpm
- Body Temperature: ${vitals.temp || "--"} °F
- Oxygen Saturation (SpO2): ${vitals.spo2 || "--"} %

PATIENT VERNACULAR CONVERSATION & COMPLAINT:
"""
${conversationalContext || "No subjective narrative provided."}
"""

Please analyze all available data (and any attached lab image) and output the strict JSON clinical triage response.`;

  const contentsParts: any[] = [{ text: promptText }];

  if (labImageBase64) {
    const base64Data = labImageBase64.replace(/^data:image\/\w+;base64,/, "");
    const mimeMatch = labImageBase64.match(/^data:(image\/\w+);base64,/);
    const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";

    contentsParts.unshift({
      inline_data: {
        mime_type: mimeType,
        data: base64Data,
      },
    });
  }

  const requestBody = {
    system_instruction: {
      parts: [{ text: systemInstruction }],
    },
    contents: [
      {
        role: "user",
        parts: contentsParts,
      },
    ],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: "application/json",
    },
  };

  try {
    const response = await fetch(`${GEMINI_API_ENDPOINT}?key=${apiKey.trim()}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorJson = await response.json().catch(() => ({}));
      const errorMsg =
        errorJson?.error?.message || `HTTP ${response.status}: ${response.statusText}`;
      throw new Error(`Gemini API Error: ${errorMsg}`);
    }

    const data = await response.json();
    const candidateText =
      data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    if (!candidateText) {
      throw new Error("Empty response received from Gemini.");
    }

    const cleanJson = candidateText.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();
    const parsed: GeminiSOAPResponse = JSON.parse(cleanJson);

    return parsed;
  } catch (err: any) {
    console.error("Clinical Triage AI Error:", err);
    if (useFailsafeFallback) {
      console.warn("Falling back to simulated demo result due to error:", err.message);
      return DEMO_CASES[0].simulatedResponse;
    }
    throw err;
  }
}

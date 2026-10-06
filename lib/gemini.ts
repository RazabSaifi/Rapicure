import { GeminiSOAPResponse, VitalsData, PatientInfo } from "./types";
import { DEMO_CASES } from "./demoData";

const GEMINI_API_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

export async function processClinicalTriageWithGemini(params: {
  apiKey: string;
  narrativeText: string;
  vitals: VitalsData;
  patientInfo: PatientInfo;
  labImageBase64?: string | null;
  useFailsafeFallback?: boolean;
}): Promise<GeminiSOAPResponse> {
  const { apiKey, narrativeText, vitals, patientInfo, labImageBase64, useFailsafeFallback } =
    params;

  // Fallback simulator if no API key is provided during live test
  if (!apiKey && useFailsafeFallback !== false) {
    console.warn("No Gemini API key provided; utilizing clinical failsafe simulation.");
    await new Promise((resolve) => setTimeout(resolve, 1400)); // realistic thinking latency
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
2. Patient Chief Complaint & Narrative (spoken in vernacular Hindi/English/Hinglish).
3. 4 Standard Objective Vitals (BP, Pulse, Temperature °F, SpO2 %).
4. Optional attached diagnostic lab image (CBC, LFT, Prescription, or physical report).

Translate the informal narrative into professional, evidence-based medical English and synthesize a structured SOAP note.

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

PATIENT VERNACULAR COMPLAINT / NARRATIVE:
"""
${narrativeText || "No subjective narrative provided."}
"""

Please analyze all available data (and any attached lab image) and output the strict JSON clinical triage response.`;

  const contentsParts: any[] = [{ text: promptText }];

  // If lab image is attached, append inlineData
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
      temperature: 0.1, // Low temperature for high clinical precision
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

    // Clean any markdown formatting if present
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

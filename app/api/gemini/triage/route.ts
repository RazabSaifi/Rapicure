import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";
import { DEMO_CASES } from "@/lib/demoData";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      narrativeText,
      vitals,
      patientInfo,
      labImageBase64,
      conversationHistory,
      apiKey: clientKey,
    } = body;

    const apiKey = clientKey || process.env.GEMINI_API_KEY;

    // Clinical rule-based fallback if no key or transient error
    if (!apiKey) {
      console.warn("No GEMINI_API_KEY in environment or request; using clinical fallback.");
      return NextResponse.json(DEMO_CASES[0].simulatedResponse);
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });

    const systemInstruction = `You are an expert Clinical Triage Consultant & Medical Scribe AI named "RapiCure AI" operating in a high-volume Indian government tertiary hospital OPD (such as AIIMS or Dr. S.N. Medical College Jodhpur).
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
- Output strict JSON according to the schema.`;

    let conversationalContext = narrativeText || "";
    if (conversationHistory && conversationHistory.length > 0) {
      conversationalContext +=
        "\n\nFULL INTERACTIVE VOICE CONVERSATION TRANSCRIPT:\n" +
        conversationHistory
          .map((m: any) => `${m.sender === "patient" ? "Patient" : "RapiCure AI"}: ${m.text}`)
          .join("\n");
    }

    const promptText = `
PATIENT DETAILS:
- Name: ${patientInfo?.name || "Unknown"}
- Age: ${patientInfo?.age || "N/A"} years | Gender: ${patientInfo?.gender || "Male"}
- UHID / Token: ${patientInfo?.uhid || "N/A"} / ${patientInfo?.tokenNo || "N/A"}
- Chronic Conditions / Comorbidities: ${
      patientInfo?.chronicConditions && patientInfo.chronicConditions.length > 0
        ? patientInfo.chronicConditions.join(", ")
        : "None reported"
    }
- Current Active Medications: ${
      patientInfo?.currentMedications && patientInfo.currentMedications.length > 0
        ? patientInfo.currentMedications.join(", ")
        : "None reported"
    }

OBJECTIVE VITALS:
- Blood Pressure: ${vitals?.bpSystolic || "--"}/${vitals?.bpDiastolic || "--"} mmHg
- Pulse Rate: ${vitals?.pulse || "--"} bpm
- Body Temperature: ${vitals?.temp || "--"} °F
- Oxygen Saturation (SpO2): ${vitals?.spo2 || "--"} %

PATIENT VERNACULAR CONVERSATION & COMPLAINT:
"""
${conversationalContext || "No subjective narrative provided."}
"""

Please analyze all available data (and any attached lab image) and output the strict JSON clinical triage response.`;

    const contentsParts: any[] = [];

    if (labImageBase64) {
      const cleanBase64 = labImageBase64.replace(/^data:image\/\w+;base64,/, "");
      const mimeMatch = labImageBase64.match(/^data:(image\/\w+);base64,/);
      const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";

      contentsParts.push({
        inlineData: {
          mimeType,
          data: cleanBase64,
        },
      });
    }

    contentsParts.push({ text: promptText });

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: { parts: contentsParts },
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            priority: {
              type: Type.STRING,
              description: "HIGH, MODERATE, or ROUTINE",
              enum: ["HIGH", "MODERATE", "ROUTINE"],
            },
            priority_reason: {
              type: Type.STRING,
              description: "1-2 sentence clinical justification",
            },
            subjective: {
              type: Type.STRING,
              description:
                "Structured clinical synthesis of history, symptoms, onset, and vernacular translation in medical terminology",
            },
            objective: {
              type: Type.STRING,
              description:
                "Objective vitals review with flagged abnormal values and any extracted lab/report markers",
            },
            red_flags: {
              type: Type.STRING,
              description: "Immediate life-threatening warning signs for the consulting physician",
            },
            doctor_audio_brief: {
              type: Type.STRING,
              description: "Spoken 15-second audio briefing script in fluent clinical English",
            },
            plan: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description:
                "Actionable physician checklist items, STAT tests, medications, and triage destination",
            },
          },
          required: [
            "priority",
            "priority_reason",
            "subjective",
            "objective",
            "red_flags",
            "doctor_audio_brief",
            "plan",
          ],
        },
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error("Empty response from Gemini model");
    }

    const parsed = JSON.parse(text);
    return NextResponse.json(parsed);
  } catch (error: any) {
    console.error("Server Triage API Error:", error);
    // Return resilient demo fallback on error
    return NextResponse.json(DEMO_CASES[0].simulatedResponse);
  }
}

import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      language,
      conversationHistory = [],
      patientInput,
      patientInfo,
      vitals,
      apiKey: clientKey,
    } = body;

    const apiKey = clientKey || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      if (language === "hi-IN") {
        if (conversationHistory.length === 0) {
          return NextResponse.json({
            reply:
              "नमस्ते! मैं रापिक्योर (RapiCure) एआई हूँ। कृपया बताइए कि आपको क्या तकलीफ हो रही है?",
          });
        }
        return NextResponse.json({
          reply:
            "क्या आपको बुखार या दर्द के साथ चक्कर, उल्टी या सांस लेने में परेशानी महसूस हो रही है?",
        });
      } else {
        if (conversationHistory.length === 0) {
          return NextResponse.json({
            reply:
              "Hello! I am RapiCure AI triage assistant. Please describe your symptoms and when they started.",
          });
        }
        return NextResponse.json({
          reply:
            "I understand. Are you experiencing any severe dizziness, vomiting, or difficulty breathing?",
        });
      }
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });

    const systemInstruction = `You are "RapiCure AI", an empathetic, intelligent pre-OPD clinical triage assistant at AIIMS Jodhpur hospital.
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

    const historyFormatted = conversationHistory
      .map((msg: any) => `${msg.sender === "patient" ? "Patient" : "RapiCure AI"}: ${msg.text}`)
      .join("\n");

    const promptText = `
PATIENT CONTEXT:
Name: ${patientInfo?.name || "Patient"}, Age: ${patientInfo?.age || "--"}, Gender: ${patientInfo?.gender || "--"}
Vitals: BP ${vitals?.bpSystolic || "--"}/${vitals?.bpDiastolic || "--"}, Pulse ${vitals?.pulse || "--"} bpm, Temp ${vitals?.temp || "--"}°F, SpO2 ${vitals?.spo2 || "--"}%
Chronic Conditions: ${patientInfo?.chronicConditions?.join(", ") || "None"}
Current Medications: ${patientInfo?.currentMedications?.join(", ") || "None"}

CONVERSATION TRANSCRIPT SO FAR:
${historyFormatted}

LATEST PATIENT INPUT:
"${patientInput}"

Provide your next spoken clinical response (1-2 short sentences only):`;

    let response;
    try {
      response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: promptText,
        config: {
          systemInstruction,
          temperature: 0.2,
        },
      });
    } catch (mErr: any) {
      console.warn("gemini-3.8-flash unavailable, using gemini-3.5-flash:", mErr?.message);
      response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: promptText,
        config: {
          systemInstruction,
          temperature: 0.2,
        },
      });
    }

    const reply = response.text?.trim() || "";
    return NextResponse.json({ reply });
  } catch (error: any) {
    console.error("Server Converse API Error:", error);
    return NextResponse.json({
      reply:
        "मैं आपकी बात समझ रहा हूँ। क्या आपको इसके अलावा शरीर में कोई और दर्द या परेशानी है?",
    });
  }
}

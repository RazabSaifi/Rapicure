import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export const dynamic = "force-dynamic";

const FALLBACK_HI = [
  {
    reply:
      "नमस्ते! मैं रापिक्योर (RapiCure) एआई हूँ। कृपया बताइए कि आपको क्या तकलीफ हो रही है?",
    spokenRomaji:
      "Namaste! Main RapiCure AI hoon. Kripya batayein ki aapko kya takleef ho rahi hai?",
  },
  {
    reply:
      "मैं समझ सकता हूँ। क्या आपको इसके अलावा तेज बुखार, उल्टी या चक्कर आने की शिकायत है?",
    spokenRomaji:
      "Main samajh sakta hoon. Kya aapko iske alawa tez bukhar, ulti ya chakkar aane ki shikayat hai?",
  },
  {
    reply:
      "यह परेशानी कितने दिनों से हो रही है, और क्या आपको सांस लेने में दिक्कत या पेट में दर्द है?",
    spokenRomaji:
      "Yeh pareshani kitne dino se ho rahi hai, aur kya aapko saans lene mein dikkat ya pet mein dard hai?",
  },
  {
    reply:
      "धन्यवाद। मैंने आपके सभी लक्षण दर्ज कर लिए हैं। कृपया 'Finish & Generate SOAP Note' पर क्लिक करें।",
    spokenRomaji:
      "Dhanyawad. Maine aapke sabhi lakshan darj kar liye hain. Kripya Finish button par click karein.",
  },
];

const FALLBACK_EN = [
  {
    reply:
      "Hello! I am RapiCure AI triage assistant. Please describe your symptoms and when they started.",
    spokenRomaji:
      "Hello! I am RapiCure AI triage assistant. Please describe your symptoms and when they started.",
  },
  {
    reply:
      "I understand. Are you experiencing any severe dizziness, vomiting, or difficulty breathing?",
    spokenRomaji:
      "I understand. Are you experiencing any severe dizziness, vomiting, or difficulty breathing?",
  },
  {
    reply:
      "How many days have you had these symptoms, and have you noticed any rash or extreme fatigue?",
    spokenRomaji:
      "How many days have you had these symptoms, and have you noticed any rash or extreme fatigue?",
  },
  {
    reply:
      "Thank you. I have captured your primary symptoms. Please proceed to generate the clinical SOAP note.",
    spokenRomaji:
      "Thank you. I have captured your primary symptoms. Please proceed to generate the clinical SOAP note.",
  },
];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      language = "hi-IN",
      conversationHistory = [],
      patientInput = "",
      patientInfo,
      vitals,
      apiKey: clientKey,
    } = body;

    const apiKey =
      clientKey ||
      process.env.GEMINI_API_KEY ||
      process.env.API_KEY ||
      process.env.GOOGLE_API_KEY ||
      process.env.GOOGLE_GENAI_API_KEY;

    if (!apiKey) {
      console.warn("No Gemini API key supplied; utilizing intelligent conversational fallback sequence.");
      const list = language === "hi-IN" ? FALLBACK_HI : FALLBACK_EN;
      const turnIdx = Math.min(
        Math.floor(conversationHistory.length / 2),
        list.length - 1
      );
      return NextResponse.json(list[turnIdx]);
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });

    const isHindi = language === "hi-IN";

    const systemInstruction = `You are "RapiCure AI", an empathetic, intelligent pre-OPD clinical triage assistant at AIIMS Jodhpur hospital.
You are having an interactive SPOKEN voice conversation with a patient waiting outside the OPD cabin.

RULES FOR YOUR RESPONSE:
1. Spoken Language: ${
      isHindi
        ? "Reply in natural, empathetic, conversational Hindi (using Devanagari script). Keep language simple and easy for patients from North India."
        : "Reply in simple, clear, empathetic medical English."
    }
2. Brevity is Critical: You are speaking aloud over audio. Keep your reply strictly 1 to 2 short sentences.
3. Clinical Goal: Acknowledge the patient's complaint with empathy, and ask ONE focused follow-up medical question (e.g. onset, severity, associated red-flag symptoms like chest pain, breathlessness, rash, chills, severe abdominal pain).
4. Do NOT diagnose or give prescription drugs yet; you are conducting the pre-consultation triage interview.
5. Return strictly JSON with two keys:
   - "reply": The spoken response text in ${isHindi ? "Devanagari Hindi script" : "English"}.
   - "spokenRomaji": ${
      isHindi
        ? "Phonetic Romanized Hindi/Hinglish (e.g. 'Namaste! Main samajh raha hoon. Kya aapko tez bukhar ke saath ulti ya chakkar bhi aa rahe hain?') for universal speech engines"
        : "Same English text as reply"
    }.`;

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

Provide your next spoken clinical response in the specified JSON format:`;

    let response;
    try {
      response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: promptText,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          temperature: 0.2,
        },
      });
    } catch (mErr: any) {
      console.warn("gemini-2.0-flash error, falling back to gemini-1.5-flash:", mErr?.message);
      response = await ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: promptText,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          temperature: 0.2,
        },
      });
    }

    const rawOutput = response.text?.trim() || "";
    try {
      const parsed = JSON.parse(rawOutput);
      return NextResponse.json({
        reply: parsed.reply || rawOutput,
        spokenRomaji: parsed.spokenRomaji || parsed.reply || rawOutput,
      });
    } catch {
      return NextResponse.json({
        reply: rawOutput,
        spokenRomaji: rawOutput,
      });
    }
  } catch (error: any) {
    console.error("Server Converse API Error:", error);
    return NextResponse.json({
      reply:
        "मैं आपकी बात समझ रहा हूँ। क्या आपको इसके अलावा शरीर में कोई और दर्द या परेशानी है?",
      spokenRomaji:
        "Main aapki baat samajh raha hoon. Kya aapko iske alawa sharir mein koi aur dard ya pareshani hai?",
    });
  }
}

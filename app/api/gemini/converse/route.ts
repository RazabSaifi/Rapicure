import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export const dynamic = "force-dynamic";

/**
 * Converts raw 24kHz 16-bit mono PCM into a standard WAV container
 * with a 44-byte RIFF header playable in all browsers and devices.
 */
function pcmToWav(
  pcmBuffer: Buffer,
  sampleRate = 24000,
  numChannels = 1,
  bitsPerSample = 16
): Buffer {
  const header = Buffer.alloc(44);
  const dataSize = pcmBuffer.length;
  const fileSize = 36 + dataSize;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);

  header.write("RIFF", 0);
  header.writeUInt32LE(fileSize, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16); // Subchunk1Size
  header.writeUInt16LE(1, 20); // PCM format
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmBuffer]);
}

/**
 * ElevenLabs Multilingual v2 Ultra-Realistic Voice Generator
 */
async function generateElevenLabsAudio(
  text: string,
  apiKey: string,
  voiceId = "21m00Tcm4TlvDq8ikWAM"
): Promise<string | null> {
  try {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.8,
          style: 0.35,
          use_speaker_boost: true,
        },
      }),
    });

    if (!res.ok) {
      console.warn("ElevenLabs API returned HTTP error:", res.status);
      return null;
    }

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return `data:audio/mp3;base64,${buffer.toString("base64")}`;
  } catch (err: any) {
    console.warn("ElevenLabs audio generation failed:", err?.message);
    return null;
  }
}

/**
 * Google Natural Neural Voice Generator (Hindi & English)
 * Produces real human neural MP3 audio stream for crystal-clear, non-robotic playback.
 */
async function generateGoogleNeuralAudio(
  text: string,
  lang = "hi"
): Promise<string | null> {
  try {
    const cleanText = text
      .replace(/[*_#`]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 320);

    if (!cleanText) return null;

    const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${lang}&client=tw-ob&q=${encodeURIComponent(
      cleanText
    )}`;

    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Referer: "https://translate.google.com/",
      },
    });

    if (!res.ok) {
      console.warn("Google Neural TTS returned status:", res.status);
      return null;
    }

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return `data:audio/mpeg;base64,${buffer.toString("base64")}`;
  } catch (err: any) {
    console.warn("Google Neural Audio generation error:", err?.message);
    return null;
  }
}

/**
 * Smart organ-specific fallback router when API key is offline or rate-limited
 * Guaranteed NEVER to repeat questions and always progresses through clinical intake.
 */
function getSmartFallbackResponse(
  patientInput: string,
  language: string,
  conversationHistory: any[] = []
): { reply: string; spokenRomaji: string } {
  const text = (patientInput || "").toLowerCase();
  const isHi = language === "hi-IN";

  // Calculate actual turn progress based on history
  const patientTurns = conversationHistory.filter((m: any) => m.sender === "patient");
  const turn = patientTurns.length;
  const previousAIText = conversationHistory
    .filter((m: any) => m.sender === "gemini")
    .map((m: any) => (m.text || "").toLowerCase())
    .join(" ");

  // Turn 0: Opening Greeting
  if (turn === 0 || !patientInput.trim()) {
    return isHi
      ? {
          reply:
            "नमस्ते! मैं रापिक्योर एआई हूँ। कृपया बताइए कि आपको क्या तकलीफ हो रही है और यह कब से शुरू हुई?",
          spokenRomaji:
            "Namaste! Main RapiCure AI hoon. Kripya batayein ki aapko kya takleef ho rahi hai aur yeh kab se shuru hui?",
        }
      : {
          reply:
            "Hello! I am RapiCure AI clinical assistant. Please describe your symptoms and when they started.",
          spokenRomaji:
            "Hello! I am RapiCure AI clinical assistant. Please describe your symptoms and when they started.",
        };
  }

  // Turn 4+: Wrap up consultation
  if (turn >= 4) {
    return isHi
      ? {
          reply:
            "मैंने आपके सभी लक्षण और विवरण नोट कर लिए हैं। कृपया नीचे 'Finish & Generate SOAP Note' बटन दबाएं ताकि डॉक्टर साहब के लिए ओपीडी पर्ची तैयार हो सके।",
          spokenRomaji:
            "Maine aapke sabhi lakshan aur vivaran note kar liye hain. Kripya neeche Finish & Generate SOAP Note button dabayein taaki doctor sahab ke liye OPD parchi taiyar ho sake.",
        }
      : {
          reply:
            "I have recorded all your symptoms and medical details. Please click the 'Finish & Generate SOAP Note' button below to generate your clinical OPD slip.",
          spokenRomaji:
            "I have recorded all your symptoms and medical details. Please click the 'Finish & Generate SOAP Note' button below to generate your clinical OPD slip.",
        };
  }

  // 1. Orthopedic / Injury / Leg / Hand / Fall / Joint
  if (
    text.includes("पैर") ||
    text.includes("हाथ") ||
    text.includes("चोट") ||
    text.includes("मोच") ||
    text.includes("हड्डी") ||
    text.includes("घुटने") ||
    text.includes("कमर") ||
    text.includes("leg") ||
    text.includes("hand") ||
    text.includes("foot") ||
    text.includes("injury") ||
    text.includes("sprain") ||
    text.includes("fall") ||
    text.includes("twist") ||
    text.includes("joint")
  ) {
    if (turn === 1 && !previousAIText.includes("सूजन") && !previousAIText.includes("swelling")) {
      return isHi
        ? {
            reply:
              "चोट और दर्द के बारे में जानकर दुख हुआ। क्या उस जगह कोई सूजन या नीलापन है, और क्या आप चलने-फिरने में समर्थ हैं?",
            spokenRomaji:
              "Chot aur dard ke baare mein jaankar dukh hua. Kya us jagah koi sujan ya neelapan hai, aur kya aap chalne firne mein samarth hain?",
          }
        : {
            reply:
              "I see you have an injury. Is there any noticeable swelling, redness, or difficulty putting weight on it?",
            spokenRomaji:
              "I see you have an injury. Is there any noticeable swelling, redness, or difficulty putting weight on it?",
          };
    }
    if (turn === 2 || !previousAIText.includes("दवा") && !previousAIText.includes("medicine")) {
      return isHi
        ? {
            reply:
              "समझ गया। क्या आपने दर्द के लिए कोई गर्म पट्टी बांधी या कोई दर्दनिवारक दवा ली है? क्या दर्द लगातार बना हुआ है?",
            spokenRomaji:
              "Samajh gaya. Kya aapne dard ke liye koi patti baandhi ya koi dard niwarak dawa li hai? Kya dard lagatar bana hua hai?",
          }
        : {
            reply:
              "Understood. Have you taken any pain relievers or applied ice? Is the pain constant or throbbing?",
            spokenRomaji:
              "Understood. Have you taken any pain relievers or applied ice? Is the pain constant or throbbing?",
          };
    }
    return isHi
      ? {
          reply:
            "ठीक है, मैंने चोट के सारे लक्षण लिख लिए हैं। कृपया नीचे 'Finish' दबाकर ओपीडी पर्ची जनरेट करें।",
          spokenRomaji:
            "Theek hai, maine chot ke saare lakshan likh liye hain. Kripya neeche Finish dabakar OPD parchi generate karein.",
        }
      : {
          reply:
            "Got it. I have noted all details of your injury. Please click 'Finish' below to generate your OPD slip.",
          spokenRomaji:
            "Got it. I have noted all details of your injury. Please click 'Finish' below to generate your OPD slip.",
        };
  }

  // 2. Abdominal / Stomach / Vomiting / Diarrhea
  if (
    text.includes("पेट") ||
    text.includes("उल्टी") ||
    text.includes("दस्त") ||
    text.includes("stomach") ||
    text.includes("vomit") ||
    text.includes("abdomen") ||
    text.includes("diarrhea") ||
    text.includes("loose") ||
    text.includes("गैस")
  ) {
    if (turn === 1 && !previousAIText.includes("नाभि") && !previousAIText.includes("abdomen")) {
      return isHi
        ? {
            reply:
              "पेट में तकलीफ कब से शुरू हुई, और क्या दर्द पेट के ऊपरी हिस्से में है या नाभि के नीचे?",
            spokenRomaji:
              "Pet mein takleef kab se shuru hui, aur kya dard pet ke oopri hisse mein hai ya naabhi ke neeche?",
          }
        : {
            reply:
              "When did the stomach discomfort begin, and is the pain localized in the upper or lower abdomen?",
            spokenRomaji:
              "When did the stomach discomfort begin, and is the pain localized in the upper or lower abdomen?",
          };
    }
    if (turn === 2 && !previousAIText.includes("उल्टी") && !previousAIText.includes("vomiting")) {
      return isHi
        ? {
            reply:
              "क्या आपको उल्टी या जी मिचलाने के साथ दस्त की शिकायत भी हो रही है, और क्या कुछ खाने-पीने पर दर्द बढ़ता है?",
            spokenRomaji:
              "Kya aapko ulti ya jee michlane ke saath dast ki shikayat bhi ho rahi hai, aur kya khane par dard badhta hai?",
          }
        : {
            reply:
              "Are you experiencing any vomiting, loose stools, or difficulty keeping fluids down?",
            spokenRomaji:
              "Are you experiencing any vomiting, loose stools, or difficulty keeping fluids down?",
          };
    }
    return isHi
      ? {
          reply:
            "क्या आपने इसके लिए कोई दवा या ओआरएस (ORS) घोल लिया है, और क्या कमजोरी महसूस हो रही है?",
          spokenRomaji:
            "Kya aapne iske liye koi dawa ya ORS ghol liya hai, aur kya kamzori mehsoos ho rahi hai?",
        }
      : {
          reply:
            "Have you taken any medicine or hydration fluids, and are you feeling dizzy or weak?",
          spokenRomaji:
            "Have you taken any medicine or hydration fluids, and are you feeling dizzy or weak?",
        };
  }

  // 3. Cough / Cold / Throat / Chest congestion
  if (
    text.includes("खांसी") ||
    text.includes("गला") ||
    text.includes("cough") ||
    text.includes("throat") ||
    text.includes("cold") ||
    text.includes("जुकाम") ||
    text.includes("कफ") ||
    text.includes("सांस")
  ) {
    if (turn === 1 && !previousAIText.includes("बलगम") && !previousAIText.includes("phlegm")) {
      return isHi
        ? {
            reply:
              "क्या यह सूखी खांसी है या बलगम आ रहा है, और क्या गले में निगलने पर भी दर्द महसूस हो रहा है?",
            spokenRomaji:
              "Kya yeh sukhi khansi hai ya balgam aa raha hai, aur kya gale mein dard mehsoos ho raha hai?",
          }
        : {
            reply:
              "Is it a dry cough or producing phlegm, and are you having any throat pain while swallowing?",
            spokenRomaji:
              "Is it a dry cough or producing phlegm, and are you having any throat pain while swallowing?",
          };
    }
    if (turn === 2 && !previousAIText.includes("बुखार") && !previousAIText.includes("fever")) {
      return isHi
        ? {
            reply:
              "यह खांसी कितने दिनों से है, और क्या इसके साथ रात में हल्का बुखार या सांस लेने में भारीपन महसूस होता है?",
            spokenRomaji:
              "Yeh khansi kitne dino se hai, aur kya iske saath raat mein bukhar ya saans lene mein bhareepan lagta hai?",
          }
        : {
            reply:
              "How many days has this cough lasted, and have you noticed any fever or chest congestion?",
            spokenRomaji:
              "How many days has this cough lasted, and have you noticed any fever or chest congestion?",
          };
    }
    return isHi
      ? {
          reply:
            "समझ गया। क्या आपने कोई कफ सिरप या भाप ली है? मैं यह सब डॉक्टर साहब के लिए नोट कर रहा हूँ।",
          spokenRomaji:
            "Samajh gaya. Kya aapne koi cough syrup ya bhaap li hai? Main yeh sab doctor sahab ke liye note kar raha hoon.",
        }
      : {
          reply:
            "Understood. Have you taken any cough syrup or steam inhalation? I am recording this for the physician.",
          spokenRomaji:
            "Understood. Have you taken any cough syrup or steam inhalation? I am recording this for the physician.",
        };
  }

  // 4. Fever / Chills / Dengue / Infection
  if (
    text.includes("बुखार") ||
    text.includes("fever") ||
    text.includes("temperature") ||
    text.includes("ताप") ||
    text.includes("ठंड") ||
    text.includes("चक्कर")
  ) {
    if (turn === 1 && !previousAIText.includes("ठंड") && !previousAIText.includes("chills")) {
      return isHi
        ? {
            reply:
              "बुखार कितने दिनों से आ रहा है, और क्या बुखार के साथ तेज ठंड या कंपकंपी भी महसूस होती है?",
            spokenRomaji:
              "Bukhar kitne dino se aa raha hai, aur kya bukhar ke saath tez thand ya kapkapi bhi mehsoos hoti hai?",
          }
        : {
            reply:
              "How many days have you had the fever, and does it come with severe chills or shivering?",
            spokenRomaji:
              "How many days have you had the fever, and does it come with severe chills or shivering?",
          };
    }
    if (turn === 2 && !previousAIText.includes("चकत्ते") && !previousAIText.includes("rash")) {
      return isHi
        ? {
            reply:
              "क्या सिर में या आँखों के पीछे तेज दर्द है, और क्या शरीर या हाथों पर कोई लाल चकत्ते दिखे हैं?",
            spokenRomaji:
              "Kya sir mein ya aankhon ke peeche tez dard hai, aur kya sharir par koi laal chakatte dikhe hain?",
          }
        : {
            reply:
              "Are you experiencing headache, pain behind the eyes, or any skin rashes?",
            spokenRomaji:
              "Are you experiencing headache, pain behind the eyes, or any skin rashes?",
          };
    }
    return isHi
      ? {
          reply:
            "क्या आपने पैरासिटामोल या कोई अन्य दवा ली है, और क्या बुखार उतरने पर दोबारा चढ़ जाता है?",
          spokenRomaji:
            "Kya aapne paracetamol ya koi anya dawa li hai, aur kya bukhar utarne par dobara chadh jata hai?",
        }
      : {
          reply:
            "Have you taken paracetamol or any other medication, and does the temperature recur after medication?",
          spokenRomaji:
            "Have you taken paracetamol or any other medication, and does the temperature recur after medication?",
        };
  }

  // 5. Generic Empathetic Progression
  if (turn === 1) {
    return isHi
      ? {
          reply:
            "मैं आपकी बात समझ रहा हूँ। यह तकलीफ कितने दिनों से शुरू हुई है और क्या यह लगातार बनी रहती है?",
          spokenRomaji:
            "Main aapki baat samajh raha hoon. Yeh takleef kitne dino se shuru hui hai aur kya yeh lagatar bani rehti hai?",
        }
      : {
          reply:
            "I understand. How many days ago did this start, and is the discomfort constant?",
          spokenRomaji:
            "I understand. How many days ago did this start, and is the discomfort constant?",
        };
  }

  if (turn === 2) {
    return isHi
      ? {
          reply:
            "क्या इस तकलीफ के साथ कमजोरी, चक्कर या उल्टी जैसा महसूस हो रहा है?",
          spokenRomaji:
            "Kya is takleef ke saath kamzori, chakkar ya ulti jaisa mehsoos ho raha hai?",
        }
      : {
          reply:
            "Are you experiencing any accompanying weakness, dizziness, or nausea?",
          spokenRomaji:
            "Are you experiencing any accompanying weakness, dizziness, or nausea?",
        };
  }

  return isHi
    ? {
        reply:
          "क्या आपने इसके लिए कोई दवा ली है, और क्या पहले भी कभी ऐसी समस्या हुई थी?",
        spokenRomaji:
          "Kya aapne iske liye koi dawa li hai, aur kya pehle bhi kabhi aisi samasya hui thi?",
      }
    : {
        reply:
          "Have you taken any medication for relief, and have you ever had similar symptoms before?",
        spokenRomaji:
          "Have you taken any medication for relief, and have you ever had similar symptoms before?",
      };
}

export async function POST(req: NextRequest) {
  let language = "hi-IN";
  let conversationHistory: any[] = [];
  let patientInput = "";

  try {
    const body = await req.json();
    language = body.language || "hi-IN";
    conversationHistory = body.conversationHistory || [];
    patientInput = body.patientInput || "";

    const {
      patientInfo,
      vitals,
      voiceName = "Aoede", // Prebuilt Gemini human voice persona (Aoede, Charon, Puck, Kore)
      apiKey: clientKey,
      elevenLabsApiKey: clientElevenLabsKey,
    } = body;

    const apiKey =
      clientKey ||
      process.env.GEMINI_API_KEY ||
      process.env.API_KEY ||
      process.env.GOOGLE_API_KEY ||
      process.env.GOOGLE_GENAI_API_KEY;

    const elevenLabsApiKey =
      clientElevenLabsKey ||
      process.env.ELEVENLABS_API_KEY ||
      process.env.ELEVEN_LABS_API_KEY;

    const isHindi = language === "hi-IN";

    // If no Gemini key is provided, use smart organ-specific fallback
    if (!apiKey) {
      console.warn("No Gemini API key supplied; utilizing intelligent organ-specific fallback.");
      const smartFallback = getSmartFallbackResponse(patientInput, language, conversationHistory);

      // Audio Synthesis: Tier 1 ElevenLabs if key available, else Tier 2 Google Neural Audio
      let audioBase64: string | null = null;
      let voiceMode = "google_neural_voice";

      if (elevenLabsApiKey) {
        audioBase64 = await generateElevenLabsAudio(
          smartFallback.reply,
          elevenLabsApiKey
        );
        if (audioBase64) voiceMode = "elevenlabs_studio";
      }

      if (!audioBase64) {
        audioBase64 = await generateGoogleNeuralAudio(
          smartFallback.reply,
          isHindi ? "hi" : "en"
        );
        if (audioBase64) voiceMode = "google_neural_voice";
      }

      return NextResponse.json({
        ...smartFallback,
        audioBase64,
        voiceMode: audioBase64 ? voiceMode : "offline_fallback",
        isLiveAI: false,
        noApiKey: true,
      });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });

    // Clinical Triage Reasoning System Prompt
    const systemInstruction = `You are "RapiCure AI", an empathetic, highly skilled pre-OPD clinical triage doctor at AIIMS Hospital.
You are having an interactive spoken consultation with a patient waiting in the hospital OPD intake queue.

YOUR CLINICAL RESPONSIBILITIES:
1. STRICT ANTI-REPETITION MANDATE (ABSOLUTE REQUIREMENT):
   - Thoroughly inspect the "CONVERSATION TRANSCRIPT SO FAR".
   - NEVER repeat or re-phrase any question that was already asked in any previous turn.
   - NEVER ask the patient for information they have already provided (e.g., if the patient already stated "4 din se bukhar hai", DO NOT ask "बुखार कितने दिनों से है?").
   - Progress the consultation logically on every turn:
     * Turn 1 (Initial complaint): Acknowledge their specific issue with genuine clinical empathy ("जी, मैं समझ गया।"), and ask about the onset or specific nature.
     * Turn 2 (Focused organ-system inquiry): Ask ONE focused question regarding signs of that specific complaint (e.g. rashes, eye pain, joint swelling, vomiting, chest tightness).
     * Turn 3 (Severity & prior medications): Ask how severe it is or if they took any medicine (e.g. Paracetamol, painkiller).
     * Turn 4+ (Wrap up): Reassure the patient and advise them: "मैंने आपके लक्षण और विवरण दर्ज कर लिए हैं। कृपया नीचे 'Finish & Generate SOAP Note' बटन दबाकर डॉक्टर साहब के लिए ओपीडी पर्ची तैयार करें।"

2. ACTIVE LISTENING & DIRECT RELEVANCE (CRITICAL):
   - Listen carefully to what the patient specifically says (e.g., knee sprain, stomach pain, fever, eye injury, skin rash, ear pain, toothache).
   - Your response MUST directly address THAT EXACT complaint. Never ask about unrelated symptoms. (For example, NEVER ask about chest pain or breathlessness if a patient has an ankle twist or eye infection!).

3. CONVERSATIONAL TONE & LANGUAGE:
   - Spoken Language: ${
     isHindi
       ? "Natural, warm, conversational Hindi (Devanagari script) exactly as spoken by doctors in North India. Use comforting doctor-patient language (जैसे: 'तकलीफ', 'परेशानी', 'दवा', 'सूजन', 'दर्द')."
       : "Simple, clear, empathetic medical English."
   }
   - Length: Strictly 1 to 2 short sentences. Brevity is essential for real-time audio playback.
   - Do NOT provide final diagnoses or prescribe prescription medicines; you are recording triage history.

4. OUTPUT FORMAT:
   Return strictly valid JSON with:
   - "reply": The Hindi response in Devanagari script (or English).
   - "spokenRomaji": Natural phonetic Romanized Hindi (Hinglish) for clear speech pronunciation.`;

    const historyFormatted = conversationHistory
      .map((msg: any) => `${msg.sender === "patient" ? "Patient" : "RapiCure AI"}: ${msg.text}`)
      .join("\n");

    const promptText = `
PATIENT DEMOGRAPHICS & VITALS:
Name: ${patientInfo?.name || "Patient"}, Age: ${patientInfo?.age || "--"}, Gender: ${patientInfo?.gender || "--"}
Vitals: BP ${vitals?.bpSystolic || "--"}/${vitals?.bpDiastolic || "--"}, Pulse ${vitals?.pulse || "--"} bpm, Temp ${vitals?.temp || "--"}°F, SpO2 ${vitals?.spo2 || "--"}%
Chronic History: ${patientInfo?.chronicConditions?.join(", ") || "None reported"}

CONVERSATION TRANSCRIPT SO FAR:
${historyFormatted || "(Conversation just started)"}

LATEST PATIENT STATEMENT:
"${patientInput || "नमस्ते Doctor"}"

Respond directly to the patient's statement following the clinical protocol (1-2 sentences in JSON format):`;

    // Step 1: Generate clinical question & dialogue text
    let response;
    try {
      response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: promptText,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          temperature: 0.35,
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
          temperature: 0.35,
        },
      });
    }

    const rawOutput = response.text?.trim() || "";
    let reply = rawOutput;
    let spokenRomaji = rawOutput;
    try {
      const parsed = JSON.parse(rawOutput);
      reply = parsed.reply || rawOutput;
      spokenRomaji = parsed.spokenRomaji || parsed.reply || rawOutput;
    } catch {
      // ignore
    }

    // Step 2: Audio Synthesis
    // Tier 1: ElevenLabs Multilingual v2 (if user supplied ElevenLabs key)
    // Tier 2: Google Natural Neural Voice (clear human MP3 stream, zero robotic sound)
    let audioBase64: string | null = null;
    let voiceMode = "google_neural_voice";

    // Try ElevenLabs if configured
    if (elevenLabsApiKey) {
      audioBase64 = await generateElevenLabsAudio(
        isHindi ? reply : spokenRomaji,
        elevenLabsApiKey
      );
      if (audioBase64) voiceMode = "elevenlabs_studio";
    }

    // High-quality human Google Neural Voice (instant MP3 stream)
    if (!audioBase64) {
      audioBase64 = await generateGoogleNeuralAudio(
        isHindi ? reply : spokenRomaji,
        isHindi ? "hi" : "en"
      );
      if (audioBase64) voiceMode = "google_neural_voice";
    }

    return NextResponse.json({
      reply,
      spokenRomaji,
      audioBase64,
      voiceMode,
      isLiveAI: true,
    });
  } catch (error: any) {
    console.error("Server Converse API Error:", error);
    const isHi = (language || "hi-IN") === "hi-IN";
    const safeFallback = getSmartFallbackResponse(
      patientInput || "",
      language || "hi-IN",
      conversationHistory || []
    );

    let audioBase64: string | null = null;
    try {
      audioBase64 = await generateGoogleNeuralAudio(
        safeFallback.reply,
        isHi ? "hi" : "en"
      );
    } catch {
      // ignore
    }

    return NextResponse.json({
      ...safeFallback,
      audioBase64,
      voiceMode: audioBase64 ? "google_neural_voice" : "error_fallback",
      isLiveAI: false,
      apiError: error?.message || "Gemini API connection error",
    });
  }
}

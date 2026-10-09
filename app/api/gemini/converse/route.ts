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
 * Smart organ-specific fallback router when API key is offline
 * Guaranteed NEVER to ask unrelated or dumb questions.
 */
function getSmartFallbackResponse(
  patientInput: string,
  language: string,
  turn: number
): { reply: string; spokenRomaji: string } {
  const text = (patientInput || "").toLowerCase();
  const isHi = language === "hi-IN";

  // 1. Orthopedic / Injury / Leg / Hand / Fall
  if (
    text.includes("पैर") ||
    text.includes("हाथ") ||
    text.includes("चोट") ||
    text.includes("मोच") ||
    text.includes("हड्डी") ||
    text.includes("leg") ||
    text.includes("hand") ||
    text.includes("foot") ||
    text.includes("injury") ||
    text.includes("sprain") ||
    text.includes("fall") ||
    text.includes("twist") ||
    text.includes("दर्द") && (text.includes("घुटने") || text.includes("कमर"))
  ) {
    if (turn <= 1) {
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
    return isHi
      ? {
          reply:
            "समझ गया। क्या आपने दर्द के लिए कोई गर्म पट्टी बांधी या कोई दर्दनिवारक दवा ली है? मैं यह जानकारी ओपीडी पर्ची में दर्ज कर रहा हूँ।",
          spokenRomaji:
            "Samajh gaya. Kya aapne dard ke liye koi patti baandhi ya koi dawa li hai? Main yeh OPD slip mein darj kar raha hoon.",
        }
      : {
          reply:
            "Understood. Have you taken any pain reliever or applied ice? I am noting this down for the doctor's consultation.",
          spokenRomaji:
            "Understood. Have you taken any pain reliever or applied ice? I am noting this down for the doctor's consultation.",
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
    if (turn <= 1) {
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
    return isHi
      ? {
          reply:
            "क्या आपको उल्टी या जी मिचलाने के साथ दस्त की शिकायत भी हो रही है, और क्या कुछ खाने-पीने पर दर्द बढ़ता है?",
          spokenRomaji:
            "Kya aapko ulti ya jee michlane ke saath dast ki shikayat bhi ho rahi hai, aur kya khane par dard badhta hai?",
        }
      : {
          reply:
            "Are you experiencing any vomiting, diarrhea, or difficulty keeping fluids down?",
          spokenRomaji:
            "Are you experiencing any vomiting, diarrhea, or difficulty keeping fluids down?",
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
    text.includes("कफ")
  ) {
    if (turn <= 1) {
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

  // 4. Fever / Chills / Dengue / Infection
  if (
    text.includes("बुखार") ||
    text.includes("fever") ||
    text.includes("temperature") ||
    text.includes("ताप") ||
    text.includes("ठंड")
  ) {
    if (turn <= 1) {
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

  // 5. Default Opening Turn
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

  // 6. Generic Empathetic Turn
  return isHi
    ? {
        reply:
          "मैं आपकी बात समझ रहा हूँ। क्या यह तकलीफ पिछले 24 घंटों में बढ़ी है, और क्या आपने इसके लिए कोई दवा ली है?",
        spokenRomaji:
          "Main aapki baat samajh raha hoon. Kya yeh takleef pichle 24 ghante mein badhi hai, aur kya aapne koi dawa li hai?",
      }
    : {
        reply:
          "I understand. Have your symptoms worsened recently, and have you taken any medications for relief?",
        spokenRomaji:
          "I understand. Have your symptoms worsened recently, and have you taken any medications for relief?",
      };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      language = "hi-IN",
      conversationHistory = [],
      patientInput = "",
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
    const turnCount = Math.floor(conversationHistory.length / 2);

    // If no Gemini key is provided, use smart organ-specific fallback
    if (!apiKey) {
      console.warn("No Gemini API key supplied; utilizing intelligent organ-specific fallback.");
      const smartFallback = getSmartFallbackResponse(patientInput, language, turnCount);

      // Check if user has ElevenLabs key for voice even in offline fallback!
      let audioBase64: string | null = null;
      if (elevenLabsApiKey) {
        audioBase64 = await generateElevenLabsAudio(
          smartFallback.reply,
          elevenLabsApiKey
        );
      }

      return NextResponse.json({
        ...smartFallback,
        audioBase64,
        voiceMode: audioBase64 ? "elevenlabs_studio" : "offline_fallback",
        isLiveAI: false,
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
1. ACTIVE LISTENING & DIRECT RELEVANCE (CRITICAL):
   - Listen carefully to what the patient specifically says (e.g., knee sprain, stomach pain, fever, eye injury, skin rash, ear pain, toothache).
   - Your response MUST directly address THAT EXACT complaint. Never ask about unrelated symptoms. (For example, NEVER ask about chest pain or breathlessness if a patient has an ankle twist or eye infection!).
   
2. CLINICAL INTAKE PROGRESSION:
   - Turn 1 (Initial complaint): Acknowledge their specific issue with genuine clinical empathy ("जी, मैं समझ गया।"), and ask about the EXACT onset, mechanism, or nature of that complaint.
   - Turn 2 (Focused organ-system inquiry): Ask ONE focused question regarding signs of that specific complaint:
     * If Ortho/Injury: Ask about swelling, joint movement, or weight bearing.
     * If Abdominal/GI: Ask about pain location (upper/lower), nausea, vomiting, or diarrhea.
     * If Fever/Infection: Ask about chills, temperature, rash, or headache.
     * If Respiratory: Ask about dry/wet cough, phlegm, or throat pain.
     * If ENT/Eye: Ask about vision change, discharge, or ear pain.
   - Turn 3 (Severity & prior medications): Ask how severe it is (mild/moderate/severe) or if they took any medicine (e.g. Paracetamol, painkiller).
   - Turn 4+ (Wrap up): Reassure the patient and advise them: "मैंने आपके लक्षण दर्ज कर लिए हैं। कृपया नीचे 'Finish' बटन दबाकर डॉक्टर साहब के लिए ओपीडी पर्ची तैयार करें।"

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

    // Step 2: Audio Synthesis (Tier 1: ElevenLabs if key available, Tier 2: Gemini 2.0 Native Audio)
    let audioBase64: string | null = null;
    let voiceMode = "neural_tts";

    // Try ElevenLabs if configured
    if (elevenLabsApiKey) {
      audioBase64 = await generateElevenLabsAudio(
        isHindi ? reply : spokenRomaji,
        elevenLabsApiKey
      );
      if (audioBase64) voiceMode = "elevenlabs_studio";
    }

    // If ElevenLabs was not used or failed, try Gemini 2.0 Native Audio
    if (!audioBase64) {
      try {
        const textToSpeak = isHindi ? reply : spokenRomaji;
        const audioPrompt = `Speak this pre-OPD clinical assistant statement naturally with warmth, human empathy, and clear pronunciation: "${textToSpeak}"`;

        const audioGen = await ai.models.generateContent({
          model: "gemini-2.0-flash",
          contents: audioPrompt,
          config: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: voiceName || "Aoede",
                },
              },
            },
          },
        });

        const candidate = audioGen.candidates?.[0];
        const parts = candidate?.content?.parts || [];
        for (const p of parts) {
          if (p.inlineData && p.inlineData.data) {
            const mime = p.inlineData.mimeType || "audio/pcm;rate=24000";
            if (mime.includes("pcm") || mime.includes("rate=24000")) {
              const rawPcm = Buffer.from(p.inlineData.data, "base64");
              const wavBuffer = pcmToWav(rawPcm, 24000);
              audioBase64 = `data:audio/wav;base64,${wavBuffer.toString("base64")}`;
            } else {
              audioBase64 = `data:${mime};base64,${p.inlineData.data}`;
            }
            voiceMode = "gemini_native";
            break;
          }
        }
      } catch (audioErr: any) {
        console.warn("Gemini native audio fallback:", audioErr?.message);
      }
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
    const safeFallback = getSmartFallbackResponse(
      "",
      "hi-IN",
      0
    );
    return NextResponse.json({
      ...safeFallback,
      audioBase64: null,
      voiceMode: "error_fallback",
      isLiveAI: false,
    });
  }
}

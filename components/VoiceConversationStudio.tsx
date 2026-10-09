"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Sparkles,
  Send,
  RotateCcw,
  Bot,
  User,
  HeartPulse,
  CheckCircle2,
  Loader2,
  ShieldAlert,
  AlertCircle,
  HelpCircle,
  Zap,
} from "lucide-react";
import { ChatMessage, PatientInfo, VitalsData } from "@/lib/types";
import { SpeechInputService, SpeechOutputService, requestMicrophonePermission } from "@/lib/speech";
import { converseClinicalIntakeWithGemini } from "@/lib/gemini";

interface VoiceConversationStudioProps {
  apiKey: string;
  selectedLang: "hi-IN" | "en-IN";
  patientInfo: PatientInfo;
  vitals: VitalsData;
  conversationHistory?: ChatMessage[];
  onUpdateHistory: (history: ChatMessage[]) => void;
  onFinishConsultation: (narrativeText: string) => void;
  isLoadingSOAP: boolean;
}

const QUICK_SYMPTOM_CHIPS_HI = [
  "4 दिन से तेज बुखार और ठंड लग रही है",
  "पेट में तेज दर्द और उल्टी जैसा लग रहा है",
  "हाथों पर लाल चकत्ते निकल आए हैं",
  "सांस बहुत ज्यादा फूल रही है, सीने में भारीपन है",
  "बहुत कमजोरी और चक्कर आ रहे हैं",
];

const QUICK_SYMPTOM_CHIPS_EN = [
  "High fever with chills for 3 days",
  "Severe stomach pain and recurrent vomiting",
  "Red rash on arms with joint pain",
  "Difficulty breathing and chest tightness",
  "Severe weakness and postural dizziness",
];

export const VoiceConversationStudio: React.FC<VoiceConversationStudioProps> = ({
  apiKey,
  selectedLang,
  patientInfo,
  vitals,
  conversationHistory = [],
  onUpdateHistory,
  onFinishConsultation,
  isLoadingSOAP,
}) => {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [interimText, setInterimText] = useState("");
  const [manualInput, setManualInput] = useState("");
  const [micError, setMicError] = useState<string | null>(null);
  const [micPermissionGranted, setMicPermissionGranted] = useState<boolean | null>(null);
  const [selectedVoice, setSelectedVoice] = useState<"Aoede" | "Charon" | "Puck">("Aoede");
  const [isGeminiNativeVoice, setIsGeminiNativeVoice] = useState(false);
  const [activeStatus, setActiveStatus] = useState<
    "idle" | "listening" | "thinking" | "speaking"
  >("idle");

  const speechInputRef = useRef<SpeechInputService | null>(null);
  const speechOutputRef = useRef<SpeechOutputService | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const silenceTimerRef = useRef<any>(null);
  const latestTranscriptRef = useRef<string>("");

  const safeHistory = conversationHistory || [];

  useEffect(() => {
    speechInputRef.current = new SpeechInputService();
    speechOutputRef.current = new SpeechOutputService();

    // Check if permission was previously granted
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions
        .query({ name: "microphone" as PermissionName })
        .then((status) => {
          if (status.state === "granted") {
            setMicPermissionGranted(true);
          } else if (status.state === "denied") {
            setMicPermissionGranted(false);
            setMicError("Microphone access is currently blocked in your browser settings.");
          }
        })
        .catch(() => {});
    }

    return () => {
      if (speechInputRef.current) speechInputRef.current.stop();
      if (speechOutputRef.current) speechOutputRef.current.stop();
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    };
  }, []);

  // Auto-scroll chat to latest message
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [safeHistory, interimText, isThinking]);

  // Explicitly trigger the browser's native microphone permission popup
  const handleRequestPermission = async (): Promise<boolean> => {
    setMicError(null);
    const result = await requestMicrophonePermission();
    if (result.granted) {
      setMicPermissionGranted(true);
      return true;
    } else {
      setMicPermissionGranted(false);
      setMicError(result.error || "Microphone permission was not granted.");
      return false;
    }
  };

  // Start Voice Consultation: Triggers native mic popup, then greets patient
  const startConversation = async () => {
    setMicError(null);

    // 1. Force the native browser microphone permission popup to appear!
    const granted = await handleRequestPermission();
    if (!granted) {
      return;
    }

    if (safeHistory.length > 0) {
      startListening();
      return;
    }

    setIsThinking(true);
    setActiveStatus("thinking");

    try {
      const result = await converseClinicalIntakeWithGemini({
        apiKey,
        language: selectedLang,
        conversationHistory: [],
        patientInput: "",
        patientInfo,
        vitals,
        voiceName: selectedVoice,
      });

      const greeting = typeof result === "string" ? result : result.reply;
      const spokenRomaji = typeof result === "object" ? result.spokenRomaji : undefined;
      const audioBase64 = typeof result === "object" ? result.audioBase64 : undefined;

      const aiMsg: ChatMessage = {
        id: Date.now().toString(),
        sender: "gemini",
        text: greeting,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      onUpdateHistory([aiMsg]);
      setIsThinking(false);
      speakGeminiResponse(greeting, spokenRomaji, audioBase64);
    } catch (err: any) {
      console.error(err);
      setIsThinking(false);
      setActiveStatus("idle");
    }
  };

  // Speak Gemini Response aloud via Real Gemini Audio or Natural Voice
  const speakGeminiResponse = (
    text: string,
    spokenRomaji?: string,
    audioBase64?: string | null
  ) => {
    if (!speechOutputRef.current) return;

    setIsSpeaking(true);
    setActiveStatus("speaking");
    setIsGeminiNativeVoice(!!audioBase64);

    speechOutputRef.current.speak(text, {
      rate: selectedLang === "hi-IN" ? 0.95 : 1.0,
      lang: selectedLang === "hi-IN" ? "hi-IN" : "en-US",
      spokenRomajiFallback: spokenRomaji,
      audioBase64: audioBase64 || null,
      onStart: () => {
        setIsSpeaking(true);
        setActiveStatus("speaking");
      },
      onEnd: () => {
        setIsSpeaking(false);
        setActiveStatus("idle");
        // Automatically start listening for patient's reply
        startListening();
      },
      onError: () => {
        setIsSpeaking(false);
        setActiveStatus("idle");
        startListening();
      },
    });
  };

  // Start Speech Recognition
  const startListening = async () => {
    if (!speechInputRef.current) return;
    if (speechOutputRef.current) speechOutputRef.current.stop();
    setMicError(null);

    // Guarantee permission was requested
    if (!micPermissionGranted) {
      const granted = await handleRequestPermission();
      if (!granted) return;
    }

    setIsListening(true);
    setActiveStatus("listening");
    setInterimText("");
    latestTranscriptRef.current = "";

    const started = await speechInputRef.current.start(
      selectedLang,
      (transcript, isFinal) => {
        setInterimText(transcript);
        latestTranscriptRef.current = transcript;

        // Reset silence debounce timer
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
        }

        if (isFinal && transcript.trim().length > 2) {
          // Final sentence detected by Web Speech API
          handlePatientMessage(transcript.trim());
        } else if (transcript.trim().length > 2) {
          // Auto-send after 1.6s pause
          silenceTimerRef.current = setTimeout(() => {
            if (latestTranscriptRef.current.trim().length > 2) {
              handlePatientMessage(latestTranscriptRef.current.trim());
            }
          }, 1600);
        }
      },
      (err) => {
        console.warn("Mic Error:", err);
        setMicError(err);
        setIsListening(false);
        setActiveStatus("idle");
      },
      () => {
        setIsListening(false);
        if (activeStatus === "listening") setActiveStatus("idle");
      }
    );

    if (!started) {
      setIsListening(false);
      setActiveStatus("idle");
    }
  };

  // Stop Speech Recognition
  const stopListening = () => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (speechInputRef.current) {
      speechInputRef.current.stop();
    }
    setIsListening(false);
    setActiveStatus("idle");
  };

  // Send spoken transcript immediately without waiting for debounce
  const sendSpokenTranscriptNow = () => {
    const textToSend = latestTranscriptRef.current || interimText;
    if (textToSend.trim()) {
      handlePatientMessage(textToSend.trim());
    }
  };

  // Process Patient message -> Gemini follow-up question
  const handlePatientMessage = async (patientText: string) => {
    if (!patientText.trim()) return;

    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (speechInputRef.current) speechInputRef.current.stop();
    setIsListening(false);
    setInterimText("");
    latestTranscriptRef.current = "";
    setManualInput("");

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: "patient",
      text: patientText,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    const newHistory = [...safeHistory, userMsg];
    onUpdateHistory(newHistory);

    // Gemini Thinking & Reply
    setIsThinking(true);
    setActiveStatus("thinking");

    try {
      const result = await converseClinicalIntakeWithGemini({
        apiKey,
        language: selectedLang,
        conversationHistory: newHistory,
        patientInput: patientText,
        patientInfo,
        vitals,
        voiceName: selectedVoice,
      });

      const replyText = typeof result === "string" ? result : result.reply;
      const spokenRomaji = typeof result === "object" ? result.spokenRomaji : undefined;
      const audioBase64 = typeof result === "object" ? result.audioBase64 : undefined;

      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: "gemini",
        text: replyText,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      onUpdateHistory([...newHistory, aiMsg]);
      setIsThinking(false);
      speakGeminiResponse(replyText, spokenRomaji, audioBase64);
    } catch (e: any) {
      console.error(e);
      setIsThinking(false);
      setActiveStatus("idle");
    }
  };

  const handleFinish = () => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (speechInputRef.current) speechInputRef.current.stop();
    if (speechOutputRef.current) speechOutputRef.current.stop();

    const compiledNarrative = safeHistory
      .filter((m) => m.sender === "patient")
      .map((m) => m.text)
      .join(". ");

    onFinishConsultation(compiledNarrative);
  };

  const quickChips = selectedLang === "hi-IN" ? QUICK_SYMPTOM_CHIPS_HI : QUICK_SYMPTOM_CHIPS_EN;

  return (
    <div className="space-y-4">
      {/* Microphone Permission Notice if blocked */}
      {micError && (
        <div className="p-3 bg-rose-950/40 border border-rose-500/50 rounded-xl flex items-start gap-3 shadow-lg">
          <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <p className="font-bold text-rose-300">Microphone Permission Notice</p>
            <p className="text-rose-200/90 leading-relaxed">{micError}</p>
            <div className="pt-1 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleRequestPermission}
                className="px-2.5 py-1 rounded-lg bg-rose-500 hover:bg-rose-400 text-white font-bold text-[11px] shadow transition-all active:scale-95"
              >
                Trigger Permission Popup Again
              </button>
              <span className="text-[10px] text-slate-400">
                (Or click the tune/lock icon in your browser URL bar to Allow microphone)
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Visualizer & Status Hero Card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 border border-slate-800 p-4 sm:p-5 flex flex-col items-center justify-center text-center shadow-2xl">
        {/* Gemini AI Voice Persona Selector */}
        <div className="mb-2 flex flex-wrap items-center justify-center gap-1.5 p-1 rounded-xl bg-slate-900/90 border border-slate-800 text-[11px] shadow-sm">
          <span className="text-[10px] uppercase font-bold text-slate-400 px-1.5 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-teal-400" />
            <span>Voice Model:</span>
          </span>
          <button
            type="button"
            onClick={() => setSelectedVoice("Aoede")}
            className={`px-2.5 py-0.5 rounded-lg font-semibold transition-all active:scale-95 ${
              selectedVoice === "Aoede"
                ? "bg-teal-500 text-slate-950 shadow-sm font-bold"
                : "text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
            title="Aoede: Warm, empathetic female Gemini AI voice"
          >
            Aoede (Warm AI)
          </button>
          <button
            type="button"
            onClick={() => setSelectedVoice("Charon")}
            className={`px-2.5 py-0.5 rounded-lg font-semibold transition-all active:scale-95 ${
              selectedVoice === "Charon"
                ? "bg-teal-500 text-slate-950 shadow-sm font-bold"
                : "text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
            title="Charon: Calm, deep clinical doctor voice"
          >
            Charon (Doctor AI)
          </button>
          <button
            type="button"
            onClick={() => setSelectedVoice("Puck")}
            className={`px-2.5 py-0.5 rounded-lg font-semibold transition-all active:scale-95 ${
              selectedVoice === "Puck"
                ? "bg-teal-500 text-slate-950 shadow-sm font-bold"
                : "text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
            title="Puck: Friendly, upbeat male assistant voice"
          >
            Puck (Friendly)
          </button>
        </div>

        {/* Mic Status & Sound Controls */}
        <div className="mb-2 flex flex-wrap items-center justify-center gap-2">
          {micPermissionGranted ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Microphone Ready
            </span>
          ) : (
            <button
              type="button"
              onClick={handleRequestPermission}
              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/30 hover:bg-amber-500/20 transition-colors"
            >
              <Mic className="w-3 h-3 text-amber-400" />
              Click to Allow Microphone
            </button>
          )}

          {isGeminiNativeVoice && activeStatus === "speaking" && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40 animate-pulse">
              <Sparkles className="w-3 h-3 text-purple-400" />
              Gemini 2.0 Human Voice
            </span>
          )}

          <button
            type="button"
            onClick={() => {
              if (speechOutputRef.current) {
                const testHi = "नमस्ते! मैं रापिक्योर एआई हूँ। मेरी आवाज़ अब बिल्कुल साफ़ और नेचुरल है।";
                const testEn = "Hello! I am RapiCure AI. My voice is now natural, human, and clear.";
                speechOutputRef.current.speak(
                  selectedLang === "hi-IN" ? testHi : testEn,
                  {
                    lang: selectedLang === "hi-IN" ? "hi-IN" : "en-US",
                    spokenRomajiFallback:
                      selectedLang === "hi-IN"
                        ? "Namaste! Main RapiCure AI hoon. Meri awaaz ab natural aur human hai."
                        : testEn,
                  }
                );
              }
            }}
            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-teal-500/10 text-teal-300 border border-teal-500/30 hover:bg-teal-500/20 transition-colors active:scale-95"
            title="Click to test voice speaker output"
          >
            <Volume2 className="w-3 h-3 text-teal-400" />
            <span>Test Sound 🔊</span>
          </button>
        </div>

        {/* Glowing Interactive Orb */}
        <div className="relative flex items-center justify-center my-2">
          <button
            type="button"
            onClick={isListening ? stopListening : startListening}
            className={`w-20 h-20 sm:w-24 sm:h-24 rounded-full transition-all duration-500 flex items-center justify-center cursor-pointer ${
              activeStatus === "speaking"
                ? "bg-gradient-to-tr from-teal-500 via-cyan-400 to-emerald-400 animate-pulse shadow-lg shadow-teal-500/40 scale-110"
                : activeStatus === "listening"
                ? "bg-gradient-to-tr from-rose-500 to-amber-500 animate-bounce shadow-lg shadow-rose-500/40 ring-8 ring-rose-500/25 scale-105"
                : activeStatus === "thinking"
                ? "bg-gradient-to-tr from-purple-500 to-indigo-500 animate-spin shadow-lg shadow-purple-500/30"
                : "bg-slate-800 hover:bg-slate-750 border border-slate-700 shadow-inner"
            }`}
            title={isListening ? "Click to pause microphone" : "Click to activate microphone"}
          >
            {activeStatus === "speaking" && <Volume2 className="w-8 h-8 text-slate-950 animate-pulse" />}
            {activeStatus === "listening" && <Mic className="w-8 h-8 text-white animate-pulse" />}
            {activeStatus === "thinking" && <Sparkles className="w-8 h-8 text-white" />}
            {activeStatus === "idle" && <Bot className="w-8 h-8 text-teal-400" />}
          </button>

          {/* Sound Wave Ripple Effect when active */}
          {activeStatus === "listening" && (
            <div className="absolute inset-0 -m-3 rounded-full border-2 border-rose-400/50 animate-ping pointer-events-none" />
          )}
          {activeStatus === "speaking" && (
            <div className="absolute inset-0 -m-3 rounded-full border-2 border-teal-400/50 animate-ping pointer-events-none" />
          )}
        </div>

        {/* Dynamic Status Text */}
        <div className="mt-2 space-y-0.5">
          <h4 className="text-sm font-bold text-white tracking-wide">
            {activeStatus === "speaking" && "🤖 RapiCure AI Speaking..."}
            {activeStatus === "listening" && "🎤 Listening to You! Please Speak..."}
            {activeStatus === "thinking" && "🧠 RapiCure AI is Thinking..."}
            {activeStatus === "idle" && (safeHistory.length === 0 ? "RapiCure Voice Consultation Ready" : "Voice Consultation Active")}
          </h4>
          <p className="text-[11px] text-slate-400">
            {activeStatus === "listening"
              ? selectedLang === "hi-IN" ? "अपनी समस्या खुलकर बोलें (हिंदी या अंग्रेजी)..." : "Speak symptoms naturally..."
              : "Bilingual Clinical Voice Dialogue (Hindi / English)"}
          </p>
        </div>

        {/* Live Interim Speech Preview when user is speaking */}
        {isListening && (
          <div className="mt-3 w-full max-w-md p-2 rounded-xl bg-slate-950 border border-rose-500/40 text-xs text-rose-200 flex items-center justify-between gap-2 shadow-inner">
            <div className="flex items-center gap-2 truncate">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping shrink-0" />
              <span className="truncate italic">
                {interimText || "Listening for speech..."}
              </span>
            </div>
            {interimText && (
              <button
                type="button"
                onClick={sendSpokenTranscriptNow}
                className="px-2 py-1 rounded bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-[10px] shrink-0"
              >
                Send Now ↵
              </button>
            )}
          </div>
        )}

        {/* Primary Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-2.5 mt-4">
          {safeHistory.length === 0 ? (
            <button
              type="button"
              onClick={startConversation}
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-teal-400 to-emerald-400 hover:from-teal-300 hover:to-emerald-300 text-slate-950 shadow-lg shadow-teal-500/25 transition-all active:scale-95 flex items-center gap-2"
            >
              <Mic className="w-4 h-4 fill-slate-950" />
              <span>Start Voice Consultation</span>
            </button>
          ) : (
            <>
              {isListening ? (
                <button
                  type="button"
                  onClick={stopListening}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-500 hover:bg-rose-400 text-white shadow-lg shadow-rose-500/30 transition-all flex items-center gap-1.5 active:scale-95"
                >
                  <MicOff className="w-4 h-4" />
                  <span>Pause Mic</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={startListening}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-teal-500 to-emerald-400 hover:from-teal-400 hover:to-emerald-300 text-slate-950 shadow-lg shadow-teal-500/30 transition-all flex items-center gap-1.5 active:scale-95"
                >
                  <Mic className="w-4 h-4" />
                  <span>Tap to Speak Reply</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleFinish}
                disabled={isLoadingSOAP}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 shadow-md transition-all active:scale-95 flex items-center gap-1.5"
              >
                {isLoadingSOAP ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-400" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
                )}
                <span>Finish & Generate SOAP Note</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Real-time Dialogue Stream */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
            <span>Conversational Dialogue Stream</span>
            {safeHistory.length > 0 && (
              <span className="text-teal-400 font-normal">({safeHistory.length} turns)</span>
            )}
          </label>
          {safeHistory.length > 0 && (
            <button
              type="button"
              onClick={() => onUpdateHistory([])}
              className="text-[10px] text-slate-500 hover:text-slate-300 flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" /> Clear Chat
            </button>
          )}
        </div>

        <div
          ref={chatScrollRef}
          className="h-56 overflow-y-auto space-y-2.5 p-3 rounded-xl bg-slate-950/80 border border-slate-800/90 text-xs"
        >
          {safeHistory.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 space-y-1">
              <Bot className="w-6 h-6 text-slate-600" />
              <p>Click "Start Voice Consultation" to begin AI audio interview.</p>
              <p className="text-[10px] text-slate-600">Your browser will ask for microphone permission.</p>
            </div>
          ) : (
            safeHistory.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${
                  msg.sender === "patient" ? "justify-end" : "justify-start"
                }`}
              >
                {msg.sender === "gemini" && (
                  <div className="w-6 h-6 rounded-full bg-teal-500/20 border border-teal-500/40 text-teal-300 flex items-center justify-center shrink-0 text-[10px] font-bold">
                    AI
                  </div>
                )}
                <div
                  className={`max-w-[82%] p-2.5 rounded-2xl leading-relaxed ${
                    msg.sender === "patient"
                      ? "bg-teal-600 text-white rounded-br-none"
                      : "bg-slate-900 border border-slate-750 text-slate-200 rounded-bl-none shadow"
                  }`}
                >
                  <p className="text-xs">{msg.text}</p>
                  <span className="text-[9px] text-slate-400 mt-1 block text-right">
                    {msg.timestamp}
                  </span>
                </div>
                {msg.sender === "patient" && (
                  <div className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 text-slate-300 flex items-center justify-center shrink-0 text-[10px] font-bold">
                    P
                  </div>
                )}
              </div>
            ))
          )}

          {/* Thinking indicator */}
          {isThinking && (
            <div className="flex gap-2.5 justify-start">
              <div className="w-6 h-6 rounded-full bg-teal-500/20 text-teal-300 flex items-center justify-center shrink-0 text-[10px] font-bold">
                AI
              </div>
              <div className="p-2.5 rounded-2xl bg-slate-900 border border-slate-800 text-slate-400 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-ping" />
                <span className="text-xs">RapiCure is thinking response...</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick Symptom Chips */}
      <div className="space-y-1.5">
        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
          Quick Symptom Prompts (1-Click Reply)
        </label>
        <div className="flex flex-wrap gap-1.5">
          {quickChips.map((chip, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handlePatientMessage(chip)}
              className="px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-850 border border-slate-800 hover:border-teal-500/40 text-[11px] text-slate-300 hover:text-white transition-all text-left active:scale-95"
            >
              + {chip}
            </button>
          ))}
        </div>
      </div>

      {/* Manual Text Input fallback */}
      <div className="flex items-center gap-2 pt-1">
        <input
          type="text"
          value={manualInput}
          onChange={(e) => setManualInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handlePatientMessage(manualInput);
          }}
          placeholder={selectedLang === "hi-IN" ? "या यहाँ टाइप करें..." : "Or type symptoms here..."}
          className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-teal-500"
        />
        <button
          type="button"
          onClick={() => handlePatientMessage(manualInput)}
          disabled={!manualInput.trim()}
          className="p-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 disabled:opacity-40 transition-all font-bold"
          title="Send message"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

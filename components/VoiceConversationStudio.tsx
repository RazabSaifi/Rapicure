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
} from "lucide-react";
import { ChatMessage, PatientInfo, VitalsData } from "@/lib/types";
import { SpeechInputService, SpeechOutputService } from "@/lib/speech";
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
  "4 दिन से तेज बुखार है",
  "पेट में तेज दर्द और उल्टी जैसा लग रहा है",
  "हाथों पर लाल चकत्ते निकल आए हैं",
  "सांस बहुत ज्यादा फूल रही है",
  "बहुत कमजोरी और चक्कर आ रहे हैं",
];

const QUICK_SYMPTOM_CHIPS_EN = [
  "High fever with chills for 3 days",
  "Severe stomach pain and vomiting",
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
  const [activeStatus, setActiveStatus] = useState<
    "idle" | "listening" | "thinking" | "speaking"
  >("idle");

  const speechInputRef = useRef<SpeechInputService | null>(null);
  const speechOutputRef = useRef<SpeechOutputService | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  const safeHistory = conversationHistory || [];

  useEffect(() => {
    speechInputRef.current = new SpeechInputService();
    speechOutputRef.current = new SpeechOutputService();

    return () => {
      if (speechInputRef.current) speechInputRef.current.stop();
      if (speechOutputRef.current) speechOutputRef.current.stop();
    };
  }, []);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [safeHistory, interimText, isThinking]);

  // Initial greeting when conversation is started
  const startConversation = async () => {
    if (safeHistory.length > 0) return;

    setIsThinking(true);
    setActiveStatus("thinking");

    const greeting = await converseClinicalIntakeWithGemini({
      apiKey,
      language: selectedLang,
      conversationHistory: [],
      patientInput: "",
      patientInfo,
      vitals,
    });

    const aiMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: "gemini",
      text: greeting,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    onUpdateHistory([aiMsg]);
    setIsThinking(false);
    speakGeminiResponse(greeting);
  };

  // Speak Gemini Response aloud via TTS
  const speakGeminiResponse = (text: string) => {
    if (!speechOutputRef.current) return;

    setIsSpeaking(true);
    setActiveStatus("speaking");

    speechOutputRef.current.speak(text, {
      rate: selectedLang === "hi-IN" ? 1.0 : 1.05,
      lang: selectedLang === "hi-IN" ? "hi-IN" : "en-US",
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
      },
    });
  };

  // Start Speech Recognition
  const startListening = () => {
    if (!speechInputRef.current) return;
    if (speechOutputRef.current) speechOutputRef.current.stop();

    setIsListening(true);
    setActiveStatus("listening");
    setInterimText("");

    speechInputRef.current.start(
      selectedLang,
      (transcript, isFinal) => {
        setInterimText(transcript);
        if (isFinal && transcript.trim().length > 2) {
          handlePatientMessage(transcript.trim());
        }
      },
      (err) => {
        console.warn("Mic Error:", err);
        setIsListening(false);
        setActiveStatus("idle");
      },
      () => {
        setIsListening(false);
        if (activeStatus === "listening") setActiveStatus("idle");
      }
    );
  };

  // Stop Speech Recognition
  const stopListening = () => {
    if (speechInputRef.current) {
      speechInputRef.current.stop();
    }
    setIsListening(false);
    setActiveStatus("idle");
  };

  // Process Patient message -> Gemini reply
  const handlePatientMessage = async (patientText: string) => {
    if (!patientText.trim()) return;

    if (speechInputRef.current) speechInputRef.current.stop();
    setIsListening(false);
    setInterimText("");
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
      const reply = await converseClinicalIntakeWithGemini({
        apiKey,
        language: selectedLang,
        conversationHistory: newHistory,
        patientInput: patientText,
        patientInfo,
        vitals,
      });

      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: "gemini",
        text: reply,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      onUpdateHistory([...newHistory, aiMsg]);
      setIsThinking(false);
      speakGeminiResponse(reply);
    } catch (e) {
      console.error(e);
      setIsThinking(false);
      setActiveStatus("idle");
    }
  };

  const handleFinish = () => {
    if (speechInputRef.current) speechInputRef.current.stop();
    if (speechOutputRef.current) speechOutputRef.current.stop();

    // Compile narrative from patient messages
    const compiledNarrative = safeHistory
      .filter((m) => m.sender === "patient")
      .map((m) => m.text)
      .join(". ");

    onFinishConsultation(compiledNarrative);
  };

  const quickChips = selectedLang === "hi-IN" ? QUICK_SYMPTOM_CHIPS_HI : QUICK_SYMPTOM_CHIPS_EN;

  return (
    <div className="space-y-4">
      {/* Visualizer & Status Hero Card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 border border-slate-800 p-4 sm:p-5 flex flex-col items-center justify-center text-center shadow-2xl">
        {/* Glowing Orb Animation */}
        <div className="relative flex items-center justify-center my-2">
          <div
            className={`w-20 h-20 sm:w-24 sm:h-24 rounded-full transition-all duration-500 flex items-center justify-center ${
              activeStatus === "speaking"
                ? "bg-gradient-to-tr from-teal-500 via-cyan-400 to-emerald-400 animate-pulse shadow-lg shadow-teal-500/40 scale-110"
                : activeStatus === "listening"
                ? "bg-gradient-to-tr from-rose-500 to-amber-500 animate-bounce shadow-lg shadow-rose-500/40 ring-8 ring-rose-500/20"
                : activeStatus === "thinking"
                ? "bg-gradient-to-tr from-purple-500 to-indigo-500 animate-spin shadow-lg shadow-purple-500/30"
                : "bg-slate-800 border border-slate-700 shadow-inner"
            }`}
          >
            {activeStatus === "speaking" && <Volume2 className="w-8 h-8 text-slate-950 animate-pulse" />}
            {activeStatus === "listening" && <Mic className="w-8 h-8 text-white animate-pulse" />}
            {activeStatus === "thinking" && <Sparkles className="w-8 h-8 text-white" />}
            {activeStatus === "idle" && <Bot className="w-8 h-8 text-slate-400" />}
          </div>

          {/* Animated sound waves when speaking */}
          {activeStatus === "speaking" && (
            <div className="absolute inset-0 -m-3 rounded-full border border-teal-400/40 animate-ping pointer-events-none" />
          )}
        </div>

        {/* Dynamic Status Text */}
        <div className="mt-2 space-y-0.5">
          <h4 className="text-sm font-bold text-white tracking-wide">
            {activeStatus === "speaking" && "🤖 RapiCure AI Speaking..."}
            {activeStatus === "listening" && "🎤 Listening to Patient..."}
            {activeStatus === "thinking" && "🧠 RapiCure AI is Analyzing Symptoms..."}
            {activeStatus === "idle" && (safeHistory.length === 0 ? "RapiCure Voice Consultation Ready" : "Voice Consultation Active")}
          </h4>
          <p className="text-[11px] text-slate-400">
            {activeStatus === "listening"
              ? selectedLang === "hi-IN" ? "मरीज अपनी समस्या खुलकर बोलें..." : "Please speak your symptoms naturally..."
              : "Bilingual Clinical Voice Interview (Hindi / English)"}
          </p>
        </div>

        {/* Primary Controls */}
        <div className="flex flex-wrap items-center justify-center gap-2.5 mt-4">
          {safeHistory.length === 0 ? (
            <button
              type="button"
              onClick={startConversation}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-teal-400 to-emerald-400 hover:from-teal-300 hover:to-emerald-300 text-slate-950 shadow-lg shadow-teal-500/25 transition-all active:scale-95 flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4 fill-slate-950" />
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
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-teal-500 hover:bg-teal-400 text-slate-950 shadow-lg shadow-teal-500/30 transition-all flex items-center gap-1.5 active:scale-95"
                >
                  <Mic className="w-4 h-4" />
                  <span>Speak Reply</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleFinish}
                disabled={isLoadingSOAP}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 shadow-md transition-all active:scale-95 flex items-center gap-1.5"
              >
                {isLoadingSOAP ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5" />
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

          {/* Interim transcript while user is speaking */}
          {interimText && (
            <div className="flex gap-2.5 justify-end">
              <div className="max-w-[82%] p-2.5 rounded-2xl bg-teal-600/60 text-white border border-teal-400/40 italic animate-pulse">
                <p className="text-xs">{interimText} ...</p>
              </div>
            </div>
          )}

          {/* Thinking indicator */}
          {isThinking && (
            <div className="flex gap-2.5 justify-start">
              <div className="w-6 h-6 rounded-full bg-teal-500/20 text-teal-300 flex items-center justify-center shrink-0 text-[10px] font-bold">
                AI
              </div>
              <div className="p-2.5 rounded-2xl bg-slate-900 border border-slate-800 text-slate-400 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-ping" />
                <span className="text-xs">Thinking response...</span>
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

      {/* Optional Manual Text Input if patient prefers typing */}
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

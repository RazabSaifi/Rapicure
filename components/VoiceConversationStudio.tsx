"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
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
  Radio,
  Zap,
  Sliders,
  AlertCircle,
  Square,
  RefreshCw,
  Info,
} from "lucide-react";
import { ChatMessage, PatientInfo, VitalsData } from "@/lib/types";
import { SpeechInputService, SpeechOutputService } from "@/lib/speech";
import { converseClinicalIntakeWithGemini } from "@/lib/gemini";
import { GeminiLiveClient } from "@/lib/liveAudioService";

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
  "4 दिन से तेज बुखार और कंपकंपी है",
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

const LIVE_VOICES: Array<{ id: "Aoede" | "Zephyr" | "Kore" | "Puck" | "Fenrir"; name: string; desc: string }> = [
  { id: "Aoede", name: "Aoede (Warm Clinician)", desc: "Empathetic, clear, professional" },
  { id: "Zephyr", name: "Zephyr (Crisp)", desc: "Quick, articulate triage voice" },
  { id: "Kore", name: "Kore (Gentle)", desc: "Calm, reassuring bedside manner" },
  { id: "Puck", name: "Puck (Energetic)", desc: "Bright, friendly cadence" },
  { id: "Fenrir", name: "Fenrir (Authoritative)", desc: "Deep, calm senior doctor" },
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
  // Mode: "live" uses gemini-3.8-live over WebSocket with native 24kHz audio; "standard" uses browser TTS/STT + REST
  const [useLiveApi, setUseLiveApi] = useState(true);
  const [selectedVoice, setSelectedVoice] = useState<"Aoede" | "Zephyr" | "Kore" | "Puck" | "Fenrir">("Aoede");

  // Live status states
  const [liveStatus, setLiveStatus] = useState<"idle" | "connecting" | "ready" | "listening" | "speaking" | "error">("idle");
  const [statusMessage, setStatusMessage] = useState<string>("Ready to start voice consultation");
  const [hasMicAccess, setHasMicAccess] = useState<boolean | null>(null);
  const [micNotice, setMicNotice] = useState<string | null>(null);

  const [inputAudioLevel, setInputAudioLevel] = useState(0);
  const [outputAudioLevel, setOutputAudioLevel] = useState(0);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [manualInput, setManualInput] = useState("");
  const [interimText, setInterimText] = useState("");
  const [isThinking, setIsThinking] = useState(false);

  // References
  const liveClientRef = useRef<GeminiLiveClient | null>(null);
  const speechInputRef = useRef<SpeechInputService | null>(null);
  const speechOutputRef = useRef<SpeechOutputService | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const accumulatedAgentTranscriptRef = useRef<string>("");

  const safeHistory = conversationHistory || [];

  // Scroll to bottom on updates
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [safeHistory, interimText, liveStatus]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (liveClientRef.current) {
        liveClientRef.current.stop();
      }
      if (speechInputRef.current) speechInputRef.current.stop();
      if (speechOutputRef.current) speechOutputRef.current.stop();
    };
  }, []);

  // Initialize and start Gemini 3.8 Live session
  const startLiveConversation = useCallback(async () => {
    if (liveClientRef.current) {
      liveClientRef.current.stop();
    }

    accumulatedAgentTranscriptRef.current = "";
    setMicNotice(null);

    const client = new GeminiLiveClient({
      onStatusChange: (status, msg) => {
        setLiveStatus(status);
        if (msg) setStatusMessage(msg);
      },
      onMicPermissionChange: (hasMic, notice) => {
        setHasMicAccess(hasMic);
        if (notice) setMicNotice(notice);
      },
      onAudioLevelChange: (inLevel, outLevel) => {
        setInputAudioLevel(inLevel);
        setOutputAudioLevel(outLevel);
      },
      onTranscriptAgent: (text) => {
        accumulatedAgentTranscriptRef.current += text;
      },
      onTranscriptUser: (text) => {
        const userMsg: ChatMessage = {
          id: Date.now().toString(),
          sender: "patient",
          text,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        };
        onUpdateHistory([...safeHistory, userMsg]);
      },
      onTurnComplete: () => {
        const fullAgentText = accumulatedAgentTranscriptRef.current.trim();
        if (fullAgentText) {
          const aiMsg: ChatMessage = {
            id: Date.now().toString(),
            sender: "gemini",
            text: fullAgentText,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          };
          onUpdateHistory([...safeHistory, aiMsg]);
          accumulatedAgentTranscriptRef.current = "";
        }
      },
      onInterrupted: () => {
        setOutputAudioLevel(0);
        setStatusMessage("Patient speaking (Barge-in active)");
      },
      onError: (err) => {
        console.warn("Live API Notice:", err);
        setStatusMessage(err);
      },
    });

    liveClientRef.current = client;

    await client.start({
      apiKey,
      language: selectedLang,
      voiceName: selectedVoice,
      patientInfo: {
        name: patientInfo.name,
        age: patientInfo.age,
        gender: patientInfo.gender,
      },
      vitals: {
        bpSystolic: vitals.bpSystolic,
        bpDiastolic: vitals.bpDiastolic,
        pulse: vitals.pulse,
        temp: vitals.temp,
        spo2: vitals.spo2,
      },
    });
  }, [apiKey, selectedLang, selectedVoice, patientInfo, vitals, safeHistory, onUpdateHistory]);

  const handleRetryMic = async () => {
    if (liveClientRef.current) {
      const ok = await liveClientRef.current.retryMicrophone();
      if (ok) {
        setHasMicAccess(true);
        setMicNotice(null);
        setStatusMessage("Microphone connected successfully!");
      }
    }
  };

  const stopLiveConversation = () => {
    if (liveClientRef.current) {
      liveClientRef.current.stop();
      liveClientRef.current = null;
    }
    setLiveStatus("idle");
    setStatusMessage("Live consultation ended");
    setInputAudioLevel(0);
    setOutputAudioLevel(0);
    setMicNotice(null);
  };

  const toggleMute = () => {
    if (!liveClientRef.current) return;
    const nextMuted = !isMicMuted;
    setIsMicMuted(nextMuted);
    liveClientRef.current.setMute(nextMuted);
  };

  const interruptModel = () => {
    if (liveClientRef.current) {
      liveClientRef.current.interrupt();
    }
  };

  // Fallback Standard Speech Recognition mode
  const startStandardConversation = async () => {
    if (safeHistory.length > 0) return;

    setIsThinking(true);
    setLiveStatus("connecting");
    setStatusMessage("Analyzing clinical context...");

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
    setLiveStatus("speaking");
    speakStandardGeminiResponse(greeting);
  };

  const speakStandardGeminiResponse = (text: string) => {
    if (!speechOutputRef.current) speechOutputRef.current = new SpeechOutputService();

    speechOutputRef.current.speak(text, {
      rate: selectedLang === "hi-IN" ? 1.0 : 1.05,
      lang: selectedLang === "hi-IN" ? "hi-IN" : "en-US",
      onStart: () => setLiveStatus("speaking"),
      onEnd: () => {
        setLiveStatus("idle");
        startStandardListening();
      },
      onError: () => setLiveStatus("idle"),
    });
  };

  const startStandardListening = () => {
    if (!speechInputRef.current) speechInputRef.current = new SpeechInputService();
    if (speechOutputRef.current) speechOutputRef.current.stop();

    setLiveStatus("listening");
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
        console.warn("Standard Mic Error:", err);
        setLiveStatus("idle");
      },
      () => {
        setLiveStatus("idle");
      }
    );
  };

  // Handle patient message from text input or chip
  const handlePatientMessage = async (patientText: string) => {
    if (!patientText.trim()) return;

    setInterimText("");
    setManualInput("");

    // If in Live mode and connected, send to live session
    if (useLiveApi && liveClientRef.current && (liveStatus === "ready" || liveStatus === "listening" || liveStatus === "speaking")) {
      liveClientRef.current.sendTextMessage(patientText);
      const userMsg: ChatMessage = {
        id: Date.now().toString(),
        sender: "patient",
        text: patientText,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      onUpdateHistory([...safeHistory, userMsg]);
      return;
    }

    // Standard mode fallback
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: "patient",
      text: patientText,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    const newHistory = [...safeHistory, userMsg];
    onUpdateHistory(newHistory);

    setIsThinking(true);
    setLiveStatus("connecting");

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
      speakStandardGeminiResponse(reply);
    } catch (e) {
      console.error(e);
      setIsThinking(false);
      setLiveStatus("idle");
    }
  };

  const handleFinish = () => {
    if (liveClientRef.current) {
      liveClientRef.current.stop();
    }
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
  const isLiveActive = liveStatus === "ready" || liveStatus === "listening" || liveStatus === "speaking";

  return (
    <div className="space-y-4">
      {/* Model & Live Architecture Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-[11px] font-semibold">
            <Radio className={`w-3.5 h-3.5 ${isLiveActive ? "animate-pulse text-emerald-400" : "text-emerald-500"}`} />
            <span>gemini-3.8-live</span>
          </div>

          {hasMicAccess === true && (
            <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-medium bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
              <Mic className="w-3 h-3 text-emerald-400" />
              Mic Active
            </span>
          )}

          {hasMicAccess === false && (
            <span className="flex items-center gap-1 text-[10px] text-amber-400 font-medium bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
              <Volume2 className="w-3 h-3 text-amber-400" />
              Text-to-Voice (Mic Denied)
            </span>
          )}
        </div>

        {/* Live Voice Selector */}
        <div className="flex items-center gap-2">
          <label className="text-[11px] text-slate-400 flex items-center gap-1">
            <Volume2 className="w-3.5 h-3.5 text-slate-400" />
            <span>Voice:</span>
          </label>
          <select
            value={selectedVoice}
            disabled={isLiveActive}
            onChange={(e) => setSelectedVoice(e.target.value as any)}
            className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-[11px] text-slate-200 focus:outline-none focus:border-teal-500 disabled:opacity-50"
          >
            {LIVE_VOICES.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setUseLiveApi(!useLiveApi)}
            disabled={isLiveActive}
            className={`px-2 py-1 rounded-lg text-[10px] font-semibold transition-all border ${
              useLiveApi
                ? "bg-teal-500/20 text-teal-300 border-teal-500/40"
                : "bg-slate-800 text-slate-400 border-slate-700"
            }`}
            title="Toggle between Live WebSocket streaming and Standard Web Speech"
          >
            {useLiveApi ? "⚡ Live WebSocket Mode" : "Standard Web Speech"}
          </button>
        </div>
      </div>

      {/* Helpful Permission Notice if Mic was blocked */}
      {micNotice && (
        <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-2.5 animate-fadeIn">
          <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1 space-y-1">
            <p className="font-semibold text-amber-300">Microphone Access Denied by Browser</p>
            <p className="text-[11px] text-amber-200/90 leading-relaxed">
              Gemini 3.8 Live is active in <strong>Text-to-Voice Mode</strong>: it will still speak aloud in 24kHz audio. You can reply using symptom chips or typing.
            </p>
            <div className="pt-1 flex items-center gap-2">
              <button
                type="button"
                onClick={handleRetryMic}
                className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 text-[10px] font-semibold flex items-center gap-1 transition-all"
              >
                <RefreshCw className="w-3 h-3 text-amber-300" />
                <span>Retry Microphone Permission</span>
              </button>
              <span className="text-[10px] text-amber-400/80">
                (Click the lock/tune icon in the browser address bar to allow mic)
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Visualizer & Status Hero Card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 border border-slate-800 p-4 sm:p-6 flex flex-col items-center justify-center text-center shadow-2xl">
        {/* Real-time Dynamic Waveform Bars */}
        <div className="w-full max-w-xs h-10 flex items-center justify-center gap-1.5 mb-2">
          {Array.from({ length: 18 }).map((_, idx) => {
            const level = liveStatus === "speaking" ? outputAudioLevel : inputAudioLevel;
            const seed = Math.sin(idx * 0.7 + Date.now() * 0.003) * 0.5 + 0.5;
            const barHeight = isLiveActive
              ? Math.max(6, Math.min(36, Math.round((level / 100) * 36 * seed + 6)))
              : 6;

            const isCenter = idx >= 6 && idx <= 12;
            const color =
              liveStatus === "speaking"
                ? "bg-teal-400"
                : liveStatus === "listening"
                ? "bg-rose-400"
                : "bg-slate-700";

            return (
              <div
                key={idx}
                style={{ height: `${barHeight}px` }}
                className={`w-1.5 rounded-full transition-all duration-75 ${color} ${
                  isCenter && isLiveActive ? "opacity-100 shadow-sm shadow-teal-400/50" : "opacity-70"
                }`}
              />
            );
          })}
        </div>

        {/* Glowing Central Pulsing Orb */}
        <div className="relative flex items-center justify-center my-2">
          <div
            className={`w-20 h-20 sm:w-24 sm:h-24 rounded-full transition-all duration-500 flex items-center justify-center ${
              liveStatus === "speaking"
                ? "bg-gradient-to-tr from-teal-500 via-cyan-400 to-emerald-400 animate-pulse shadow-lg shadow-teal-500/50 scale-110"
                : liveStatus === "listening"
                ? "bg-gradient-to-tr from-rose-500 to-amber-500 shadow-lg shadow-rose-500/40 ring-8 ring-rose-500/20 scale-105"
                : liveStatus === "connecting"
                ? "bg-gradient-to-tr from-purple-500 to-indigo-500 animate-spin shadow-lg shadow-purple-500/40"
                : liveStatus === "ready"
                ? "bg-gradient-to-tr from-emerald-500 to-teal-500 shadow-lg shadow-emerald-500/30"
                : "bg-slate-800 border border-slate-700 shadow-inner"
            }`}
          >
            {liveStatus === "speaking" && <Volume2 className="w-8 h-8 text-slate-950 animate-pulse" />}
            {liveStatus === "listening" && <Mic className="w-8 h-8 text-white animate-pulse" />}
            {liveStatus === "connecting" && <Sparkles className="w-8 h-8 text-white" />}
            {liveStatus === "ready" && <Radio className="w-8 h-8 text-slate-950 animate-pulse" />}
            {liveStatus === "idle" && <Bot className="w-8 h-8 text-slate-400" />}
            {liveStatus === "error" && <AlertCircle className="w-8 h-8 text-rose-300" />}
          </div>

          {/* Radiating live waves */}
          {(liveStatus === "speaking" || liveStatus === "listening") && (
            <div className="absolute inset-0 -m-3 rounded-full border border-teal-400/30 animate-ping pointer-events-none" />
          )}
        </div>

        {/* Dynamic Status Title & Description */}
        <div className="mt-2 space-y-1">
          <div className="flex items-center justify-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                isLiveActive ? "bg-emerald-400 animate-pulse" : "bg-slate-500"
              }`}
            />
            <h4 className="text-sm font-bold text-white tracking-wide">
              {liveStatus === "speaking" && "Gemini 3.8 Live Speaking..."}
              {liveStatus === "listening" && (hasMicAccess ? "Listening to Patient (Mic Active)..." : "Waiting for Patient Response...")}
              {liveStatus === "connecting" && "Establishing Low-Latency Stream..."}
              {liveStatus === "ready" && "Connected to Gemini 3.8 Live"}
              {liveStatus === "idle" && (safeHistory.length === 0 ? "Gemini 3.8 Live Voice Consultation" : "Live Consultation Ready")}
              {liveStatus === "error" && "Connection Notice"}
            </h4>
          </div>
          <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
            {liveStatus === "speaking"
              ? "You can interrupt at any moment by speaking or typing."
              : liveStatus === "listening"
              ? hasMicAccess
                ? selectedLang === "hi-IN"
                  ? "मरीज अपनी समस्या खुलकर बोलें (हिंदी / English)..."
                  : "Please describe your symptoms naturally..."
                : selectedLang === "hi-IN"
                ? "लक्षण नीचे टाइप करें या क्विक प्रॉम्प्ट चुनें..."
                : "Type symptoms below or click quick prompt chips..."
              : statusMessage}
          </p>
        </div>

        {/* Primary Live Controls */}
        <div className="flex flex-wrap items-center justify-center gap-2.5 mt-4">
          {!isLiveActive ? (
            <button
              type="button"
              onClick={useLiveApi ? startLiveConversation : startStandardConversation}
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-teal-400 to-emerald-400 hover:from-teal-300 hover:to-emerald-300 text-slate-950 shadow-lg shadow-teal-500/25 transition-all active:scale-95 flex items-center gap-2"
            >
              <Zap className="w-4 h-4 fill-slate-950" />
              <span>Start Gemini 3.8 Live Conversation</span>
            </button>
          ) : (
            <>
              {/* Mic Mute / Unmute (only if mic is available) */}
              {hasMicAccess && (
                <button
                  type="button"
                  onClick={toggleMute}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 active:scale-95 border ${
                    isMicMuted
                      ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                      : "bg-slate-800 hover:bg-slate-750 text-slate-200 border-slate-700"
                  }`}
                >
                  {isMicMuted ? <MicOff className="w-3.5 h-3.5 text-amber-400" /> : <Mic className="w-3.5 h-3.5" />}
                  <span>{isMicMuted ? "Unmute Mic" : "Mute Mic"}</span>
                </button>
              )}

              {/* Interrupt / Barge-in Button */}
              {liveStatus === "speaking" && (
                <button
                  type="button"
                  onClick={interruptModel}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 transition-all flex items-center gap-1.5 active:scale-95"
                >
                  <Square className="w-3.5 h-3.5" />
                  <span>Interrupt</span>
                </button>
              )}

              {/* End Live Session */}
              <button
                type="button"
                onClick={stopLiveConversation}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700 transition-all flex items-center gap-1.5 active:scale-95"
              >
                <span>End Call</span>
              </button>

              {/* Finish & Transfer to SOAP */}
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
                <span>Finish & Generate SOAP Triage</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Real-time Dialogue Stream */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <span>Conversational Dialogue Stream</span>
            {safeHistory.length > 0 && (
              <span className="text-teal-400 font-mono">({safeHistory.length} turns)</span>
            )}
            {isLiveActive && (
              <span className="flex items-center gap-1 text-[9px] text-emerald-400 font-mono bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                Live Session Active
              </span>
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
          className="h-56 overflow-y-auto space-y-2.5 p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/90 text-xs"
        >
          {safeHistory.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 space-y-2">
              <div className="w-10 h-10 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center">
                <Zap className="w-5 h-5 text-teal-400" />
              </div>
              <div>
                <p className="text-slate-300 font-medium">Gemini 3.8 Live Voice Scribe</p>
                <p className="text-[11px] text-slate-500">
                  Click "Start Gemini 3.8 Live Conversation" to begin real-time bilingual medical intake.
                </p>
              </div>
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
                <span className="text-xs">Processing response...</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick Symptom Chips */}
      <div className="space-y-1.5">
        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
          Quick Symptom Prompts (1-Click Reply into Live Stream)
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

      {/* Manual Text Input if patient or nurse prefers typing */}
      <div className="flex items-center gap-2 pt-1">
        <input
          type="text"
          value={manualInput}
          onChange={(e) => setManualInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handlePatientMessage(manualInput);
          }}
          placeholder={
            isLiveActive
              ? "Type symptom or question directly to Gemini 3.8 Live..."
              : selectedLang === "hi-IN"
              ? "मरीज के लक्षण यहाँ लिखें..."
              : "Type symptoms here..."
          }
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

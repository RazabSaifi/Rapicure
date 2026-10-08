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
  Play,
  ExternalLink,
  PhoneCall,
  PhoneOff,
} from "lucide-react";
import { ChatMessage, PatientInfo, VitalsData } from "@/lib/types";
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
  const [selectedVoice, setSelectedVoice] = useState<"Aoede" | "Zephyr" | "Kore" | "Puck" | "Fenrir">("Aoede");
  const [liveStatus, setLiveStatus] = useState<"idle" | "connecting" | "ready" | "listening" | "speaking" | "error">("idle");
  const [statusMessage, setStatusMessage] = useState<string>("Ready to start Gemini Live voice call");
  const [hasMicAccess, setHasMicAccess] = useState<boolean | null>(null);
  const [micNotice, setMicNotice] = useState<string | null>(null);

  const [inputAudioLevel, setInputAudioLevel] = useState(0);
  const [outputAudioLevel, setOutputAudioLevel] = useState(0);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [manualInput, setManualInput] = useState("");
  const [streamingAgentText, setStreamingAgentText] = useState("");
  const [streamingUserSpeech, setStreamingUserSpeech] = useState("");
  const [audioTestPlayed, setAudioTestPlayed] = useState(false);

  // References
  const liveClientRef = useRef<GeminiLiveClient | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const historyRef = useRef<ChatMessage[]>(conversationHistory || []);

  useEffect(() => {
    historyRef.current = conversationHistory || [];
  }, [conversationHistory]);

  const safeHistory = conversationHistory || [];

  // Auto-scroll chat
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [safeHistory, streamingAgentText, streamingUserSpeech, liveStatus]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (liveClientRef.current) {
        liveClientRef.current.stop();
        liveClientRef.current = null;
      }
    };
  }, []);

  const [isTapSpeaking, setIsTapSpeaking] = useState(false);

  // Test speaker chime
  const testSpeaker = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
      setAudioTestPlayed(true);
      setTimeout(() => setAudioTestPlayed(false), 2000);
    } catch (e) {
      console.warn("Audio test error:", e);
    }
  };

  // Immediate answer trigger (bypasses silence waiting)
  const handleAnswerNow = () => {
    if (liveClientRef.current) {
      liveClientRef.current.sendAudioStreamEnd();
      setStatusMessage("Gemini turant bol raha hai...");
    }
  };

  // Direct In-App Tap to Speak (Speech Recognition)
  const startTapToSpeak = () => {
    try {
      const win = window as any;
      const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition;
      if (!SpeechRec) {
        setStatusMessage("Please speak into the live call or use quick symptom chips.");
        return;
      }
      const rec = new SpeechRec();
      rec.lang = selectedLang === "hi-IN" ? "hi-IN" : "en-IN";
      rec.interimResults = true;
      rec.continuous = false;

      setIsTapSpeaking(true);
      setStatusMessage("Aap bolein, sun rahe hain (Listening)...");

      rec.onresult = (e: any) => {
        let text = "";
        for (let i = 0; i < e.results.length; i++) {
          text += e.results[i][0]?.transcript || "";
        }
        setStreamingUserSpeech(text);
        if (e.results[0]?.isFinal && text.trim()) {
          handleSendTextOrChip(text.trim());
          setStreamingUserSpeech("");
          setIsTapSpeaking(false);
        }
      };

      rec.onerror = () => {
        setIsTapSpeaking(false);
      };

      rec.onend = () => {
        setIsTapSpeaking(false);
      };

      rec.start();
    } catch (e) {
      console.warn("Speech error:", e);
      setIsTapSpeaking(false);
    }
  };

  // Start Gemini Live Full-Duplex Continuous Conversation
  const startLiveConversation = useCallback(async () => {
    if (liveClientRef.current) {
      liveClientRef.current.stop();
    }

    setStreamingAgentText("");
    setStreamingUserSpeech("");
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
      onTranscriptAgentChunk: (chunk) => {
        setStreamingAgentText((prev) => prev + chunk);
      },
      onTranscriptAgentTurnComplete: (fullText) => {
        if (fullText.trim()) {
          const aiMsg: ChatMessage = {
            id: Date.now().toString(),
            sender: "gemini",
            text: fullText.trim(),
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          };
          const next = [...historyRef.current, aiMsg];
          historyRef.current = next;
          onUpdateHistory(next);
        }
        setStreamingAgentText("");
      },
      onTranscriptUserSpeech: (speechText) => {
        setStreamingUserSpeech(speechText);
      },
      onTranscriptUser: (text) => {
        const userMsg: ChatMessage = {
          id: Date.now().toString(),
          sender: "patient",
          text,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        };
        const next = [...historyRef.current, userMsg];
        historyRef.current = next;
        onUpdateHistory(next);
      },
      onInterrupted: () => {
        setOutputAudioLevel(0);
        setStatusMessage("Patient speaking (Barge-in active)...");
      },
      onError: (err) => {
        console.warn("Live API Error:", err);
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
  }, [apiKey, selectedLang, selectedVoice, patientInfo, vitals, onUpdateHistory]);

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

  const handleEndCall = () => {
    if (liveClientRef.current) {
      liveClientRef.current.stop();
      liveClientRef.current = null;
    }
    setLiveStatus("idle");
    setStatusMessage("Live call ended");
    setInputAudioLevel(0);
    setOutputAudioLevel(0);
    setStreamingAgentText("");
    setStreamingUserSpeech("");
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

  const handleSendTextOrChip = (text: string) => {
    if (!text.trim()) return;
    if (liveClientRef.current && (liveStatus === "ready" || liveStatus === "listening" || liveStatus === "speaking")) {
      liveClientRef.current.sendTextMessage(text.trim());
    } else {
      startLiveConversation().then(() => {
        setTimeout(() => {
          liveClientRef.current?.sendTextMessage(text.trim());
        }, 800);
      });
    }
    setManualInput("");
  };

  const handleFinish = () => {
    handleEndCall();

    const compiledNarrative = safeHistory
      .filter((m) => m.sender === "patient")
      .map((m) => m.text)
      .join(". ");

    onFinishConsultation(compiledNarrative);
  };

  const quickChips = selectedLang === "hi-IN" ? QUICK_SYMPTOM_CHIPS_HI : QUICK_SYMPTOM_CHIPS_EN;
  const isCallActive = liveStatus !== "idle" && liveStatus !== "error";

  return (
    <div className="space-y-4">
      {/* Top Bar with Voice Picker & Full Window Button */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-[11px] font-semibold">
            <Radio className={`w-3.5 h-3.5 ${isCallActive ? "animate-pulse text-emerald-400" : "text-emerald-500"}`} />
            <span>gemini-3.8-live</span>
          </div>

          <span className="flex items-center gap-1 text-[10px] text-teal-400 font-semibold bg-teal-500/10 px-2 py-0.5 rounded border border-teal-500/20">
            <Sparkles className="w-3 h-3 text-teal-400" />
            Full-Duplex Gemini Live
          </span>

          {hasMicAccess === true && (
            <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-medium bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
              <Mic className="w-3 h-3 text-emerald-400" />
              Mic Live
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Voice Character Selection */}
          <div className="flex items-center gap-1.5">
            <label className="text-[11px] text-slate-400 flex items-center gap-1">
              <Volume2 className="w-3.5 h-3.5 text-slate-400" />
              <span className="hidden sm:inline">Voice:</span>
            </label>
            <select
              value={selectedVoice}
              disabled={isCallActive}
              onChange={(e) => setSelectedVoice(e.target.value as any)}
              className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-[11px] text-slate-200 focus:outline-none focus:border-teal-500 disabled:opacity-50"
            >
              {LIVE_VOICES.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={testSpeaker}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-medium flex items-center gap-1 transition-all border ${
              audioTestPlayed
                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                : "bg-slate-950 text-slate-300 border-slate-700 hover:border-slate-500"
            }`}
            title="Test speaker audio"
          >
            <Play className="w-3 h-3 text-teal-400" />
            <span>{audioTestPlayed ? "Speaker OK!" : "Test Speaker"}</span>
          </button>
        </div>
      </div>

      {/* Main Gemini Live Interface Card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 border border-slate-800 p-6 flex flex-col items-center justify-center text-center shadow-2xl">
        {/* Real-time Waveform Bars */}
        <div className="w-full max-w-xs h-12 flex items-center justify-center gap-1.5 mb-2">
          {Array.from({ length: 22 }).map((_, idx) => {
            const level = liveStatus === "speaking" ? outputAudioLevel || 40 : liveStatus === "listening" ? inputAudioLevel || 20 : 6;
            const seed = Math.sin(idx * 0.65 + Date.now() * 0.003) * 0.5 + 0.5;
            const barHeight = isCallActive
              ? Math.max(6, Math.min(44, Math.round((level / 100) * 44 * seed + 6)))
              : 6;

            const isCenter = idx >= 7 && idx <= 14;
            const color =
              liveStatus === "speaking"
                ? "bg-teal-400"
                : liveStatus === "listening"
                ? inputAudioLevel > 15
                  ? "bg-emerald-400 shadow-sm shadow-emerald-400"
                  : "bg-emerald-500/70"
                : "bg-slate-700";

            return (
              <div
                key={idx}
                style={{ height: `${barHeight}px` }}
                className={`w-1.5 rounded-full transition-all duration-75 ${color} ${
                  isCenter && isCallActive ? "opacity-100 shadow-sm shadow-teal-400/50" : "opacity-70"
                }`}
              />
            );
          })}
        </div>

        {/* The Iconic Gemini Live Glowing Orb */}
        <div className="relative flex items-center justify-center my-3">
          <div
            onClick={!isCallActive ? startLiveConversation : undefined}
            className={`w-28 h-28 sm:w-32 sm:h-32 rounded-full transition-all duration-500 flex items-center justify-center cursor-pointer ${
              liveStatus === "speaking"
                ? "bg-gradient-to-tr from-teal-500 via-cyan-400 to-emerald-400 animate-pulse shadow-2xl shadow-teal-500/60 scale-110"
                : liveStatus === "listening"
                ? inputAudioLevel > 15
                  ? "bg-gradient-to-tr from-emerald-400 via-teal-400 to-cyan-300 shadow-2xl shadow-emerald-400/70 ring-8 ring-emerald-400/30 scale-110"
                  : "bg-gradient-to-tr from-emerald-500 to-teal-400 shadow-xl shadow-emerald-500/40 ring-8 ring-emerald-500/20 scale-105 animate-pulse"
                : liveStatus === "connecting"
                ? "bg-gradient-to-tr from-purple-500 to-indigo-500 animate-spin shadow-xl shadow-purple-500/50"
                : "bg-slate-800 hover:bg-slate-750 border-2 border-slate-700 hover:border-teal-500/50 shadow-inner group"
            }`}
          >
            {liveStatus === "speaking" && <Volume2 className="w-12 h-12 text-slate-950 animate-pulse" />}
            {liveStatus === "listening" && <Mic className="w-12 h-12 text-slate-950 animate-pulse" />}
            {liveStatus === "connecting" && <Sparkles className="w-12 h-12 text-white animate-spin" />}
            {liveStatus === "idle" && (
              <Radio className="w-12 h-12 text-teal-400 group-hover:scale-110 transition-transform" />
            )}
            {liveStatus === "error" && <AlertCircle className="w-12 h-12 text-rose-300" />}
          </div>

          {isCallActive && (
            <div className="absolute inset-0 -m-3 rounded-full border border-teal-400/30 animate-ping pointer-events-none" />
          )}
        </div>

        {/* Dynamic Status Text */}
        <div className="mt-2 space-y-1">
          <div className="flex items-center justify-center gap-1.5">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isCallActive ? "bg-emerald-400 animate-pulse" : "bg-slate-500"
              }`}
            />
            <h4 className="text-base font-bold text-white tracking-wide">
              {liveStatus === "speaking" && "Gemini Live Bol Raha Hai (Speaking...)"}
              {liveStatus === "listening" && (inputAudioLevel > 15 ? "Aapki Awaaz Sun Raha Hai (Hearing You...)" : "Aap Bolein, Gemini Sun Raha Hai (Listening...)")}
              {liveStatus === "connecting" && "Gemini Live Session Connect Ho Raha Hai..."}
              {liveStatus === "ready" && "Connected to Gemini Live — Bolna Shuru Karein"}
              {liveStatus === "idle" && "Direct Gemini Live Call (Jaise Gemini App Me Hota Hai)"}
              {liveStatus === "error" && "Notice"}
            </h4>
          </div>

          <p className="text-xs text-slate-400 max-w-md mx-auto">
            {liveStatus === "speaking"
              ? "Gemini live aawaz me bol raha hai. Aap beech me bolkar interrupt kar sakte hain (Barge-in)."
              : liveStatus === "listening"
              ? "Mic continuous on hai — kisi button ko dabaye bina seedha aamne-saamne bolein!"
              : "Jaise official Gemini app me baat hoti hai — bas start karein aur bina kisi button ke direct bolein aur sunein."}
          </p>
        </div>

        {/* Main Action Controls */}
        <div className="flex flex-wrap items-center justify-center gap-2.5 mt-5">
          {!isCallActive ? (
            <>
              <button
                type="button"
                onClick={startLiveConversation}
                className="px-6 py-3 rounded-xl text-sm font-bold bg-gradient-to-r from-teal-400 to-emerald-400 hover:from-teal-300 hover:to-emerald-300 text-slate-950 shadow-xl shadow-teal-500/30 transition-all active:scale-95 flex items-center gap-2"
              >
                <PhoneCall className="w-5 h-5 fill-slate-950" />
                <span>Start Gemini Live Call (सीधी बातचीत शुरू करें)</span>
              </button>

              <button
                type="button"
                onClick={startTapToSpeak}
                disabled={isTapSpeaking}
                className={`px-4 py-3 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95 border ${
                  isTapSpeaking
                    ? "bg-rose-500/20 text-rose-300 border-rose-500/50 animate-pulse ring-2 ring-rose-500/30"
                    : "bg-slate-900 hover:bg-slate-800 text-teal-300 border-teal-500/40 hover:border-teal-400"
                }`}
                title="Tap and speak directly in this browser window"
              >
                <Mic className={`w-4 h-4 ${isTapSpeaking ? "text-rose-400 animate-bounce" : "text-teal-400"}`} />
                <span>{isTapSpeaking ? "Sun Raha Hai (Listening)..." : "Tap to Speak (माइक दबाएं)"}</span>
              </button>
            </>
          ) : (
            <>
              {/* Fast Answer Now Button to eliminate silence latency */}
              {(liveStatus === "listening" || liveStatus === "ready") && (
                <button
                  type="button"
                  onClick={handleAnswerNow}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-md shadow-amber-400/30 transition-all flex items-center gap-1.5 active:scale-95 animate-pulse"
                  title="Click when you finish speaking to hear Gemini respond immediately!"
                >
                  <Zap className="w-4 h-4 fill-slate-950" />
                  <span>Answer Now (तुरंत जवाब सुनें)</span>
                </button>
              )}

              {/* Direct Tap to Speak while in call */}
              <button
                type="button"
                onClick={startTapToSpeak}
                disabled={isTapSpeaking}
                className={`px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 active:scale-95 border ${
                  isTapSpeaking
                    ? "bg-rose-500/20 text-rose-300 border-rose-500/50 animate-pulse"
                    : "bg-slate-900 hover:bg-slate-800 text-teal-300 border-slate-700 hover:border-teal-500/50"
                }`}
                title="Record immediate spoken turn"
              >
                <Mic className={`w-3.5 h-3.5 ${isTapSpeaking ? "text-rose-400 animate-bounce" : "text-teal-400"}`} />
                <span>{isTapSpeaking ? "Listening..." : "Push to Speak"}</span>
              </button>

              {/* Mute Mic */}
              <button
                type="button"
                onClick={toggleMute}
                className={`px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 active:scale-95 border ${
                  isMicMuted
                    ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                    : "bg-slate-800 hover:bg-slate-750 text-slate-200 border-slate-700"
                }`}
              >
                {isMicMuted ? <MicOff className="w-3.5 h-3.5 text-amber-400" /> : <Mic className="w-3.5 h-3.5" />}
                <span>{isMicMuted ? "Unmute" : "Mute"}</span>
              </button>

              {/* Interrupt / Barge-in */}
              {liveStatus === "speaking" && (
                <button
                  type="button"
                  onClick={interruptModel}
                  className="px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 transition-all flex items-center gap-1.5 active:scale-95"
                >
                  <Square className="w-3.5 h-3.5" />
                  <span>Interrupt</span>
                </button>
              )}

              {/* End Call */}
              <button
                type="button"
                onClick={handleEndCall}
                className="px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 transition-all flex items-center gap-1.5 active:scale-95"
              >
                <PhoneOff className="w-3.5 h-3.5" />
                <span>End Call</span>
              </button>

              {/* Finish to SOAP */}
              <button
                type="button"
                onClick={handleFinish}
                disabled={isLoadingSOAP}
                className="px-4 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 shadow-md transition-all active:scale-95 flex items-center gap-1.5"
              >
                {isLoadingSOAP ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                )}
                <span>Finish & SOAP</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Live Transcript Chat Feed */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <span>Live Conversation Transcript</span>
            {safeHistory.length > 0 && (
              <span className="text-teal-400 font-mono">({safeHistory.length} turns)</span>
            )}
            {isCallActive && (
              <span className="flex items-center gap-1 text-[9px] text-emerald-400 font-mono bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                Live Audio Stream Active
              </span>
            )}
          </label>
          {safeHistory.length > 0 && (
            <button
              type="button"
              onClick={() => {
                historyRef.current = [];
                onUpdateHistory([]);
              }}
              className="text-[10px] text-slate-500 hover:text-slate-300 flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" /> Clear Chat
            </button>
          )}
        </div>

        <div
          ref={chatScrollRef}
          className="h-60 overflow-y-auto space-y-2.5 p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/90 text-xs"
        >
          {safeHistory.length === 0 && !streamingAgentText && !streamingUserSpeech ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 space-y-2">
              <div className="w-10 h-10 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center">
                <Radio className="w-5 h-5 text-teal-400" />
              </div>
              <div>
                <p className="text-slate-300 font-medium">Gemini Live Direct Audio Scribe</p>
                <p className="text-[11px] text-slate-500 max-w-sm mt-0.5">
                  Click "Start Gemini Live Call" above to begin. Gemini will speak aloud in its natural voice and listen to your microphone continuously.
                </p>
              </div>
            </div>
          ) : (
            <>
              {safeHistory.map((msg) => (
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
              ))}

              {/* Streaming speech as patient speaks */}
              {streamingUserSpeech && (
                <div className="flex gap-2.5 justify-end">
                  <div className="max-w-[82%] p-2.5 rounded-2xl bg-teal-600/70 text-white border border-teal-400/50 italic animate-pulse">
                    <p className="text-xs">🎤 {streamingUserSpeech} ...</p>
                  </div>
                </div>
              )}

              {/* Streaming speech as Gemini speaks */}
              {streamingAgentText && (
                <div className="flex gap-2.5 justify-start">
                  <div className="w-6 h-6 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/40 flex items-center justify-center shrink-0 text-[10px] font-bold">
                    AI
                  </div>
                  <div className="max-w-[82%] p-2.5 rounded-2xl bg-slate-900 border border-teal-500/40 text-teal-100 shadow">
                    <p className="text-xs">{streamingAgentText}</p>
                    <span className="text-[9px] text-teal-400/80 mt-1 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-ping" />
                      Speaking live in 24kHz audio...
                    </span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Optional Quick Symptom Prompts */}
      <div className="space-y-1.5">
        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
          Optional Quick Symptom Prompts (1-Click Test into Live Call)
        </label>
        <div className="flex flex-wrap gap-1.5">
          {quickChips.map((chip, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSendTextOrChip(chip)}
              className="px-2.5 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-850 border border-slate-800 hover:border-teal-500/50 text-[11px] text-slate-300 hover:text-white transition-all text-left active:scale-95 flex items-center gap-1.5"
            >
              <Zap className="w-3 h-3 text-teal-400 shrink-0" />
              <span>{chip}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Optional Manual Input */}
      <div className="flex items-center gap-2 pt-1">
        <input
          type="text"
          value={manualInput}
          onChange={(e) => setManualInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSendTextOrChip(manualInput);
          }}
          placeholder="Optional: Type symptoms if not speaking into mic..."
          className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-teal-500"
        />
        <button
          type="button"
          onClick={() => handleSendTextOrChip(manualInput)}
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

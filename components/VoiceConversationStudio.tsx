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
  AlertCircle,
  HelpCircle,
  ShieldAlert,
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
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [interimText, setInterimText] = useState("");
  const [manualInput, setManualInput] = useState("");
  const [micError, setMicError] = useState<string | null>(null);
  const [micPermissionGranted, setMicPermissionGranted] = useState<boolean | null>(null);
  const [activeStatus, setActiveStatus] = useState<
    "idle" | "listening" | "thinking" | "speaking"
  >("idle");

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
  const silenceTimerRef = useRef<any>(null);
  const latestTranscriptRef = useRef<string>("");

  const safeHistory = conversationHistory || [];

  useEffect(() => {
    speechInputRef.current = new SpeechInputService();
    speechOutputRef.current = new SpeechOutputService();

    // Check if permission was already granted previously
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions
        .query({ name: "microphone" as PermissionName })
        .then((status) => {
          if (status.state === "granted") {
            setMicPermissionGranted(true);
          } else if (status.state === "denied") {
            setMicPermissionGranted(false);
            setMicError("Microphone access is blocked in your browser settings.");
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

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [safeHistory, streamingAgentText, streamingUserSpeech, liveStatus]);

  // Request Mic Permission explicitly
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

  // Initial greeting when conversation is started
  const startConversation = async () => {
    setMicError(null);

    // 1. Trigger the native browser microphone permission popup immediately!
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
    } catch (err: any) {
      console.error(err);
      setIsThinking(false);
      setActiveStatus("idle");
    }
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
        startListening();
      },
    });
  };

  // Start Speech Recognition
  const startListening = async () => {
    if (!speechInputRef.current) return;
    if (speechOutputRef.current) speechOutputRef.current.stop();
    setMicError(null);

    // Ensure permission is granted
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
          // Set a 1.6s silence auto-send timer so users don't have to wait indefinitely
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

  // Manually send what was spoken so far without waiting
  const sendSpokenTranscriptNow = () => {
    const textToSend = latestTranscriptRef.current || interimText;
    if (textToSend.trim()) {
      handlePatientMessage(textToSend.trim());
    }
  };

  // Process Patient message -> Gemini reply
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

      onUpdateHistory([...newHistory, aiMsg]);
      setIsThinking(false);
      speakGeminiResponse(reply);
    } catch (e: any) {
      console.error(e);
      setIsThinking(false);
      setActiveStatus("idle");
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
  const isCallActive = liveStatus !== "idle" && liveStatus !== "error";

  return (
    <div className="space-y-4">
      {/* Microphone Permission Warning Banner if blocked */}
      {micError && (
        <div className="p-3 bg-rose-950/40 border border-rose-500/50 rounded-xl flex items-start gap-3 shadow-lg">
          <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <p className="font-bold text-rose-300">Microphone Access Notice</p>
            <p className="text-rose-200/90 leading-relaxed">{micError}</p>
            <div className="pt-1 flex items-center gap-2">
              <button
                type="button"
                onClick={handleRequestPermission}
                className="px-2.5 py-1 rounded-lg bg-rose-500 hover:bg-rose-400 text-white font-bold text-[11px] shadow transition-all"
              >
                Trigger Permission Popup Again
              </button>
              <span className="text-[10px] text-slate-400">
                (Or click the icon next to <code>localhost:3000</code> in address bar)
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Visualizer & Status Hero Card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 border border-slate-800 p-4 sm:p-5 flex flex-col items-center justify-center text-center shadow-2xl">
        {/* Mic Permission Pill Badge */}
        <div className="mb-2">
          {micPermissionGranted ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Microphone Permission Granted
            </span>
          ) : (
            <button
              type="button"
              onClick={handleRequestPermission}
              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/30 hover:bg-amber-500/20 transition-colors"
            >
              <Mic className="w-3 h-3 text-amber-400" />
              Click to Allow Microphone Access
            </button>
          )}
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
              ? selectedLang === "hi-IN" ? "अपनी तकलीफ खुलकर बोलें (हिंदी या अंग्रेजी)..." : "Speak symptoms naturally..."
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
              {/* Fast Answer Now Button to eliminate silence latency */}
              {(liveStatus === "listening" || liveStatus === "ready") && (
                <button
                  type="button"
                  onClick={handleAnswerNow}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-md shadow-amber-400/30 transition-all flex items-center gap-1.5 active:scale-95 animate-pulse"
                  title="Click when you finish speaking to hear Gemini respond immediately!"
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
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 shadow-md transition-all active:scale-95 flex items-center gap-1.5"
              >
                {isLoadingSOAP ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-400" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
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
          {safeHistory.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 space-y-1">
              <Bot className="w-6 h-6 text-slate-600" />
              <p>Click "Start Voice Consultation" to begin AI audio interview.</p>
              <p className="text-[10px] text-slate-600">Your browser will ask for microphone permission.</p>
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

      {/* Manual Text Input fallback */}
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

"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Mic,
  MicOff,
  Upload,
  Image as ImageIcon,
  X,
  FileText,
  User,
  Sparkles,
  Volume2,
  AlertCircle,
  FileCheck2,
  Languages,
  Bot,
  ListTodo,
} from "lucide-react";
import { VitalsInput } from "./VitalsInput";
import { VoiceConversationStudio } from "./VoiceConversationStudio";
import { SpeechInputService } from "@/lib/speech";
import { PatientInfo, VitalsData, ChatMessage } from "@/lib/types";

interface IntakeKioskProps {
  apiKey: string;
  patientInfo: PatientInfo;
  onPatientInfoChange: (info: PatientInfo) => void;
  vitals: VitalsData;
  onVitalsChange: (vitals: VitalsData) => void;
  narrativeText: string;
  onNarrativeChange: (text: string) => void;
  conversationHistory: ChatMessage[];
  onConversationHistoryChange: (history: ChatMessage[]) => void;
  labImageBase64: string | null;
  onLabImageChange: (base64: string | null) => void;
  onProcessTriage: () => void;
  isLoading: boolean;
  loadingStepText: string;
}

export const IntakeKiosk: React.FC<IntakeKioskProps> = ({
  apiKey,
  patientInfo,
  onPatientInfoChange,
  vitals,
  onVitalsChange,
  narrativeText,
  onNarrativeChange,
  conversationHistory,
  onConversationHistoryChange,
  labImageBase64,
  onLabImageChange,
  onProcessTriage,
  isLoading,
  loadingStepText,
}) => {
  const [selectedLang, setSelectedLang] = useState<"hi-IN" | "en-IN">("hi-IN");
  const [intakeMode, setIntakeMode] = useState<"conversational" | "quick">("conversational");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const speechServiceRef = useRef<SpeechInputService | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    speechServiceRef.current = new SpeechInputService();
    return () => {
      if (speechServiceRef.current) {
        speechServiceRef.current.stop();
      }
    };
  }, []);

  const toggleRecording = () => {
    if (!speechServiceRef.current) return;
    setRecordingError(null);

    if (isRecording) {
      speechServiceRef.current.stop();
      setIsRecording(false);
    } else {
      if (!speechServiceRef.current.isSupported()) {
        setRecordingError("Voice recognition not supported in this browser. Please use Chrome or Edge.");
        return;
      }

      setIsRecording(true);
      const initialText = narrativeText ? narrativeText + " " : "";

      speechServiceRef.current.start(
        selectedLang,
        (transcript, isFinal) => {
          onNarrativeChange(initialText + transcript);
        },
        (error) => {
          setRecordingError(`Mic Error: ${error}`);
          setIsRecording(false);
        },
        () => {
          setIsRecording(false);
        }
      );
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please upload a valid image file (JPEG/PNG/WebP).");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      onLabImageChange(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;

    const reader = new FileReader();
    reader.onload = () => {
      onLabImageChange(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleFinishFromConversation = (compiledNarrative: string) => {
    onNarrativeChange(compiledNarrative);
    onProcessTriage();
  };

  return (
    <div className="flex flex-col h-full bg-slate-900/50 border border-slate-800 rounded-2xl p-5 shadow-xl backdrop-blur-sm space-y-5">
      {/* Kiosk Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
        <div>
          <span className="text-[11px] font-bold text-teal-400 uppercase tracking-widest">
            Module 01 • Intake Kiosk
          </span>
          <h2 className="text-lg font-bold text-white tracking-tight">
            Patient Triage & Voice Capture
          </h2>
        </div>
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={() => setSelectedLang("hi-IN")}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
              selectedLang === "hi-IN"
                ? "bg-teal-500 text-slate-950 font-bold shadow"
                : "text-slate-400 hover:text-white"
            }`}
          >
            🇮🇳 हिन्दी
          </button>
          <button
            type="button"
            onClick={() => setSelectedLang("en-IN")}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
              selectedLang === "en-IN"
                ? "bg-teal-500 text-slate-950 font-bold shadow"
                : "text-slate-400 hover:text-white"
            }`}
          >
            🌐 English
          </button>
        </div>
      </div>

      {/* Mode Selector Tabs: Conversational Voice vs Quick Dictation */}
      <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800 text-xs">
        <button
          type="button"
          onClick={() => setIntakeMode("conversational")}
          className={`flex items-center justify-center gap-2 py-2 rounded-lg font-bold transition-all ${
            intakeMode === "conversational"
              ? "bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 shadow-md"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <Bot className="w-3.5 h-3.5" />
          <span>AI Voice Dialogue</span>
        </button>

        <button
          type="button"
          onClick={() => setIntakeMode("quick")}
          className={`flex items-center justify-center gap-2 py-2 rounded-lg font-bold transition-all ${
            intakeMode === "quick"
              ? "bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 shadow-md"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <Mic className="w-3.5 h-3.5" />
          <span>Quick Dictation</span>
        </button>
      </div>

      {/* Patient Basic Info Row */}
      <div className="grid grid-cols-12 gap-2.5 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
        <div className="col-span-12 sm:col-span-4">
          <label className="text-[10px] uppercase font-semibold text-slate-400 block mb-1">
            Patient Name
          </label>
          <input
            type="text"
            placeholder="e.g. Ramesh Sharma"
            value={patientInfo.name}
            onChange={(e) => onPatientInfoChange({ ...patientInfo, name: e.target.value })}
            className="w-full bg-slate-900 border border-slate-750 px-2.5 py-1.5 rounded-lg text-xs text-white placeholder-slate-600 focus:outline-none focus:border-teal-500"
          />
        </div>

        <div className="col-span-4 sm:col-span-2">
          <label className="text-[10px] uppercase font-semibold text-slate-400 block mb-1">
            Age
          </label>
          <input
            type="number"
            placeholder="28"
            value={patientInfo.age}
            onChange={(e) => onPatientInfoChange({ ...patientInfo, age: e.target.value })}
            className="w-full bg-slate-900 border border-slate-750 px-2.5 py-1.5 rounded-lg text-xs text-white placeholder-slate-600 focus:outline-none focus:border-teal-500 text-center"
          />
        </div>

        <div className="col-span-4 sm:col-span-3">
          <label className="text-[10px] uppercase font-semibold text-slate-400 block mb-1">
            Gender
          </label>
          <select
            value={patientInfo.gender}
            onChange={(e) =>
              onPatientInfoChange({
                ...patientInfo,
                gender: e.target.value as "Male" | "Female" | "Other",
              })
            }
            className="w-full bg-slate-900 border border-slate-750 px-2 py-1.5 rounded-lg text-xs text-white focus:outline-none focus:border-teal-500"
          >
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
          </select>
        </div>

        <div className="col-span-4 sm:col-span-3">
          <label className="text-[10px] uppercase font-semibold text-slate-400 block mb-1">
            Token / UHID
          </label>
          <input
            type="text"
            placeholder="OPD-042"
            value={patientInfo.tokenNo}
            onChange={(e) => onPatientInfoChange({ ...patientInfo, tokenNo: e.target.value })}
            className="w-full bg-slate-900 border border-slate-750 px-2.5 py-1.5 rounded-lg text-xs text-white placeholder-slate-600 focus:outline-none focus:border-teal-500 font-mono text-center"
          />
        </div>
      </div>

      {/* Intake Mode 1: Conversational AI Voice Studio */}
      {intakeMode === "conversational" ? (
        <VoiceConversationStudio
          apiKey={apiKey}
          selectedLang={selectedLang}
          patientInfo={patientInfo}
          vitals={vitals}
          conversationHistory={conversationHistory}
          onUpdateHistory={onConversationHistoryChange}
          onFinishConsultation={handleFinishFromConversation}
          isLoadingSOAP={isLoading}
        />
      ) : (
        /* Intake Mode 2: Quick Dictation / Manual Text */
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Volume2 className="w-3.5 h-3.5 text-teal-400" />
              <span>Vernacular Chief Complaint (Speech / Text)</span>
            </label>
            {isRecording && (
              <span className="flex items-center gap-1.5 text-[11px] font-semibold text-rose-400 animate-pulse">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                Listening in {selectedLang === "hi-IN" ? "हिन्दी" : "English"}...
              </span>
            )}
          </div>

          <div className="relative">
            <textarea
              rows={4}
              value={narrativeText}
              onChange={(e) => onNarrativeChange(e.target.value)}
              placeholder="मरीज की भाषा में तकलीफ बोलें या लिखें (e.g., '4 दिन से तेज बुखार, पेट दर्द और हाथों पर लाल चकत्ते...')"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 pr-14 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-teal-500 leading-relaxed font-sans resize-none"
            />

            <div className="absolute right-3 bottom-3 flex items-center gap-1.5">
              <button
                type="button"
                onClick={toggleRecording}
                className={`p-3 rounded-full shadow-lg transition-all duration-300 flex items-center justify-center ${
                  isRecording
                    ? "bg-rose-500 text-white animate-bounce ring-4 ring-rose-500/30"
                    : "bg-gradient-to-tr from-teal-500 to-emerald-400 text-slate-950 hover:scale-105 active:scale-95 shadow-teal-500/30"
                }`}
                title={isRecording ? "Stop voice recording" : "Speak chief complaint"}
              >
                {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {recordingError && (
            <p className="text-[11px] text-rose-400 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              {recordingError}
            </p>
          )}
        </div>
      )}

      {/* Vitals Matrix Input */}
      <VitalsInput vitals={vitals} onChange={onVitalsChange} disabled={isLoading} />

      {/* Diagnostic Lab Image Dropzone */}
      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5 text-teal-400" />
          <span>Diagnostic Lab Report / CBC Paper (Optional Multimodal)</span>
        </label>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
          className="hidden"
        />

        {labImageBase64 ? (
          <div className="relative p-2.5 bg-slate-950 rounded-xl border border-teal-500/40 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <img
                src={labImageBase64}
                alt="Lab preview"
                className="w-14 h-14 object-cover rounded-lg border border-slate-800"
              />
              <div>
                <span className="text-xs font-medium text-white flex items-center gap-1">
                  <FileCheck2 className="w-3.5 h-3.5 text-teal-400" /> Lab Report Attached
                </span>
                <p className="text-[11px] text-slate-400">Gemini 2.0 will OCR & parse report values</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onLabImageChange(null)}
              className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-900 transition-colors"
              title="Remove attachment"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-800 hover:border-teal-500/50 bg-slate-950/40 hover:bg-slate-950/80 rounded-xl p-3.5 flex items-center justify-center gap-3 cursor-pointer transition-all group"
          >
            <div className="p-2 rounded-lg bg-slate-900 text-slate-400 group-hover:text-teal-400 transition-colors">
              <Upload className="w-4 h-4" />
            </div>
            <div className="text-left">
              <p className="text-xs font-medium text-slate-300 group-hover:text-white">
                Drag & Drop CBC / LFT Scan or <span className="text-teal-400 underline">Browse</span>
              </p>
              <p className="text-[10px] text-slate-500">Supports JPEG, PNG, Camera photo</p>
            </div>
          </div>
        )}
      </div>

      {/* Direct Synthesize Action Button */}
      {intakeMode === "quick" && (
        <div className="pt-2">
          <button
            type="button"
            onClick={onProcessTriage}
            disabled={isLoading || (!narrativeText && !labImageBase64)}
            className="w-full relative group overflow-hidden rounded-xl p-3.5 font-bold text-slate-950 shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-teal-400 via-emerald-400 to-cyan-400 hover:from-teal-300 hover:to-cyan-300 active:scale-[0.99]"
          >
            {isLoading ? (
              <div className="flex items-center justify-center gap-2 text-slate-950 text-sm font-semibold">
                <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                <span>{loadingStepText || "Gemini 2.0 Flash is synthesizing..."}</span>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2 text-sm tracking-wide">
                <Sparkles className="w-4 h-4 fill-slate-950" />
                <span>Synthesize Clinical SOAP & Triage Brief</span>
              </div>
            )}
          </button>
        </div>
      )}
    </div>
  );
};

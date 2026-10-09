"use client";

import React, { useState, useEffect } from "react";
import {
  TriageResult,
  PriorityLevel,
} from "@/lib/types";
import { SpeechOutputService } from "@/lib/speech";
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Volume2,
  VolumeX,
  Printer,
  Copy,
  Check,
  Stethoscope,
  ListChecks,
  Activity,
  FileBadge2,
  Share2,
  Sparkles,
  HeartPulse,
  Pill,
} from "lucide-react";

interface DoctorCockpitProps {
  triageResult: TriageResult | null;
  onTriggerPrint: () => void;
  isLoading: boolean;
}

export const DoctorCockpit: React.FC<DoctorCockpitProps> = ({
  triageResult,
  onTriggerPrint,
  isLoading,
}) => {
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [copiedNote, setCopiedNote] = useState(false);
  const [checkedPlanItems, setCheckedPlanItems] = useState<{ [index: number]: boolean }>({});
  const speechOutputRef = React.useRef<SpeechOutputService | null>(null);

  useEffect(() => {
    speechOutputRef.current = new SpeechOutputService();
    return () => {
      if (speechOutputRef.current) {
        speechOutputRef.current.stop();
      }
    };
  }, []);

  // Stop audio on new result
  useEffect(() => {
    if (speechOutputRef.current) {
      speechOutputRef.current.stop();
      setIsPlayingAudio(false);
    }
    setCheckedPlanItems({});
  }, [triageResult]);

  const toggleAudioBrief = () => {
    if (!speechOutputRef.current || !triageResult) return;

    if (isPlayingAudio) {
      speechOutputRef.current.stop();
      setIsPlayingAudio(false);
    } else {
      setIsPlayingAudio(true);
      speechOutputRef.current.speak(triageResult.doctor_audio_brief, {
        rate: 1.05,
        onStart: () => setIsPlayingAudio(true),
        onEnd: () => setIsPlayingAudio(false),
        onError: () => setIsPlayingAudio(false),
      });
    }
  };

  const handleCopySoap = () => {
    if (!triageResult) return;
    const chronicStr =
      triageResult.patientInfo.chronicConditions &&
      triageResult.patientInfo.chronicConditions.length > 0
        ? triageResult.patientInfo.chronicConditions.join(", ")
        : "None reported";
    const medsStr =
      triageResult.patientInfo.currentMedications &&
      triageResult.patientInfo.currentMedications.length > 0
        ? triageResult.patientInfo.currentMedications.join(", ")
        : "None reported";

    const text = `
=== RAPICURE AI CLINICAL BRIEF ===
Patient: ${triageResult.patientInfo.name} (${triageResult.patientInfo.age}y/${triageResult.patientInfo.gender}) | Token: ${triageResult.patientInfo.tokenNo}
Priority: ${triageResult.priority} (${triageResult.priority_reason})
Chronic Conditions: ${chronicStr}
Current Medications: ${medsStr}

[SUBJECTIVE]
${triageResult.subjective}

[OBJECTIVE]
${triageResult.objective}

[RED FLAGS]
${triageResult.red_flags}

[PLAN]
${triageResult.plan.map((p, i) => `${i + 1}. ${p}`).join("\n")}
    `.trim();

    navigator.clipboard.writeText(text);
    setCopiedNote(true);
    setTimeout(() => setCopiedNote(false), 2000);
  };

  const togglePlanItem = (index: number) => {
    setCheckedPlanItems((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  // Priority styling helpers
  const getPriorityBadge = (priority: PriorityLevel) => {
    switch (priority) {
      case "HIGH":
        return {
          bg: "bg-rose-500/15 text-rose-300 border-rose-500/40",
          pill: "bg-rose-500 text-white",
          icon: <AlertTriangle className="w-4 h-4 text-rose-400 animate-bounce" />,
          title: "HIGH PRIORITY • IMMEDIATE ATTENTION",
          border: "border-rose-500/50 shadow-rose-500/10",
        };
      case "MODERATE":
        return {
          bg: "bg-amber-500/15 text-amber-300 border-amber-500/40",
          pill: "bg-amber-500 text-slate-950",
          icon: <Clock className="w-4 h-4 text-amber-400" />,
          title: "MODERATE PRIORITY • EXPEDITE",
          border: "border-amber-500/50 shadow-amber-500/10",
        };
      case "ROUTINE":
      default:
        return {
          bg: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
          pill: "bg-emerald-500 text-slate-950",
          icon: <CheckCircle className="w-4 h-4 text-emerald-400" />,
          title: "ROUTINE PRIORITY • STANDARD QUEUE",
          border: "border-emerald-500/50 shadow-emerald-500/10",
        };
    }
  };

  if (!triageResult && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[480px] bg-slate-900/30 border border-slate-800/80 border-dashed rounded-2xl p-8 text-center backdrop-blur-sm">
        <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 mb-4 shadow-inner">
          <Stethoscope className="w-8 h-8 text-slate-500" />
        </div>
        <h3 className="text-base font-semibold text-slate-300">
          Doctor Consultation Cockpit
        </h3>
        <p className="text-xs text-slate-500 max-w-sm mt-1.5 leading-relaxed">
          Record the patient narrative and vitals in the Intake Kiosk (or click{" "}
          <strong className="text-amber-400">⚡ Load Dengue Demo</strong>) to generate real-time SOAP intelligence.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[480px] bg-slate-900/40 border border-slate-800 rounded-2xl p-8 text-center">
        <div className="relative flex items-center justify-center mb-4">
          <div className="w-14 h-14 border-4 border-teal-500/20 border-t-teal-400 rounded-full animate-spin" />
          <Sparkles className="w-6 h-6 text-teal-400 absolute" />
        </div>
        <h3 className="text-base font-semibold text-white">Synthesizing Clinical Intelligence</h3>
        <p className="text-xs text-slate-400 mt-1">Gemini 2.0 Flash is reviewing history, vitals & lab markers...</p>
      </div>
    );
  }

  if (!triageResult) return null;

  const priorityStyle = getPriorityBadge(triageResult.priority);

  return (
    <div className="flex flex-col h-full bg-slate-900/60 border border-slate-800 rounded-2xl p-5 shadow-2xl backdrop-blur-sm space-y-4">
      {/* Cockpit Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
        <div>
          <span className="text-[11px] font-bold text-teal-400 uppercase tracking-widest">
            Module 02 • Doctor Cockpit
          </span>
          <div className="flex items-center gap-2 mt-0.5">
            <h2 className="text-lg font-bold text-white tracking-tight">
              Clinical SOAP Briefing
            </h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-teal-300 border border-slate-700">
              {triageResult.patientInfo.tokenNo || "OPD-Slip"}
            </span>
          </div>
        </div>

        {/* Action Buttons: Print & Copy */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopySoap}
            className="p-2 text-slate-400 hover:text-white bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl transition-all"
            title="Copy SOAP Note to Clipboard"
          >
            {copiedNote ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={onTriggerPrint}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-teal-500 hover:bg-teal-400 text-slate-950 shadow-md transition-all active:scale-95"
            title="Print Official OPD Prescription Slip"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print OPD Slip</span>
          </button>
        </div>
      </div>

      {/* Priority Alert Banner */}
      <div
        className={`p-3.5 rounded-xl border ${priorityStyle.border} ${priorityStyle.bg} flex items-start justify-between gap-3 shadow-lg`}
      >
        <div className="flex items-start gap-2.5">
          <div className="mt-0.5">{priorityStyle.icon}</div>
          <div>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold tracking-wider ${priorityStyle.pill}`}>
                {triageResult.priority}
              </span>
              <span className="text-xs font-bold text-white">{priorityStyle.title}</span>
            </div>
            <p className="text-xs text-slate-200 mt-1 leading-snug">
              {triageResult.priority_reason}
            </p>
          </div>
        </div>
      </div>

      {/* Patient Background Card: Chronic Conditions & Current Medications */}
      {((triageResult.patientInfo.chronicConditions &&
        triageResult.patientInfo.chronicConditions.length > 0) ||
        (triageResult.patientInfo.currentMedications &&
          triageResult.patientInfo.currentMedications.length > 0)) && (
        <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2.5">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Patient Medical History & Active Drug Therapy
            </span>
            <span className="text-[10px] text-teal-400 font-mono">
              {triageResult.patientInfo.name || "Patient"} • {triageResult.patientInfo.age || "--"}y
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
            {/* Chronic Conditions */}
            <div>
              <span className="text-[10px] font-semibold text-rose-400 flex items-center gap-1 mb-1">
                <HeartPulse className="w-3 h-3 text-rose-400" />
                Chronic Conditions:
              </span>
              <div className="flex flex-wrap gap-1">
                {triageResult.patientInfo.chronicConditions &&
                triageResult.patientInfo.chronicConditions.length > 0 ? (
                  triageResult.patientInfo.chronicConditions.map((cond, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-rose-950/40 text-rose-300 border border-rose-500/30"
                    >
                      {cond}
                    </span>
                  ))
                ) : (
                  <span className="text-slate-500 text-[11px] italic">None reported</span>
                )}
              </div>
            </div>

            {/* Current Medications */}
            <div>
              <span className="text-[10px] font-semibold text-cyan-400 flex items-center gap-1 mb-1">
                <Pill className="w-3 h-3 text-cyan-400" />
                Current Medications:
              </span>
              <div className="flex flex-wrap gap-1">
                {triageResult.patientInfo.currentMedications &&
                triageResult.patientInfo.currentMedications.length > 0 ? (
                  triageResult.patientInfo.currentMedications.map((med, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-cyan-950/40 text-cyan-300 border border-cyan-500/30"
                    >
                      {med}
                    </span>
                  ))
                ) : (
                  <span className="text-slate-500 text-[11px] italic">None reported</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hands-Free Audio Brief Bar */}
      <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 overflow-hidden">
          <button
            type="button"
            onClick={toggleAudioBrief}
            className={`p-2.5 rounded-xl shadow transition-all flex items-center justify-center ${
              isPlayingAudio
                ? "bg-rose-500 text-white animate-pulse ring-2 ring-rose-400/40"
                : "bg-teal-500 text-slate-950 hover:bg-teal-400"
            }`}
            title={isPlayingAudio ? "Stop audio briefing" : "Play 10s audio briefing"}
          >
            {isPlayingAudio ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <div className="truncate">
            <span className="text-[10px] uppercase font-bold text-teal-400 block">
              10-Second Doctor Audio Summary
            </span>
            <p className="text-xs text-slate-300 italic truncate max-w-md">
              "{triageResult.doctor_audio_brief}"
            </p>
          </div>
        </div>

        {isPlayingAudio && (
          <div className="flex items-center gap-1">
            <span className="w-1 h-3 bg-teal-400 animate-bounce" />
            <span className="w-1 h-5 bg-teal-400 animate-bounce delay-75" />
            <span className="w-1 h-4 bg-teal-400 animate-bounce delay-150" />
          </div>
        )}
      </div>

      {/* Red Flags Card (Prominent Alert Box if high priority) */}
      {triageResult.red_flags && (
        <div className="p-3 bg-rose-950/30 border border-rose-500/40 rounded-xl space-y-1">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-400 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-rose-400" />
            Immediate Red Flag Warnings
          </span>
          <p className="text-xs text-rose-200 leading-relaxed font-medium">
            {triageResult.red_flags}
          </p>
        </div>
      )}

      {/* SOAP Grid */}
      <div className="space-y-3">
        {/* Subjective Card */}
        <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-teal-400 block">
            [S] Subjective History & Symptoms
          </span>
          <p className="text-xs text-slate-200 leading-relaxed">
            {triageResult.subjective}
          </p>
        </div>

        {/* Objective Card */}
        <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 block">
            [O] Objective Vitals & Extracted Lab Findings
          </span>
          <p className="text-xs text-slate-200 leading-relaxed">
            {triageResult.objective}
          </p>
        </div>

        {/* Plan / Interactive Doctor Checklist */}
        <div className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-800 space-y-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <ListChecks className="w-3.5 h-3.5 text-emerald-400" />
              <span>[P] Stabilization & Diagnostic Plan Checklist</span>
            </span>
            <span className="text-[10px] text-slate-500 font-normal">Check off completed orders</span>
          </span>

          <div className="space-y-1.5">
            {triageResult.plan && triageResult.plan.length > 0 ? (
              triageResult.plan.map((item, idx) => (
                <label
                  key={idx}
                  onClick={() => togglePlanItem(idx)}
                  className={`flex items-start gap-2.5 p-2 rounded-lg cursor-pointer transition-all ${
                    checkedPlanItems[idx]
                      ? "bg-emerald-950/30 text-emerald-300 line-through opacity-70"
                      : "bg-slate-900/70 hover:bg-slate-900 text-slate-200"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={!!checkedPlanItems[idx]}
                    onChange={() => {}}
                    className="mt-0.5 rounded border-slate-700 text-teal-500 focus:ring-teal-400 bg-slate-950"
                  />
                  <span className="text-xs leading-relaxed">{item}</span>
                </label>
              ))
            ) : (
              <p className="text-xs text-slate-500">No plan items synthesized.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

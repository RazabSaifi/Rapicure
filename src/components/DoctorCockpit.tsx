import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Flame,
  FileCheck,
  Stethoscope,
  Volume2,
  VolumeX,
  Printer,
  Sparkles,
  Zap,
  ArrowRight,
  ShieldAlert,
  ClipboardList,
  CheckSquare,
  Square,
  Bed,
  Share2
} from 'lucide-react';
import { TriageResult, PatientInfo, TriageVitals } from '../types/triage';

interface DoctorCockpitProps {
  result: TriageResult | null;
  patientInfo: PatientInfo;
  vitals: TriageVitals;
  isGenerating: boolean;
  onLoadDengueDemo: () => void;
  onPrint: () => void;
}

export const DoctorCockpit: React.FC<DoctorCockpitProps> = ({
  result,
  patientInfo,
  vitals,
  isGenerating,
  onLoadDengueDemo,
  onPrint
}) => {
  // Checkable action checklist state
  const [completedActions, setCompletedActions] = useState<Record<number, boolean>>({});
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [cabinDecision, setCabinDecision] = useState<string | null>(null);

  const toggleAction = (idx: number) => {
    setCompletedActions((prev) => ({
      ...prev,
      [idx]: !prev[idx]
    }));
  };

  // Play concise 15-second audio clinical briefing for the busy doctor
  const handlePlayAudioBriefing = () => {
    if (!result) return;

    if (isPlayingAudio) {
      window.speechSynthesis.cancel();
      setIsPlayingAudio(false);
      return;
    }

    if (!('speechSynthesis' in window)) {
      alert('Speech synthesis is not supported on this browser.');
      return;
    }

    const script = `Token ${patientInfo.token || 'A-104'}, Priority ${result.priority}. ${result.red_flags}. Subjective: ${result.subjective}. Key plan: ${result.plan.slice(0, 2).join('. ')}.`;

    const utterance = new SpeechSynthesisUtterance(script);
    utterance.rate = 1.05;
    utterance.pitch = 1.0;
    utterance.lang = 'en-IN';

    utterance.onstart = () => setIsPlayingAudio(true);
    utterance.onend = () => setIsPlayingAudio(false);
    utterance.onerror = () => setIsPlayingAudio(false);

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };

  const completedCount = result
    ? result.plan.reduce((acc, _, idx) => acc + (completedActions[idx] ? 1 : 0), 0)
    : 0;

  // Empty State View
  if (!result && !isGenerating) {
    return (
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs p-8 sm:p-12 text-center flex flex-col items-center justify-center min-h-[560px]">
        <div className="w-16 h-16 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center mb-4 ring-8 ring-sky-50/50">
          <Stethoscope className="w-8 h-8 stroke-[1.8]" />
        </div>

        <h3 className="font-heading font-extrabold text-xl text-slate-800 mb-2">
          Doctor's Clinical Cockpit (Decision Console)
        </h3>
        <p className="text-slate-500 text-sm max-w-md mx-auto mb-6 leading-relaxed">
          Triage decision support is waiting for patient intake. Record voice symptoms and nursing vitals on the left, or test instantly with realistic hospital pilot data.
        </p>

        <button
          type="button"
          onClick={onLoadDengueDemo}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-sm shadow-sm transition-all hover:shadow cursor-pointer"
        >
          <Zap className="w-4 h-4 fill-slate-950" />
          <span>⚡ 1-Click Load Dengue Emergency Demo</span>
        </button>

        <div className="mt-8 pt-6 border-t border-slate-100 grid grid-cols-3 gap-4 text-left w-full max-w-md">
          <div className="text-center">
            <span className="block font-mono-num font-bold text-slate-700 text-sm">&lt; 60 Sec</span>
            <span className="text-[11px] text-slate-400">Target Consult</span>
          </div>
          <div className="text-center border-x border-slate-100">
            <span className="block font-mono-num font-bold text-slate-700 text-sm">Strict SOAP</span>
            <span className="text-[11px] text-slate-400">Clinical Output</span>
          </div>
          <div className="text-center">
            <span className="block font-mono-num font-bold text-slate-700 text-sm">3-Tier</span>
            <span className="text-[11px] text-slate-400">Risk Triage</span>
          </div>
        </div>
      </div>
    );
  }

  // Loading Skeleton View
  if (isGenerating) {
    return (
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs p-8 sm:p-10 flex flex-col items-center justify-center min-h-[560px] text-center space-y-5">
        <div className="relative">
          <div className="w-16 h-16 rounded-2xl bg-sky-600 text-white flex items-center justify-center animate-bounce shadow-md">
            <Sparkles className="w-8 h-8" />
          </div>
          <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 ring-2 ring-white animate-ping"></div>
        </div>

        <div className="space-y-1.5 max-w-sm">
          <h3 className="font-heading font-bold text-lg text-slate-800">
            Synthesizing Clinical Briefing...
          </h3>
          <p className="text-xs text-slate-500">
            Gemini 2.0 Flash is analyzing vernacular narrative, correlating nursing vitals, and screening for emergency red flags.
          </p>
        </div>

        {/* Pulsing loading bars */}
        <div className="w-full max-w-sm space-y-2.5 pt-4">
          <div className="h-4 bg-slate-100 rounded-full animate-pulse w-3/4 mx-auto"></div>
          <div className="h-14 bg-slate-50 rounded-lg animate-pulse border border-slate-100"></div>
          <div className="h-20 bg-slate-50 rounded-lg animate-pulse border border-slate-100"></div>
          <div className="h-16 bg-slate-50 rounded-lg animate-pulse border border-slate-100"></div>
        </div>
      </div>
    );
  }

  if (!result) return null;

  // Priority Styling Mapping
  const priorityConfig = {
    HIGH: {
      label: '🔴 HIGH PRIORITY TRIAGE',
      badgeClass: 'bg-rose-600 text-white animate-gentle-pulse shadow-sm shadow-rose-600/20 ring-2 ring-rose-400/30',
      borderClass: 'border-rose-200/90',
      headerBg: 'bg-gradient-to-r from-rose-50/90 via-white to-rose-50/40',
      reasonColor: 'text-rose-900 bg-rose-50 border-rose-200'
    },
    MODERATE: {
      label: '🟡 MODERATE PRIORITY',
      badgeClass: 'bg-amber-500 text-slate-950 font-bold shadow-xs ring-2 ring-amber-400/30',
      borderClass: 'border-amber-200/90',
      headerBg: 'bg-gradient-to-r from-amber-50/90 via-white to-amber-50/40',
      reasonColor: 'text-amber-900 bg-amber-50 border-amber-200'
    },
    LOW: {
      label: '🟢 ROUTINE OPD',
      badgeClass: 'bg-emerald-600 text-white shadow-xs ring-2 ring-emerald-400/30',
      borderClass: 'border-emerald-200/90',
      headerBg: 'bg-gradient-to-r from-emerald-50/90 via-white to-emerald-50/40',
      reasonColor: 'text-emerald-900 bg-emerald-50 border-emerald-200'
    }
  }[result.priority] || {
    label: '🟡 MODERATE PRIORITY',
    badgeClass: 'bg-amber-500 text-slate-950 font-bold',
    borderClass: 'border-amber-200',
    headerBg: 'bg-white',
    reasonColor: 'text-amber-900 bg-amber-50 border-amber-200'
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden transition-all duration-200 space-y-0 print-full-width">
      
      {/* 1. Cockpit Header: Patient Token & Priority Pill */}
      <div className={`px-5 py-4 border-b ${priorityConfig.borderClass} ${priorityConfig.headerBg}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          
          <div className="flex items-center gap-2.5">
            <span className="font-mono-num font-extrabold text-base sm:text-lg text-slate-900">
              Patient Token #{patientInfo.token || 'A-104'}
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-xs text-slate-600 font-medium">
              {patientInfo.gender || 'Male'}, {patientInfo.age || '34'} Y
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Triage Priority Badge dynamically colored with subtle pulse */}
            <span
              className={`px-3 py-1 rounded-full text-xs font-heading font-extrabold tracking-wide ${priorityConfig.badgeClass}`}
            >
              {priorityConfig.label}
            </span>

            {/* Quick 15s Audio Briefing for Doctor */}
            <button
              type="button"
              onClick={handlePlayAudioBriefing}
              className={`no-print px-2.5 py-1 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                isPlayingAudio
                  ? 'bg-rose-100 text-rose-800 border-rose-300 animate-pulse'
                  : 'bg-white text-slate-700 hover:text-slate-900 border-slate-200 hover:bg-slate-50'
              }`}
              title="Plays concise 15-second speech briefing"
            >
              {isPlayingAudio ? (
                <>
                  <VolumeX className="w-3.5 h-3.5 text-rose-600" />
                  <span>Stop Briefing</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-3.5 h-3.5 text-sky-600" />
                  <span className="hidden sm:inline">15s Audio Brief</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Priority Reason callout */}
        <div className={`mt-2.5 px-3 py-1.5 rounded-lg border text-xs font-medium leading-relaxed ${priorityConfig.reasonColor}`}>
          <span className="font-bold">Triage Rationale: </span>
          {result.priority_reason}
        </div>
      </div>

      <div className="p-5 space-y-4">
        
        {/* 2. Clinical Red Flags Alert Banner */}
        {result.red_flags && result.red_flags.toLowerCase() !== 'none' && result.red_flags.toLowerCase() !== 'none identified' && (
          <div className="p-3.5 rounded-xl bg-rose-50 border-2 border-rose-300 text-rose-950 flex items-start gap-3 shadow-2xs">
            <div className="w-8 h-8 rounded-lg bg-rose-600 text-white flex items-center justify-center shrink-0 mt-0.5">
              <ShieldAlert className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div className="space-y-0.5 flex-1">
              <div className="font-heading font-extrabold text-xs uppercase tracking-wider text-rose-700 flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-rose-600" />
                Critical Clinical Red Flags Detected
              </div>
              <p className="text-xs sm:text-sm font-semibold text-rose-950 leading-relaxed">
                {result.red_flags}
              </p>
            </div>
          </div>
        )}

        {/* 3. SOAP Sections Grid */}
        <div className="space-y-3.5">
          
          {/* Card: Subjective (History & Vernacular Translation) */}
          <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs hover:border-slate-300 transition-colors">
            <div className="flex items-center justify-between mb-1.5">
              <h4 className="font-heading font-bold text-xs uppercase tracking-wider text-sky-700 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-sky-600"></span>
                Subjective (Clinical History)
              </h4>
              <span className="text-[11px] text-slate-400">Vernacular Translation</span>
            </div>
            <p className="text-slate-800 text-xs sm:text-sm leading-relaxed font-normal">
              {result.subjective}
            </p>
          </div>

          {/* Card: Objective (Vitals & Labs) */}
          <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs hover:border-slate-300 transition-colors">
            <div className="flex items-center justify-between mb-1.5">
              <h4 className="font-heading font-bold text-xs uppercase tracking-wider text-indigo-700 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                Objective (Vitals &amp; Lab Biomarkers)
              </h4>
              <span className="text-[11px] font-mono-num text-slate-400">BP • PR • Temp • SpO2</span>
            </div>
            <p className="text-slate-800 text-xs sm:text-sm leading-relaxed font-normal">
              {result.objective}
            </p>
          </div>

          {/* Card: Suggested Doctor Action Checklist (Plan) */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 shadow-2xs">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-heading font-bold text-xs uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <ClipboardList className="w-4 h-4 text-emerald-600" />
                Suggested Doctor Action Checklist (Plan)
              </h4>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-600 font-mono-num">
                {completedCount}/{result.plan.length} Completed
              </span>
            </div>

            <div className="space-y-2">
              {result.plan.map((item, idx) => {
                const isChecked = Boolean(completedActions[idx]);
                return (
                  <div
                    key={idx}
                    onClick={() => toggleAction(idx)}
                    className={`flex items-start gap-2.5 p-2.5 rounded-lg border transition-all cursor-pointer select-none ${
                      isChecked
                        ? 'bg-emerald-50/80 border-emerald-200 text-slate-500 line-through'
                        : 'bg-white border-slate-200/90 text-slate-800 hover:border-sky-300'
                    }`}
                  >
                    <button
                      type="button"
                      className="shrink-0 mt-0.5 text-slate-400 hover:text-emerald-600"
                    >
                      {isChecked ? (
                        <CheckSquare className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400" />
                      )}
                    </button>
                    <span className="text-xs sm:text-sm font-medium leading-snug flex-1">
                      {item}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* 4. Doctor Clinical Disposition / Cabin Decision Actions (Interactive Bar) */}
        <div className="p-3.5 rounded-xl border border-slate-200 bg-white no-print">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
            Physician Disposition Decision:
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setCabinDecision('Fast-Track IV Infusion Bay 4 (Admitted)')}
              className={`px-3 py-2 rounded-lg text-xs font-semibold border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                cabinDecision?.includes('Fast-Track')
                  ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                  : 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100'
              }`}
            >
              <Bed className="w-3.5 h-3.5" />
              <span>Fast-Track Bed 4</span>
            </button>

            <button
              type="button"
              onClick={() => setCabinDecision('Stat Emergency Resuscitation Unit (Escalated)')}
              className={`px-3 py-2 rounded-lg text-xs font-semibold border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                cabinDecision?.includes('Emergency')
                  ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                  : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Emergency Ward</span>
            </button>

            <button
              type="button"
              onClick={() => setCabinDecision('Outpatient Rx Prescribed &amp; 48h Follow-up')}
              className={`px-3 py-2 rounded-lg text-xs font-semibold border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                cabinDecision?.includes('Outpatient')
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                  : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Outpatient Rx</span>
            </button>
          </div>

          {cabinDecision && (
            <div className="mt-2.5 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-mono-num flex items-center justify-between">
              <span>Decision Logged: {cabinDecision}</span>
              <span className="text-slate-400 text-[10px]">Signed by Duty MO</span>
            </div>
          )}
        </div>

        {/* 5. Mandatory Clinical Disclaimer Footer */}
        <div className="pt-2 text-center border-t border-slate-100">
          <p className="text-[11px] text-slate-400 font-medium leading-relaxed">
            ⚠️ AI Clinical Decision Support Only • Requires verification by Registered Medical Practitioner (MOHFW/DHR Guidelines).
          </p>
        </div>

      </div>
    </div>
  );
};

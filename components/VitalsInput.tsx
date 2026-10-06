"use client";

import React from "react";
import { VitalsData } from "@/lib/types";
import { Heart, Thermometer, Wind, Gauge, AlertCircle } from "lucide-react";

interface VitalsInputProps {
  vitals: VitalsData;
  onChange: (vitals: VitalsData) => void;
  disabled?: boolean;
}

export const VitalsInput: React.FC<VitalsInputProps> = ({
  vitals,
  onChange,
  disabled = false,
}) => {
  const updateVital = (key: keyof VitalsData, value: string) => {
    onChange({
      ...vitals,
      [key]: value,
    });
  };

  // Threshold checkers for visual clinical feedback
  const sys = parseInt(vitals.bpSystolic) || 0;
  const dia = parseInt(vitals.bpDiastolic) || 0;
  const pulse = parseInt(vitals.pulse) || 0;
  const temp = parseFloat(vitals.temp) || 0;
  const spo2 = parseInt(vitals.spo2) || 0;

  const isBpAbnormal = (sys > 0 && (sys > 140 || sys < 95)) || (dia > 0 && (dia > 90 || dia < 60));
  const isPulseAbnormal = pulse > 0 && (pulse > 100 || pulse < 55);
  const isTempAbnormal = temp > 0 && (temp >= 100.4 || temp < 96.5);
  const isSpo2Abnormal = spo2 > 0 && spo2 < 95;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          <Gauge className="w-3.5 h-3.5 text-teal-400" />
          <span>Nurse Objective Vitals</span>
        </label>
        <span className="text-[11px] text-slate-500">Auto-flagged thresholds</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {/* Blood Pressure Card */}
        <div
          className={`p-3 rounded-xl border transition-all duration-200 ${
            isBpAbnormal
              ? "bg-rose-950/20 border-rose-500/50 ring-1 ring-rose-500/30"
              : "bg-slate-900/80 border-slate-800 focus-within:border-teal-500/60"
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
              <Gauge className="w-3 h-3 text-teal-400" /> BP (mmHg)
            </span>
            {isBpAbnormal && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30">
                Flagged
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 text-sm font-mono">
            <input
              type="number"
              placeholder="120"
              value={vitals.bpSystolic}
              onChange={(e) => updateVital("bpSystolic", e.target.value)}
              disabled={disabled}
              className="w-12 bg-slate-950 px-2 py-1 rounded text-center text-white placeholder-slate-600 font-bold border border-slate-800 focus:outline-none focus:border-teal-500"
            />
            <span className="text-slate-500">/</span>
            <input
              type="number"
              placeholder="80"
              value={vitals.bpDiastolic}
              onChange={(e) => updateVital("bpDiastolic", e.target.value)}
              disabled={disabled}
              className="w-12 bg-slate-950 px-2 py-1 rounded text-center text-white placeholder-slate-600 font-bold border border-slate-800 focus:outline-none focus:border-teal-500"
            />
          </div>
          <span className="text-[10px] text-slate-500 block mt-1">Norm: 120/80</span>
        </div>

        {/* Pulse Rate Card */}
        <div
          className={`p-3 rounded-xl border transition-all duration-200 ${
            isPulseAbnormal
              ? "bg-rose-950/20 border-rose-500/50 ring-1 ring-rose-500/30"
              : "bg-slate-900/80 border-slate-800 focus-within:border-teal-500/60"
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
              <Heart className={`w-3 h-3 ${isPulseAbnormal ? "text-rose-400 animate-pulse" : "text-rose-400"}`} /> Pulse
            </span>
            {isPulseAbnormal && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30">
                {pulse > 100 ? "Tachy" : "Brady"}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 text-sm font-mono">
            <input
              type="number"
              placeholder="72"
              value={vitals.pulse}
              onChange={(e) => updateVital("pulse", e.target.value)}
              disabled={disabled}
              className="w-full bg-slate-950 px-2 py-1 rounded text-center text-white placeholder-slate-600 font-bold border border-slate-800 focus:outline-none focus:border-teal-500"
            />
            <span className="text-xs text-slate-500">bpm</span>
          </div>
          <span className="text-[10px] text-slate-500 block mt-1">Norm: 60-100</span>
        </div>

        {/* Temperature Card */}
        <div
          className={`p-3 rounded-xl border transition-all duration-200 ${
            isTempAbnormal
              ? "bg-amber-950/20 border-amber-500/50 ring-1 ring-amber-500/30"
              : "bg-slate-900/80 border-slate-800 focus-within:border-teal-500/60"
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
              <Thermometer className="w-3 h-3 text-amber-400" /> Temp
            </span>
            {isTempAbnormal && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                Fever
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 text-sm font-mono">
            <input
              type="number"
              step="0.1"
              placeholder="98.6"
              value={vitals.temp}
              onChange={(e) => updateVital("temp", e.target.value)}
              disabled={disabled}
              className="w-full bg-slate-950 px-2 py-1 rounded text-center text-white placeholder-slate-600 font-bold border border-slate-800 focus:outline-none focus:border-teal-500"
            />
            <span className="text-xs text-slate-500">°F</span>
          </div>
          <span className="text-[10px] text-slate-500 block mt-1">Norm: 98.6°F</span>
        </div>

        {/* SpO2 Card */}
        <div
          className={`p-3 rounded-xl border transition-all duration-200 ${
            isSpo2Abnormal
              ? "bg-cyan-950/30 border-cyan-400/60 ring-1 ring-cyan-400/40"
              : "bg-slate-900/80 border-slate-800 focus-within:border-teal-500/60"
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
              <Wind className="w-3 h-3 text-cyan-400" /> SpO2
            </span>
            {isSpo2Abnormal && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30">
                Low
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 text-sm font-mono">
            <input
              type="number"
              placeholder="99"
              value={vitals.spo2}
              onChange={(e) => updateVital("spo2", e.target.value)}
              disabled={disabled}
              className="w-full bg-slate-950 px-2 py-1 rounded text-center text-white placeholder-slate-600 font-bold border border-slate-800 focus:outline-none focus:border-teal-500"
            />
            <span className="text-xs text-slate-500">%</span>
          </div>
          <span className="text-[10px] text-slate-500 block mt-1">Norm: ≥95%</span>
        </div>
      </div>
    </div>
  );
};

"use client";

import React from "react";
import {
  Activity,
  Zap,
  KeyRound,
  RotateCcw,
  Sparkles,
  Building2,
  Clock,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";

interface NavbarProps {
  onLoadDengueDemo: () => void;
  onReset: () => void;
  isLoading: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  onLoadDengueDemo,
  onReset,
  isLoading,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-slate-950/85 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Left: Brand & Hospital Identity */}
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-500 to-emerald-400 text-slate-950 shadow-md shadow-teal-500/20">
            <Activity className="w-5 h-5 stroke-[2.5]" />
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-white flex items-center gap-1">
                Rapi<span className="text-teal-400 font-extrabold">Cure</span>
                <span className="text-emerald-400 font-mono text-xs font-semibold">.ai.studio</span>
              </h1>
              <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-teal-500/10 text-teal-300 border border-teal-500/20 font-mono">
                rapicure.ai.studio
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden md:flex items-center gap-1.5">
              <span>AIIMS Jodhpur & Dr. S.N. Medical College</span>
              <span className="text-slate-600">•</span>
              <span className="text-teal-400/90 font-medium">AAYU 2026</span>
            </p>
          </div>
        </div>

        {/* Center: Live Clinic Room Indicator */}
        <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-xs text-slate-300">
          <Building2 className="w-3.5 h-3.5 text-teal-400" />
          <span className="font-medium text-white">OPD Room #4</span>
          <span className="text-slate-600">|</span>
          <Clock className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-slate-400">Triage Queue Active</span>
        </div>

        {/* Right: Quick Action Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Failsafe Demo Button */}
          <button
            onClick={onLoadDengueDemo}
            disabled={isLoading}
            className="group relative inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 hover:from-amber-400 hover:to-rose-400 text-white shadow-lg shadow-orange-500/20 hover:shadow-orange-500/30 transition-all duration-200 active:scale-95 disabled:opacity-50"
            title="1-Click Emergency Dengue Demo Case with Vitals & CBC"
          >
            <Zap className="w-3.5 h-3.5 fill-current animate-pulse text-amber-100" />
            <span className="font-bold tracking-wide">⚡ Load Dengue Demo</span>
          </button>

          {/* Open in Full Window / Tab Button */}
          <button
            onClick={() => {
              if (typeof window !== "undefined") {
                window.open(window.location.href, "_blank");
              }
            }}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-teal-500/50 transition-colors"
            title="Open app in a full browser tab for full native microphone permissions"
          >
            <ExternalLink className="w-3.5 h-3.5 text-teal-400" />
            <span className="hidden md:inline">Open in Tab</span>
          </button>

          {/* Reset Button */}
          <button
            onClick={onReset}
            disabled={isLoading}
            className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 transition-colors"
            title="Reset form for next patient"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>New Patient</span>
          </button>

          {/* Backend AI Engine Status Badge */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 border border-teal-500/30 text-teal-300 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="hidden sm:inline">Gemini 2.0 Active</span>
          </div>
        </div>
      </div>
    </header>
  );
};

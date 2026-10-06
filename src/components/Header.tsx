import React from 'react';
import { Activity, Printer, Zap, Sparkles, Building2, Stethoscope, ChevronDown } from 'lucide-react';
import { DemoCase } from '../types/triage';
import { DENGUE_DEMO_CASE, CHEST_PAIN_DEMO_CASE, ROUTINE_OPD_DEMO_CASE } from '../data/demoCases';

interface HeaderProps {
  onLoadDemoCase: (demo: DemoCase) => void;
  onPrint: () => void;
  isGenerating: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  onLoadDemoCase,
  onPrint,
  isGenerating
}) => {
  const [showDropdown, setShowDropdown] = React.useState(false);

  return (
    <header className="bg-white border-b border-slate-200/90 sticky top-0 z-30 shadow-xs no-print">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-18">
          
          {/* Left: Hospital Pilot Badge & Logo */}
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br from-sky-600 to-sky-700 text-white shadow-sm ring-2 ring-sky-500/20">
              <Stethoscope className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-heading font-extrabold text-xl tracking-tight text-slate-900">
                  MedAssist<span className="text-sky-600">.AI</span>
                </span>
                <span className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-sky-50 text-sky-700 border border-sky-200/80">
                  Pre-OPD Scribe
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                <span>AIIMS &amp; Dr. S.N. Medical College Pilot</span>
                <span className="text-slate-300">•</span>
                <span className="text-emerald-600 font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Gemini 2.0 Flash Active
                </span>
              </div>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            
            {/* 1-Click Primary Demo Button */}
            <div className="relative">
              <div className="inline-flex rounded-lg shadow-xs">
                <button
                  type="button"
                  onClick={() => onLoadDemoCase(DENGUE_DEMO_CASE)}
                  disabled={isGenerating}
                  className="inline-flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-semibold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-l-lg transition-colors cursor-pointer disabled:opacity-50"
                  title="Fills realistic Dengue emergency sample data for instant 1-click stage demo without manual typing"
                >
                  <Zap className="w-4 h-4 fill-amber-500 text-amber-600" />
                  <span className="font-bold">⚡ Load Dengue Demo Case</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowDropdown(!showDropdown)}
                  className="px-2 py-2 text-amber-900 bg-amber-50 hover:bg-amber-100 border-t border-b border-r border-amber-300 rounded-r-lg transition-colors cursor-pointer"
                  title="More Clinical Demo Presets"
                >
                  <ChevronDown className="w-3.5 h-3.5 text-amber-700" />
                </button>
              </div>

              {/* Presets dropdown */}
              {showDropdown && (
                <div 
                  className="absolute right-0 mt-1.5 w-72 bg-white rounded-xl shadow-lg border border-slate-200 py-1.5 z-40"
                  onMouseLeave={() => setShowDropdown(false)}
                >
                  <div className="px-3 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    OPD Clinical Scenarios
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onLoadDemoCase(DENGUE_DEMO_CASE);
                      setShowDropdown(false);
                    }}
                    className="w-full text-left px-3.5 py-2 text-xs hover:bg-amber-50/80 flex items-start gap-2.5 transition-colors cursor-pointer"
                  >
                    <span className="w-2 h-2 rounded-full bg-rose-500 mt-1 shrink-0"></span>
                    <div>
                      <div className="font-semibold text-slate-900">Dengue with Warning Signs</div>
                      <div className="text-[11px] text-slate-500">Hindi voice narrative + 38k platelet CBC</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onLoadDemoCase(CHEST_PAIN_DEMO_CASE);
                      setShowDropdown(false);
                    }}
                    className="w-full text-left px-3.5 py-2 text-xs hover:bg-rose-50/80 flex items-start gap-2.5 transition-colors cursor-pointer"
                  >
                    <span className="w-2 h-2 rounded-full bg-red-600 mt-1 shrink-0"></span>
                    <div>
                      <div className="font-semibold text-slate-900">Acute Anginal Chest Pain / STEMI</div>
                      <div className="text-[11px] text-slate-500">English narrative + hypotension + diaphoresis</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onLoadDemoCase(ROUTINE_OPD_DEMO_CASE);
                      setShowDropdown(false);
                    }}
                    className="w-full text-left px-3.5 py-2 text-xs hover:bg-emerald-50/80 flex items-start gap-2.5 transition-colors cursor-pointer"
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-500 mt-1 shrink-0"></span>
                    <div>
                      <div className="font-semibold text-slate-900">Routine OPD Dyspepsia</div>
                      <div className="text-[11px] text-slate-500">Normal hemodynamics + gastric complaints</div>
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* Print Prescription / Clinical Note Button */}
            <button
              type="button"
              onClick={onPrint}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 hover:text-slate-900 border border-slate-200/90 rounded-lg shadow-2xs transition-colors cursor-pointer"
              title="Print Prescription / Doctor Consultation Sheet (window.print)"
            >
              <Printer className="w-4 h-4 text-slate-500" />
              <span className="hidden sm:inline">Print Clinical Slip</span>
            </button>

          </div>
        </div>
      </div>
    </header>
  );
};

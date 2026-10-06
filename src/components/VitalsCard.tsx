import React from 'react';
import { HeartPulse, Thermometer, Gauge, Wind, AlertTriangle, UserCheck } from 'lucide-react';
import { TriageVitals, PatientInfo } from '../types/triage';

interface VitalsCardProps {
  vitals: TriageVitals;
  onVitalsChange: (vitals: TriageVitals) => void;
  patientInfo: PatientInfo;
  onPatientInfoChange: (info: PatientInfo) => void;
}

export const VitalsCard: React.FC<VitalsCardProps> = ({
  vitals,
  onVitalsChange,
  patientInfo,
  onPatientInfoChange
}) => {
  const updateField = (field: keyof TriageVitals, value: string) => {
    onVitalsChange({
      ...vitals,
      [field]: value
    });
  };

  const updatePatientField = (field: keyof PatientInfo, value: string) => {
    onPatientInfoChange({
      ...patientInfo,
      [field]: value
    });
  };

  // Clinical vital status evaluations
  const pulseNum = parseFloat(vitals.pulse);
  const tempNum = parseFloat(vitals.temp);
  const spo2Num = parseFloat(vitals.spo2);
  const bpMatch = vitals.bp.match(/(\d+)\s*\/\s*(\d+)/);
  const systolic = bpMatch ? parseInt(bpMatch[1], 10) : null;
  const diastolic = bpMatch ? parseInt(bpMatch[2], 10) : null;

  const isTachycardia = !isNaN(pulseNum) && pulseNum > 100;
  const isBradycardia = !isNaN(pulseNum) && pulseNum < 60 && pulseNum > 20;
  const isHighFever = !isNaN(tempNum) && tempNum >= 101.0;
  const isMildFever = !isNaN(tempNum) && tempNum > 99.5 && tempNum < 101.0;
  const isHypoxia = !isNaN(spo2Num) && spo2Num < 95;
  const isHypotension = systolic !== null && systolic < 95;
  const isHypertension = systolic !== null && systolic >= 140;

  return (
    <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden transition-all duration-200 hover:border-slate-300">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-slate-50/80 to-white">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center font-bold text-xs border border-sky-100">
            02
          </div>
          <div>
            <h3 className="font-heading font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
              Assistant Triage Vitals
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60 font-semibold">
                Nurse Station
              </span>
            </h3>
            <p className="text-xs text-slate-500">
              Bedside vitals &amp; patient identification before doctor entry
            </p>
          </div>
        </div>

        {/* Token # Badge */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500">Token:</span>
          <span className="px-2.5 py-1 rounded-md bg-slate-900 text-white font-mono-num font-bold text-xs shadow-2xs tracking-wider">
            #{patientInfo.token || 'A-104'}
          </span>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* Quick Patient Demographics */}
        <div className="grid grid-cols-3 gap-2.5 bg-slate-50/70 p-3 rounded-lg border border-slate-200/60">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Token #
            </label>
            <input
              type="text"
              value={patientInfo.token}
              onChange={(e) => updatePatientField('token', e.target.value)}
              placeholder="A-104"
              className="w-full px-2.5 py-1.5 text-xs font-mono-num font-bold bg-white rounded border border-slate-200 text-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Age (Years)
            </label>
            <input
              type="text"
              value={patientInfo.age}
              onChange={(e) => updatePatientField('age', e.target.value)}
              placeholder="34"
              className="w-full px-2.5 py-1.5 text-xs font-mono-num bg-white rounded border border-slate-200 text-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Gender
            </label>
            <select
              value={patientInfo.gender}
              onChange={(e) => updatePatientField('gender', e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-white rounded border border-slate-200 text-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-500 cursor-pointer"
            >
              <option value="Male">Male (पुरुष)</option>
              <option value="Female">Female (महिला)</option>
              <option value="Child/Other">Child/Other</option>
            </select>
          </div>
        </div>

        {/* 4-Cell Numeric Grid with Inline Units */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          
          {/* Blood Pressure */}
          <div
            className={`p-3.5 rounded-xl border transition-all ${
              isHypotension
                ? 'bg-rose-50/80 border-rose-300 ring-1 ring-rose-400/30'
                : isHypertension
                ? 'bg-amber-50/80 border-amber-300'
                : 'bg-slate-50/60 border-slate-200/80'
            }`}
          >
            <div className="flex items-center justify-between text-slate-500 mb-1.5">
              <span className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                <Gauge className="w-3.5 h-3.5 text-sky-600" />
                BP
              </span>
              <span className="text-[11px] font-medium text-slate-400">mmHg</span>
            </div>
            <div className="relative">
              <input
                type="text"
                value={vitals.bp}
                onChange={(e) => updateField('bp', e.target.value)}
                placeholder="120/80"
                className="w-full font-mono-num font-bold text-lg text-slate-900 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
              />
            </div>
            <div className="mt-1.5 text-[11px] font-medium min-h-[16px]">
              {isHypotension ? (
                <span className="text-rose-600 font-bold flex items-center gap-0.5">
                  ⚠️ Low Perfusion
                </span>
              ) : isHypertension ? (
                <span className="text-amber-700 font-semibold">Elevated BP</span>
              ) : (
                <span className="text-slate-400">Target: 120/80</span>
              )}
            </div>
          </div>

          {/* Pulse Rate */}
          <div
            className={`p-3.5 rounded-xl border transition-all ${
              isTachycardia
                ? 'bg-rose-50/80 border-rose-300 ring-1 ring-rose-400/30'
                : isBradycardia
                ? 'bg-amber-50/80 border-amber-300'
                : 'bg-slate-50/60 border-slate-200/80'
            }`}
          >
            <div className="flex items-center justify-between text-slate-500 mb-1.5">
              <span className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                <HeartPulse className="w-3.5 h-3.5 text-rose-500" />
                Pulse Rate
              </span>
              <span className="text-[11px] font-medium text-slate-400">bpm</span>
            </div>
            <div className="relative">
              <input
                type="text"
                value={vitals.pulse}
                onChange={(e) => updateField('pulse', e.target.value)}
                placeholder="78"
                className="w-full font-mono-num font-bold text-lg text-slate-900 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
              />
            </div>
            <div className="mt-1.5 text-[11px] font-medium min-h-[16px]">
              {isTachycardia ? (
                <span className="text-rose-600 font-bold flex items-center gap-0.5">
                  ⚠️ Tachycardia
                </span>
              ) : isBradycardia ? (
                <span className="text-amber-700 font-semibold">Bradycardia</span>
              ) : (
                <span className="text-slate-400">Norm: 60-100</span>
              )}
            </div>
          </div>

          {/* Temperature */}
          <div
            className={`p-3.5 rounded-xl border transition-all ${
              isHighFever
                ? 'bg-rose-50/80 border-rose-300 ring-1 ring-rose-400/30'
                : isMildFever
                ? 'bg-amber-50/80 border-amber-300'
                : 'bg-slate-50/60 border-slate-200/80'
            }`}
          >
            <div className="flex items-center justify-between text-slate-500 mb-1.5">
              <span className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                <Thermometer className="w-3.5 h-3.5 text-amber-500" />
                Temp
              </span>
              <span className="text-[11px] font-medium text-slate-400">°F</span>
            </div>
            <div className="relative">
              <input
                type="text"
                value={vitals.temp}
                onChange={(e) => updateField('temp', e.target.value)}
                placeholder="98.6"
                className="w-full font-mono-num font-bold text-lg text-slate-900 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
              />
            </div>
            <div className="mt-1.5 text-[11px] font-medium min-h-[16px]">
              {isHighFever ? (
                <span className="text-rose-600 font-bold flex items-center gap-0.5">
                  🔥 High Pyrexia
                </span>
              ) : isMildFever ? (
                <span className="text-amber-700 font-semibold">Low-grade pyrexia</span>
              ) : (
                <span className="text-slate-400">Norm: 98.6°F</span>
              )}
            </div>
          </div>

          {/* SpO2 */}
          <div
            className={`p-3.5 rounded-xl border transition-all ${
              isHypoxia
                ? 'bg-rose-50/80 border-rose-300 ring-1 ring-rose-400/30'
                : 'bg-slate-50/60 border-slate-200/80'
            }`}
          >
            <div className="flex items-center justify-between text-slate-500 mb-1.5">
              <span className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                <Wind className="w-3.5 h-3.5 text-sky-500" />
                SpO2 Level
              </span>
              <span className="text-[11px] font-medium text-slate-400">%</span>
            </div>
            <div className="relative">
              <input
                type="text"
                value={vitals.spo2}
                onChange={(e) => updateField('spo2', e.target.value)}
                placeholder="98"
                className="w-full font-mono-num font-bold text-lg text-slate-900 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
              />
            </div>
            <div className="mt-1.5 text-[11px] font-medium min-h-[16px]">
              {isHypoxia ? (
                <span className="text-rose-600 font-bold flex items-center gap-0.5">
                  🚨 Hypoxia (&lt;95%)
                </span>
              ) : (
                <span className="text-slate-400">Target: ≥96%</span>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

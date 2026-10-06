import React from 'react';
import { TriageResult, PatientInfo, TriageVitals, AttachedImage } from '../types/triage';

interface PrintSlipProps {
  result: TriageResult | null;
  patientInfo: PatientInfo;
  vitals: TriageVitals;
  symptoms: string;
  attachedImage: AttachedImage | null;
}

export const PrintSlip: React.FC<PrintSlipProps> = ({
  result,
  patientInfo,
  vitals,
  symptoms,
  attachedImage
}) => {
  if (!result) return null;

  return (
    <div className="hidden print-only p-6 text-black bg-white font-sans max-w-4xl mx-auto">
      {/* Hospital Letterhead Header */}
      <div className="border-b-2 border-slate-900 pb-3 mb-4 text-center">
        <h1 className="text-xl font-bold uppercase tracking-wide text-slate-950">
          ALL INDIA INSTITUTE OF MEDICAL SCIENCES &amp; DR. S.N. MEDICAL COLLEGE
        </h1>
        <h2 className="text-sm font-semibold text-slate-700">
          CENTRAL EMERGENCY &amp; OUTPATIENT DEPARTMENT (OPD) TRIAGE UNIT
        </h2>
        <div className="text-xs text-slate-500 mt-1">
          Pre-OPD Fast-Track Clinical Decision Scribe • AAYU 2026 AI Innovation Pilot
        </div>
      </div>

      {/* Patient Identification Strip */}
      <div className="grid grid-cols-4 gap-2 border border-slate-300 p-2 text-xs mb-4 bg-slate-50">
        <div>
          <span className="font-bold">Token No:</span> #{patientInfo.token || 'A-104'}
        </div>
        <div>
          <span className="font-bold">Patient:</span> {patientInfo.name || 'Anonymous'}
        </div>
        <div>
          <span className="font-bold">Age / Gender:</span> {patientInfo.age || '34'} Y / {patientInfo.gender || 'Male'}
        </div>
        <div>
          <span className="font-bold">Date &amp; Time:</span> {new Date().toLocaleDateString()} {patientInfo.queueTime || '10:15 AM'}
        </div>
      </div>

      {/* Triage Priority Banner */}
      <div className="border-2 border-slate-900 p-2 mb-4 flex items-center justify-between">
        <div>
          <span className="font-bold uppercase text-xs">TRIAGE STRATIFICATION: </span>
          <span className="font-black text-sm uppercase">
            [{result.priority} PRIORITY]
          </span>
        </div>
        <div className="text-xs italic text-slate-700">
          {result.priority_reason}
        </div>
      </div>

      {/* Bedside Vitals Grid */}
      <div className="mb-4">
        <h3 className="text-xs font-bold uppercase border-b border-slate-300 mb-1">
          Bedside Nurse Station Vitals
        </h3>
        <table className="w-full text-xs border border-slate-300 text-left">
          <thead className="bg-slate-100 font-bold">
            <tr>
              <th className="p-1.5 border border-slate-300">Blood Pressure</th>
              <th className="p-1.5 border border-slate-300">Pulse Rate</th>
              <th className="p-1.5 border border-slate-300">Temperature</th>
              <th className="p-1.5 border border-slate-300">Oxygen Saturation (SpO2)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="p-1.5 border border-slate-300 font-mono font-bold">{vitals.bp} mmHg</td>
              <td className="p-1.5 border border-slate-300 font-mono font-bold">{vitals.pulse} bpm</td>
              <td className="p-1.5 border border-slate-300 font-mono font-bold">{vitals.temp} °F</td>
              <td className="p-1.5 border border-slate-300 font-mono font-bold">{vitals.spo2} %</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Critical Red Flags */}
      {result.red_flags && (
        <div className="border border-red-500 bg-red-50 p-2.5 mb-4 text-xs">
          <span className="font-bold text-red-700 uppercase">CRITICAL RED FLAGS: </span>
          <span className="font-bold text-red-900">{result.red_flags}</span>
        </div>
      )}

      {/* SOAP Clinical Synthesis */}
      <div className="space-y-3 mb-6 text-xs">
        <div className="border border-slate-300 p-2.5">
          <div className="font-bold uppercase text-slate-800 mb-1">
            Subjective (Patient Narrative &amp; Clinical Synthesis):
          </div>
          <p className="text-slate-900 leading-relaxed">{result.subjective}</p>
          {symptoms && (
            <div className="mt-1 pt-1 border-t border-slate-200 text-[10px] text-slate-500 italic">
              Original Vernacular Intake: "{symptoms}"
            </div>
          )}
        </div>

        <div className="border border-slate-300 p-2.5">
          <div className="font-bold uppercase text-slate-800 mb-1">
            Objective (Vitals &amp; Diagnostic Biomarkers):
          </div>
          <p className="text-slate-900 leading-relaxed">{result.objective}</p>
          {attachedImage && (
            <div className="mt-1 text-[10px] text-slate-600">
              Attached Diagnostic Image: {attachedImage.name}
            </div>
          )}
        </div>

        <div className="border border-slate-300 p-2.5">
          <div className="font-bold uppercase text-slate-800 mb-1">
            Suggested Doctor Action Plan (Assessment &amp; Orders):
          </div>
          <ol className="list-decimal pl-4 space-y-1">
            {result.plan.map((action, i) => (
              <li key={i} className="text-slate-900 font-medium">{action}</li>
            ))}
          </ol>
        </div>
      </div>

      {/* Doctor Sign-off & Rx Notes Area */}
      <div className="grid grid-cols-2 gap-4 border-t-2 border-slate-900 pt-4 mt-8 text-xs">
        <div>
          <div className="font-bold mb-1">Attending Medical Officer Notes &amp; Rx:</div>
          <div className="h-16 border-b border-dashed border-slate-400"></div>
        </div>
        <div className="text-right flex flex-col justify-end">
          <div className="text-slate-400 mb-8">[Signature &amp; Hospital Stamp]</div>
          <div className="font-bold">Duty Medical Officer / Registrar</div>
          <div className="text-slate-500 text-[10px]">Registration No: ______________________</div>
        </div>
      </div>

      {/* Legal & MOHFW Disclaimer */}
      <div className="text-center text-[9px] text-slate-500 mt-6 border-t pt-2">
        MOHFW &amp; DHR Clinical Decision Support System Guidelines Compliant • Generated by MedAssist AI Engine
      </div>
    </div>
  );
};

"use client";

import React from "react";
import { TriageResult } from "@/lib/types";

interface PrintableSlipProps {
  triageResult: TriageResult | null;
}

export const PrintableSlip: React.FC<PrintableSlipProps> = ({ triageResult }) => {
  if (!triageResult) return null;

  const currentDate = new Date().toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const currentTime = new Date().toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="hidden print:block text-black bg-white p-8 max-w-4xl mx-auto font-sans leading-tight">
      {/* Hospital Letterhead */}
      <div className="border-b-2 border-black pb-3 mb-4 text-center">
        <h1 className="text-xl font-black uppercase tracking-wider">
          AIIMS JODHPUR & DR. S.N. MEDICAL COLLEGE
        </h1>
        <p className="text-xs font-semibold text-gray-700">
          Outpatient Department (OPD) • General Medicine & Triage Unit
        </p>
        <p className="text-[10px] text-gray-500 mt-0.5">
          AAYU 2026 AI Innovation • Powered by RapiCure AI Pre-Consultation Scribe
        </p>
      </div>

      {/* Patient Demographic & OPD Meta Header */}
      <div className="grid grid-cols-3 gap-2 border border-black p-2.5 text-xs mb-4">
        <div>
          <span className="font-bold">Patient Name: </span>
          <span>{triageResult.patientInfo.name || "N/A"}</span>
        </div>
        <div>
          <span className="font-bold">Age / Gender: </span>
          <span>
            {triageResult.patientInfo.age || "--"} Y / {triageResult.patientInfo.gender}
          </span>
        </div>
        <div>
          <span className="font-bold">Token No: </span>
          <span className="font-mono font-bold">{triageResult.patientInfo.tokenNo || "--"}</span>
        </div>
        <div>
          <span className="font-bold">UHID / CR No: </span>
          <span className="font-mono">{triageResult.patientInfo.uhid || "AIIMS-JDH-2026-TEMP"}</span>
        </div>
        <div>
          <span className="font-bold">Date & Time: </span>
          <span>
            {currentDate}, {currentTime}
          </span>
        </div>
        <div>
          <span className="font-bold">Triage Priority: </span>
          <span
            className={`font-black uppercase px-1 rounded ${
              triageResult.priority === "HIGH"
                ? "bg-black text-white"
                : "border border-black"
            }`}
          >
            {triageResult.priority}
          </span>
        </div>
      </div>

      {/* Recorded Vitals Table */}
      <div className="mb-4">
        <h2 className="text-xs font-black uppercase tracking-wide border-b border-gray-400 pb-1 mb-1.5">
          Recorded Baseline Vitals (Nurse Station)
        </h2>
        <table className="w-full text-xs border border-collapse border-black text-center">
          <thead>
            <tr className="bg-gray-100 font-bold border-b border-black">
              <th className="p-1 border-r border-black">Blood Pressure</th>
              <th className="p-1 border-r border-black">Pulse Rate</th>
              <th className="p-1 border-r border-black">Temperature</th>
              <th className="p-1">SpO2 (Room Air)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="p-1 border-r border-black font-semibold">
                {triageResult.vitals.bpSystolic}/{triageResult.vitals.bpDiastolic} mmHg
              </td>
              <td className="p-1 border-r border-black font-semibold">
                {triageResult.vitals.pulse} bpm
              </td>
              <td className="p-1 border-r border-black font-semibold">
                {triageResult.vitals.temp} °F
              </td>
              <td className="p-1 font-semibold">{triageResult.vitals.spo2} %</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Chronic Conditions & Current Medications */}
      {((triageResult.patientInfo.chronicConditions &&
        triageResult.patientInfo.chronicConditions.length > 0) ||
        (triageResult.patientInfo.currentMedications &&
          triageResult.patientInfo.currentMedications.length > 0)) && (
        <div className="mb-4 border border-black p-2 text-xs">
          <h2 className="text-[11px] font-black uppercase tracking-wide border-b border-gray-300 pb-1 mb-1">
            Patient Medical Background & Active Drug Therapy
          </h2>
          <div className="grid grid-cols-2 gap-2 mt-1">
            <div>
              <span className="font-bold">Chronic Conditions / Comorbidities: </span>
              <span>
                {triageResult.patientInfo.chronicConditions &&
                triageResult.patientInfo.chronicConditions.length > 0
                  ? triageResult.patientInfo.chronicConditions.join("; ")
                  : "None reported"}
              </span>
            </div>
            <div>
              <span className="font-bold">Current Active Medications: </span>
              <span>
                {triageResult.patientInfo.currentMedications &&
                triageResult.patientInfo.currentMedications.length > 0
                  ? triageResult.patientInfo.currentMedications.join("; ")
                  : "None reported"}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Red Flag Warning Box */}
      {triageResult.red_flags && (
        <div className="border-2 border-black p-2 mb-4 bg-gray-50 text-xs">
          <span className="font-black uppercase tracking-wider block text-black">
            ⚠️ Critical Red Flag & Clinical Warning:
          </span>
          <p className="font-semibold text-gray-900 mt-0.5">{triageResult.red_flags}</p>
        </div>
      )}

      {/* Structured Clinical SOAP Synthesis */}
      <div className="space-y-3 mb-6">
        <div>
          <h2 className="text-xs font-black uppercase tracking-wide border-b border-gray-400 pb-1 mb-1">
            Subjective (Patient Narrative & Clinical History)
          </h2>
          <p className="text-xs text-gray-800 leading-relaxed pl-1">{triageResult.subjective}</p>
        </div>

        <div>
          <h2 className="text-xs font-black uppercase tracking-wide border-b border-gray-400 pb-1 mb-1">
            Objective (Vitals Review & Diagnostic Lab Findings)
          </h2>
          <p className="text-xs text-gray-800 leading-relaxed pl-1">{triageResult.objective}</p>
        </div>

        <div>
          <h2 className="text-xs font-black uppercase tracking-wide border-b border-gray-400 pb-1 mb-1">
            Recommended Management & Investigation Plan
          </h2>
          <ul className="text-xs text-gray-800 pl-4 list-decimal space-y-1">
            {triageResult.plan.map((item, idx) => (
              <li key={idx} className="leading-snug">
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Doctor Rx Notes Section & Signature */}
      <div className="border-t-2 border-black pt-3">
        <h2 className="text-xs font-black uppercase tracking-wide mb-1">
          Consulting Physician Rx & Orders:
        </h2>
        <div className="h-28 border border-dashed border-gray-400 rounded p-2 text-gray-400 text-xs italic">
          [ Doctor physical prescription / signature / stamp area ]
        </div>

        <div className="flex justify-between items-end mt-6 pt-4 text-xs font-bold">
          <div>
            <p>Triage Scribe: RapiCure AI v2.0</p>
            <p className="text-[10px] text-gray-500 font-normal">
              Verified by Triage Nurse Station
            </p>
          </div>
          <div className="text-center border-t border-black pt-1 w-48">
            <p>Doctor's Signature & Reg. No.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

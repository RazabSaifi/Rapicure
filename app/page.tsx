"use client";

import React, { useState, useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import { IntakeKiosk } from "@/components/IntakeKiosk";
import { DoctorCockpit } from "@/components/DoctorCockpit";
import { PrintableSlip } from "@/components/PrintableSlip";
import { ApiKeyModal } from "@/components/ApiKeyModal";
import { PatientInfo, VitalsData, TriageResult } from "@/lib/types";
import { DEMO_CASES } from "@/lib/demoData";
import { processClinicalTriageWithGemini } from "@/lib/gemini";

const INITIAL_PATIENT: PatientInfo = {
  name: "",
  age: "",
  gender: "Male",
  uhid: "",
  tokenNo: "OPD-042",
};

const INITIAL_VITALS: VitalsData = {
  bpSystolic: "",
  bpDiastolic: "",
  pulse: "",
  temp: "",
  spo2: "",
};

export default function Home() {
  const [apiKey, setApiKey] = useState<string>("");
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [patientInfo, setPatientInfo] = useState<PatientInfo>(INITIAL_PATIENT);
  const [vitals, setVitals] = useState<VitalsData>(INITIAL_VITALS);
  const [narrativeText, setNarrativeText] = useState<string>("");
  const [labImageBase64, setLabImageBase64] = useState<string | null>(null);

  const [triageResult, setTriageResult] = useState<TriageResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStepText, setLoadingStepText] = useState<string>("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Load API Key from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedKey = localStorage.getItem("medassist_gemini_api_key");
      if (savedKey) {
        setApiKey(savedKey);
      }
    }
  }, []);

  const handleSaveApiKey = (key: string) => {
    setApiKey(key);
    if (typeof window !== "undefined") {
      localStorage.setItem("medassist_gemini_api_key", key);
    }
    showToast(key ? "Gemini API key saved!" : "API key cleared");
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // 1-Click Failsafe Dengue Demo Case
  const handleLoadDengueDemo = async () => {
    const demo = DEMO_CASES[0]; // Dengue Warning Signs
    setPatientInfo(demo.patientInfo);
    setVitals(demo.vitals);
    setNarrativeText(demo.narrative);
    setLabImageBase64(null);

    showToast("⚡ Loaded realistic Dengue Emergency Demo Case!");

    // Automatically trigger analysis for seamless 1-click stage demo
    setIsLoading(true);
    setLoadingStepText("Ingesting Hindi voice transcript & tachycardia vitals...");

    setTimeout(() => {
      setLoadingStepText("Synthesizing clinical SOAP & red flags with Gemini 2.0 Flash...");
    }, 600);

    try {
      const response = await processClinicalTriageWithGemini({
        apiKey,
        narrativeText: demo.narrative,
        vitals: demo.vitals,
        patientInfo: demo.patientInfo,
        useFailsafeFallback: true,
      });

      setTriageResult({
        ...response,
        patientInfo: demo.patientInfo,
        vitals: demo.vitals,
        narrativeText: demo.narrative,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      console.error(err);
      // Failsafe fallback
      setTriageResult({
        ...demo.simulatedResponse,
        patientInfo: demo.patientInfo,
        vitals: demo.vitals,
        narrativeText: demo.narrative,
        timestamp: new Date().toISOString(),
      });
    } finally {
      setIsLoading(false);
      setLoadingStepText("");
    }
  };

  // Reset for next patient
  const handleReset = () => {
    setPatientInfo({
      ...INITIAL_PATIENT,
      tokenNo: `OPD-${Math.floor(10 + Math.random() * 90)}`,
    });
    setVitals(INITIAL_VITALS);
    setNarrativeText("");
    setLabImageBase64(null);
    setTriageResult(null);
    showToast("Ready for next patient intake.");
  };

  // Process Triage via Gemini 2.0 Flash
  const handleProcessTriage = async () => {
    if (!narrativeText && !labImageBase64) {
      alert("Please provide patient complaint (voice or text) or attach a lab report.");
      return;
    }

    setIsLoading(true);
    setLoadingStepText("Multimodal ingestion of voice transcript, vitals & lab data...");

    setTimeout(() => {
      setLoadingStepText("Gemini 2.0 Flash is generating clinical SOAP & triage score...");
    }, 700);

    try {
      const response = await processClinicalTriageWithGemini({
        apiKey,
        narrativeText,
        vitals,
        patientInfo,
        labImageBase64,
        useFailsafeFallback: true,
      });

      setTriageResult({
        ...response,
        patientInfo,
        vitals,
        narrativeText,
        labImagePreview: labImageBase64,
        timestamp: new Date().toISOString(),
      });

      showToast(`Triage analysis completed: Priority ${response.priority}`);
    } catch (error: any) {
      console.error("Triage synthesis failed:", error);
      alert(error.message || "Failed to analyze triage. Please check your Gemini API key.");
    } finally {
      setIsLoading(false);
      setLoadingStepText("");
    }
  };

  const handleTriggerPrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      {/* Top Navigation */}
      <Navbar
        onLoadDengueDemo={handleLoadDengueDemo}
        onReset={handleReset}
        onOpenApiKeyModal={() => setIsApiKeyModalOpen(true)}
        hasApiKey={!!apiKey}
        isLoading={isLoading}
      />

      {/* Main Dual-Column Split Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Subtle hospital context alert bar */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-2 p-2.5 px-4 rounded-xl bg-gradient-to-r from-teal-950/40 via-slate-900/60 to-slate-900/40 border border-teal-500/20 text-xs">
          <div className="flex items-center gap-2 text-teal-300 font-medium">
            <span className="flex h-2 w-2 rounded-full bg-teal-400" />
            <span>AIIMS Jodhpur Pre-OPD Triage Hub</span>
            <span className="text-slate-600">•</span>
            <span className="text-slate-400">
              Hindi Voice Transcription + 4 Vitals + Multimodal Lab Report Synthesis
            </span>
          </div>
          <span className="text-[11px] text-slate-500 font-mono">Model: gemini-2.0-flash</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Intake Kiosk (5/12 cols) */}
          <div className="lg:col-span-6 xl:col-span-5">
            <IntakeKiosk
              patientInfo={patientInfo}
              onPatientInfoChange={setPatientInfo}
              vitals={vitals}
              onVitalsChange={setVitals}
              narrativeText={narrativeText}
              onNarrativeChange={setNarrativeText}
              labImageBase64={labImageBase64}
              onLabImageChange={setLabImageBase64}
              onProcessTriage={handleProcessTriage}
              isLoading={isLoading}
              loadingStepText={loadingStepText}
            />
          </div>

          {/* Right Column: Doctor Cockpit (7/12 cols) */}
          <div className="lg:col-span-6 xl:col-span-7">
            <DoctorCockpit
              triageResult={triageResult}
              onTriggerPrint={handleTriggerPrint}
              isLoading={isLoading}
            />
          </div>
        </div>
      </main>

      {/* Footer info */}
      <footer className="no-print border-t border-slate-900 py-4 text-center text-xs text-slate-600">
        <p>
          MedAssist AI • Developed for AAYU 2026 AI Medical Innovation Hackathon (DHR, MoHFW, Google for Developers)
        </p>
      </footer>

      {/* API Key Modal */}
      <ApiKeyModal
        isOpen={isApiKeyModalOpen}
        onClose={() => setIsApiKeyModalOpen(false)}
        apiKey={apiKey}
        onSaveKey={handleSaveApiKey}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 border border-teal-500/50 text-teal-300 text-xs font-medium px-4 py-2.5 rounded-xl shadow-2xl animate-in slide-in-from-bottom-3 duration-200">
          {toastMessage}
        </div>
      )}

      {/* Hidden Print Slip */}
      <PrintableSlip triageResult={triageResult} />
    </div>
  );
}

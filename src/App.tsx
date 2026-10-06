import React, { useState } from 'react';
import { Header } from './components/Header';
import { VoiceIntakeCard } from './components/VoiceIntakeCard';
import { VitalsCard } from './components/VitalsCard';
import { LabReportUploadCard } from './components/LabReportUploadCard';
import { DoctorCockpit } from './components/DoctorCockpit';
import { PrintSlip } from './components/PrintSlip';
import {
  TriageVitals,
  PatientInfo,
  AttachedImage,
  TriageResult,
  DemoCase
} from './types/triage';
import {
  DENGUE_DEMO_CASE,
  generateSampleCBCReportDataUrl
} from './data/demoCases';
import { Sparkles, ArrowRight, Loader2, AlertCircle, RefreshCw } from 'lucide-react';

export default function App() {
  // Patient & Intake State
  const [symptoms, setSymptoms] = useState('');
  const [language, setLanguage] = useState<'hi-IN' | 'en-IN'>('hi-IN');
  const [vitals, setVitals] = useState<TriageVitals>({
    bp: '120/80',
    pulse: '78',
    temp: '98.6',
    spo2: '98'
  });
  const [patientInfo, setPatientInfo] = useState<PatientInfo>({
    token: 'A-104',
    name: 'Ramesh Sharma',
    age: '34',
    gender: 'Male',
    queueTime: '10:14 AM'
  });
  const [attachedImage, setAttachedImage] = useState<AttachedImage | null>(null);

  // Decision Console State
  const [result, setResult] = useState<TriageResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load Interactive Demo Simulation Data (Requested in spec)
  const handleLoadDemoCase = (demo: DemoCase) => {
    setSymptoms(demo.symptoms);
    setLanguage(demo.language);
    setVitals(demo.vitals);
    setPatientInfo(demo.patientInfo);

    if (demo.hasSampleReport) {
      const reportUrl = generateSampleCBCReportDataUrl();
      setAttachedImage({
        data: reportUrl,
        mimeType: 'image/svg+xml',
        name: demo.sampleReportName || 'AIIMS_CBC_Report.png',
        previewUrl: reportUrl,
        sizeKb: 42
      });
    } else {
      setAttachedImage(null);
    }

    // Auto-trigger synthesis or scroll focus
    setError(null);
  };

  // Primary CTA: Generate Doctor Briefing Note (AI)
  const handleGenerateTriage = async () => {
    if (!symptoms.trim() && !vitals.bp && !vitals.pulse) {
      setError('Please provide patient symptoms via voice/text or enter nursing vitals.');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch('/api/triage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          symptoms,
          language,
          vitals,
          patientInfo,
          image: attachedImage
            ? {
                data: attachedImage.data,
                mimeType: attachedImage.mimeType,
                name: attachedImage.name
              }
            : null
        })
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setResult(data);
    } catch (err: any) {
      console.error('Triage synthesis error:', err);
      setError(
        err.message || 'Failed to synthesize triage briefing. Please check connection and try again.'
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleReset = () => {
    setSymptoms('');
    setVitals({
      bp: '120/80',
      pulse: '78',
      temp: '98.6',
      spo2: '98'
    });
    setAttachedImage(null);
    setResult(null);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Top Header Bar */}
      <Header
        onLoadDemoCase={handleLoadDemoCase}
        onPrint={handlePrint}
        isGenerating={isGenerating}
      />

      {/* Main Workspace: Two-Column Split (45% / 55% on desktop, stacked on mobile) */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 no-print">
        
        {/* Banner Alert if error */}
        {error && (
          <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm flex items-start justify-between gap-3 shadow-2xs">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={() => setError(null)}
              className="text-xs font-semibold text-rose-600 hover:text-rose-900"
            >
              Dismiss
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-10 gap-6 items-start">
          
          {/* LEFT COLUMN: Patient & Assistant Kiosk (Intake Console) - 45% (4.5 / 10 cols) */}
          <section className="lg:col-span-5 space-y-5">
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-600"></span>
                <h2 className="font-heading font-extrabold text-base text-slate-900">
                  Patient &amp; Assistant Kiosk
                </h2>
                <span className="text-xs text-slate-400 font-medium">(Intake Console)</span>
              </div>

              <button
                type="button"
                onClick={handleReset}
                className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 transition-colors cursor-pointer"
                title="Reset intake form"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Reset
              </button>
            </div>

            {/* Card 1: Patient Voice Intake */}
            <VoiceIntakeCard
              symptoms={symptoms}
              onSymptomsChange={setSymptoms}
              language={language}
              onLanguageChange={setLanguage}
            />

            {/* Card 2: Assistant Triage Vitals (Nurse Station) */}
            <VitalsCard
              vitals={vitals}
              onVitalsChange={setVitals}
              patientInfo={patientInfo}
              onPatientInfoChange={setPatientInfo}
            />

            {/* Card 3: Lab Report & CBC Image Attachment */}
            <LabReportUploadCard
              attachedImage={attachedImage}
              onAttachImage={setAttachedImage}
            />

            {/* Primary CTA: Generate Doctor Briefing Note (AI) */}
            <div className="pt-1">
              <button
                type="button"
                onClick={handleGenerateTriage}
                disabled={isGenerating}
                className="w-full py-3.5 px-6 rounded-xl font-heading font-bold text-sm sm:text-base text-white bg-sky-600 hover:bg-sky-700 active:scale-[0.99] shadow-md shadow-sky-600/25 transition-all flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Synthesizing SOAP Briefing with Gemini 2.0...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 fill-white/20" />
                    <span>Generate Doctor Briefing Note (AI)</span>
                    <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                  </>
                )}
              </button>
              <p className="text-center text-[11px] text-slate-400 mt-2 font-medium">
                Structured clinical synthesis with immediate life-threatening red flags
              </p>
            </div>

          </section>

          {/* RIGHT COLUMN: Doctor's Clinical Cockpit (Decision Console) - 55% (5.5 / 10 cols) */}
          <section className="lg:col-span-5 space-y-5">
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
                <h2 className="font-heading font-extrabold text-base text-slate-900">
                  Doctor's Clinical Cockpit
                </h2>
                <span className="text-xs text-slate-400 font-medium">(Decision Console)</span>
              </div>

              {result && (
                <span className="text-[11px] text-slate-500 font-mono-num">
                  Source: {result.source || 'Gemini 2.0 Flash'}
                </span>
              )}
            </div>

            {/* Doctor Cockpit Card / Empty State */}
            <DoctorCockpit
              result={result}
              patientInfo={patientInfo}
              vitals={vitals}
              isGenerating={isGenerating}
              onLoadDengueDemo={() => handleLoadDemoCase(DENGUE_DEMO_CASE)}
              onPrint={handlePrint}
            />

          </section>

        </div>
      </main>

      {/* Hospital Consultation Print Slip (Rendered only on window.print()) */}
      <PrintSlip
        result={result}
        patientInfo={patientInfo}
        vitals={vitals}
        symptoms={symptoms}
        attachedImage={attachedImage}
      />

      {/* Minimal Footer */}
      <footer className="mt-auto py-4 border-t border-slate-200/80 bg-white text-center text-xs text-slate-500 no-print">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="font-medium text-slate-600">
            MedAssist AI • Built for AAYU 2026 AI Medical Innovation Hackathon
          </div>
          <div className="text-slate-400 text-[11px]">
            AIIMS &amp; Dr. S.N. Medical College Jodhpur Triage Architecture • MOHFW/DHR Guidelines
          </div>
        </div>
      </footer>
    </div>
  );
}

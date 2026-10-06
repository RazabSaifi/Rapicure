import React, { useState } from 'react';
import { Mic, MicOff, Volume2, Sparkles, X, Languages, AlertCircle } from 'lucide-react';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';

interface VoiceIntakeCardProps {
  symptoms: string;
  onSymptomsChange: (text: string) => void;
  language: 'hi-IN' | 'en-IN';
  onLanguageChange: (lang: 'hi-IN' | 'en-IN') => void;
}

const COMMON_CHIPS = {
  'hi-IN': [
    { label: '🔥 3 दिन से तेज़ बुखार (102°)', text: 'पिछले 3 दिन से लगातार 102° तेज़ बुखार आ रहा है।' },
    { label: '👁️ आंखों के पीछे दर्द', text: 'आंखों के पीछे बहुत तेज़ खिंचाव और सिरदर्द है।' },
    { label: '🔴 हाथ-पैरों पर लाल चकत्ते (Petechiae)', text: 'हाथ और पैरों की त्वचा पर बारीक लाल चकत्ते और दाने निकल आए हैं।' },
    { label: '💔 सीने में भारीपन व पसीना', text: 'सीने के बीच में भारी दबाव महसूस हो रहा है और ठंडा पसीना आ रहा है।' },
    { label: '🫁 सांस फूलना (Dyspnea)', text: 'चलने-फिरने में बहुत तेज़ सांस फूल रही है और घबराहट हो रही है।' }
  ],
  'en-IN': [
    { label: '🔥 High Grade Continuous Fever', text: 'High grade fever continuously for past 3 days with chills.' },
    { label: '👁️ Retro-orbital Headache', text: 'Severe pain behind eyes and pounding frontal headache.' },
    { label: '🔴 Petechial Rash on Limbs', text: 'Fine reddish petechial rash observed across upper and lower limbs.' },
    { label: '💔 Crushing Retrosternal Pain', text: 'Severe crushing chest pain radiating to left shoulder and arm.' },
    { label: '🫁 Acute Breathlessness', text: 'Severe difficulty in breathing and chest tightness on exertion.' }
  ]
};

export const VoiceIntakeCard: React.FC<VoiceIntakeCardProps> = ({
  symptoms,
  onSymptomsChange,
  language,
  onLanguageChange
}) => {
  const {
    isListening,
    interimTranscript,
    isSupported,
    error: speechError,
    toggleListening
  } = useSpeechRecognition(language);

  // Sync internal recognition transcript with parent symptoms
  const handleMicToggle = () => {
    toggleListening();
  };

  const handleAddChip = (chipText: string) => {
    if (!symptoms) {
      onSymptomsChange(chipText);
    } else {
      onSymptomsChange(`${symptoms.trim()} ${chipText}`);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden transition-all duration-200 hover:border-slate-300">
      {/* Card Header with Bilingual Toggle */}
      <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-slate-50/80 to-white">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center font-bold text-xs border border-sky-100">
            01
          </div>
          <div>
            <h3 className="font-heading font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
              Patient Voice Intake
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-normal">
                Vernacular Kiosk
              </span>
            </h3>
            <p className="text-xs text-slate-500">
              Speak or record patient complaints in patient's mother tongue
            </p>
          </div>
        </div>

        {/* Language Selection Toggle Pill */}
        <div className="inline-flex p-1 bg-slate-100/90 rounded-lg border border-slate-200 text-xs font-semibold">
          <button
            type="button"
            onClick={() => onLanguageChange('hi-IN')}
            className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
              language === 'hi-IN'
                ? 'bg-white text-sky-700 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            हिंदी (hi-IN)
          </button>
          <button
            type="button"
            onClick={() => onLanguageChange('en-IN')}
            className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
              language === 'en-IN'
                ? 'bg-white text-sky-700 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            English (en-IN)
          </button>
        </div>
      </div>

      {/* Card Body */}
      <div className="p-5 space-y-4">
        {/* Prominent Voice Capture Bar */}
        <div
          className={`relative rounded-xl p-4 border transition-all ${
            isListening
              ? 'bg-rose-50/70 border-rose-300 shadow-xs ring-2 ring-rose-400/20'
              : 'bg-slate-50/70 border-slate-200/80'
          }`}
        >
          <div className="flex flex-col sm:flex-row items-center gap-4">
            {/* Pulsing Mic Action Button */}
            <button
              type="button"
              onClick={handleMicToggle}
              className={`relative shrink-0 w-16 h-16 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                isListening
                  ? 'bg-rose-600 text-white animate-mic-pulse shadow-md shadow-rose-500/30 ring-4 ring-rose-200'
                  : 'bg-sky-600 hover:bg-sky-700 text-white shadow-sm hover:shadow'
              }`}
              title={isListening ? 'Stop Recording' : 'Start Speech Recording'}
            >
              {isListening ? (
                <MicOff className="w-7 h-7 stroke-[2.2]" />
              ) : (
                <Mic className="w-7 h-7 stroke-[2.2]" />
              )}
            </button>

            {/* Voice Status & Live Wave */}
            <div className="flex-1 text-center sm:text-left space-y-1">
              <div className="flex items-center justify-center sm:justify-start gap-2">
                <span
                  className={`w-2 h-2 rounded-full ${
                    isListening ? 'bg-rose-500 animate-ping' : 'bg-slate-400'
                  }`}
                />
                <span className="font-semibold text-xs sm:text-sm text-slate-800">
                  {isListening
                    ? language === 'hi-IN'
                      ? 'मरीज की आवाज सुनी जा रही है... बोलिए (Listening in Hindi)'
                      : 'Listening to patient narrative in Indian English...'
                    : language === 'hi-IN'
                    ? 'Tap mic to speak symptoms / बोलकर बताएं'
                    : 'Tap mic to dictate patient symptoms in English'}
                </span>
              </div>

              <p className="text-xs text-slate-500">
                {isListening
                  ? 'Voice is being automatically converted to text below...'
                  : 'Browser-native Web Speech API with zero audio latency.'}
              </p>

              {/* Audio Wave Visualizer Simulation when listening */}
              {isListening && (
                <div className="flex items-center justify-center sm:justify-start gap-1 pt-1">
                  {[40, 75, 100, 60, 90, 45, 80, 50, 95, 30].map((h, i) => (
                    <span
                      key={i}
                      className="w-1 bg-rose-500 rounded-full animate-pulse"
                      style={{
                        height: `${h * 0.22}px`,
                        animationDelay: `${i * 120}ms`
                      }}
                    />
                  ))}
                  <span className="text-[11px] font-mono text-rose-600 ml-2 font-medium">
                    REC: {language}
                  </span>
                </div>
              )}
            </div>

            {/* Clear Input Button */}
            {symptoms && (
              <button
                type="button"
                onClick={() => onSymptomsChange('')}
                className="shrink-0 text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer flex items-center gap-1"
                title="Clear transcript"
              >
                <X className="w-3.5 h-3.5" />
                Clear
              </button>
            )}
          </div>

          {speechError && (
            <div className="mt-3 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>{speechError}</span>
            </div>
          )}
        </div>

        {/* Live Transcript Textarea */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <label htmlFor="symptoms-input" className="font-medium text-slate-700">
              Chief Complaint Transcript (मरीज के मुख्य लक्षण):
            </label>
            <span className="text-[11px] text-slate-400">
              {symptoms.length} characters • Editable
            </span>
          </div>

          <div className="relative">
            <textarea
              id="symptoms-input"
              rows={3}
              value={symptoms}
              onChange={(e) => onSymptomsChange(e.target.value)}
              placeholder={
                language === 'hi-IN'
                  ? 'माइक दबाकर मरीज के लक्षण बोलें या यहाँ लिखें (जैसे: पिछले 3 दिनों से लगातार 102° बुखार है, उल्टी का मन है...)'
                  : 'Click mic to dictate or type symptoms (e.g. 3 days of high continuous fever, retro-orbital pain, nausea...)'
              }
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all resize-y placeholder:text-slate-400 font-sans leading-relaxed shadow-2xs"
            />
            {interimTranscript && (
              <div className="absolute bottom-2 left-3 right-3 text-xs italic text-rose-600 bg-rose-50/90 px-2 py-0.5 rounded border border-rose-200/60 truncate">
                Speaking: {interimTranscript}
              </div>
            )}
          </div>
        </div>

        {/* Quick Symptom Chips Strip */}
        <div className="space-y-1.5 pt-1">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>Quick Triage Phrases ({language === 'hi-IN' ? 'त्वरित लक्षण' : 'Clinical Chips'}):</span>
            <span className="text-[10px] font-normal text-slate-400 lowercase">click to append</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {COMMON_CHIPS[language].map((chip, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleAddChip(chip.text)}
                className="text-xs px-2.5 py-1 rounded-full bg-slate-50 hover:bg-sky-50 text-slate-700 hover:text-sky-700 border border-slate-200/80 hover:border-sky-200 transition-colors cursor-pointer text-left font-medium"
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

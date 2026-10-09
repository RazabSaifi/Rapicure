"use client";

import React, { useState, useEffect } from "react";
import { KeyRound, Check, X, Sparkles, ExternalLink, Volume2, Bot } from "lucide-react";

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiKey: string;
  onSaveKey: (key: string) => void;
  elevenLabsApiKey?: string;
  onSaveElevenLabsKey?: (key: string) => void;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({
  isOpen,
  onClose,
  apiKey,
  onSaveKey,
  elevenLabsApiKey = "",
  onSaveElevenLabsKey,
}) => {
  const [inputGeminiKey, setInputGeminiKey] = useState(apiKey);
  const [inputElevenKey, setInputElevenKey] = useState(elevenLabsApiKey);
  const [showGemini, setShowGemini] = useState(false);
  const [showEleven, setShowEleven] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    setInputGeminiKey(apiKey);
    setInputElevenKey(elevenLabsApiKey);
  }, [apiKey, elevenLabsApiKey]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSaveKey(inputGeminiKey.trim());
    if (onSaveElevenLabsKey) {
      onSaveElevenLabsKey(inputElevenKey.trim());
    }
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 800);
  };

  const handleClear = () => {
    setInputGeminiKey("");
    setInputElevenKey("");
    onSaveKey("");
    if (onSaveElevenLabsKey) onSaveElevenLabsKey("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-400">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">AI Engine & Voice Keys</h3>
              <p className="text-xs text-slate-400">Power Gemini 2.0 Brain & ElevenLabs Voice</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Key 1: Gemini 2.0 Flash (Brain) */}
          <div className="space-y-2 p-3.5 rounded-xl bg-slate-950/70 border border-slate-800">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-teal-300 flex items-center gap-1.5">
                <Bot className="w-4 h-4 text-teal-400" />
                <span>1. Gemini API Key (Clinical Brain - Free)</span>
              </label>
              <button
                type="button"
                onClick={() => setShowGemini(!showGemini)}
                className="text-[11px] text-teal-400 hover:underline"
              >
                {showGemini ? "Hide" : "Show"}
              </button>
            </div>
            <input
              type={showGemini ? "text" : "password"}
              value={inputGeminiKey}
              onChange={(e) => setInputGeminiKey(e.target.value)}
              placeholder="AIzaSy... (Free key for live dynamic medical dialogue)"
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-lg text-xs text-white placeholder-slate-500 font-mono"
            />
            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
              <span>Required for dynamic medical questions tailored to your exact symptom.</span>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="text-teal-400 hover:underline inline-flex items-center gap-0.5"
              >
                Get Free Key <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
          </div>

          {/* Key 2: ElevenLabs (Voice Quality) */}
          <div className="space-y-2 p-3.5 rounded-xl bg-slate-950/70 border border-slate-800">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                <Volume2 className="w-4 h-4 text-purple-400" />
                <span>2. ElevenLabs API Key (Ultra-Human Voice - Optional)</span>
              </label>
              <button
                type="button"
                onClick={() => setShowEleven(!showEleven)}
                className="text-[11px] text-purple-400 hover:underline"
              >
                {showEleven ? "Hide" : "Show"}
              </button>
            </div>
            <input
              type={showEleven ? "text" : "password"}
              value={inputElevenKey}
              onChange={(e) => setInputElevenKey(e.target.value)}
              placeholder="sk_... (Optional: Gives cinema-quality human Hindi/English voice)"
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 rounded-lg text-xs text-white placeholder-slate-500 font-mono"
            />
            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
              <span>Makes AI sound 100% human (breathing, warmth, zero robotic feel).</span>
              <a
                href="https://elevenlabs.io"
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-400 hover:underline inline-flex items-center gap-0.5"
              >
                Free ElevenLabs Key <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
          </div>

          <div className="rounded-xl bg-slate-950/40 border border-slate-800 p-3 text-xs text-slate-400 space-y-1">
            <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Smart Medical Assistant Always Active</span>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-400">
              Keys are stored securely in your browser&apos;s localStorage and sent only to official Google and ElevenLabs endpoints.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/50 flex items-center justify-between gap-3">
          {inputGeminiKey || inputElevenKey ? (
            <button
              onClick={handleClear}
              className="text-xs text-rose-400 hover:text-rose-300 font-medium px-2 py-1"
            >
              Clear All Keys
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className={`px-4 py-2 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5 shadow-lg ${
                savedSuccess
                  ? "bg-emerald-600 text-white"
                  : "bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-bold"
              }`}
            >
              {savedSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5" /> Saved!
                </>
              ) : (
                "Save Keys"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

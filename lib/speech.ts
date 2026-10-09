/**
 * Native Web Speech API helpers for Speech Recognition (STT) and Synthesis (TTS).
 * Includes explicit getUserMedia permission triggering and robust lifecycle handling.
 */

interface IWindow extends Window {
  webkitSpeechRecognition?: any;
  SpeechRecognition?: any;
  _activeUtterance?: SpeechSynthesisUtterance | null;
}

/**
 * Explicitly requests browser microphone permission via getUserMedia.
 * This GUARANTEES the browser's native permission popup appears on Chrome/Edge/Firefox.
 */
export async function requestMicrophonePermission(): Promise<{
  granted: boolean;
  error?: string;
}> {
  if (typeof window === "undefined") {
    return { granted: false, error: "Window is not defined" };
  }

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    return {
      granted: false,
      error: "Microphone access is not supported in this browser. Please use Google Chrome or Microsoft Edge.",
    };
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // Permission granted! Stop all temporary tracks immediately to release the hardware
    stream.getTracks().forEach((track) => track.stop());
    return { granted: true };
  } catch (err: any) {
    console.warn("Microphone permission error:", err);
    let message = "Microphone permission was denied.";
    if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
      message = "Microphone access is blocked. Please click the lock or settings icon in your browser URL bar to allow microphone access.";
    } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
      message = "No microphone hardware detected on your computer. Please connect a microphone.";
    } else if (err.name === "NotReadableError") {
      message = "Microphone is already in use by another application.";
    }
    return { granted: false, error: message };
  }
}

export class SpeechInputService {
  private recognition: any = null;
  private isListening: boolean = false;
  private shouldKeepListening: boolean = false;
  private onResultCallback: ((transcript: string, isFinal: boolean) => void) | null = null;
  private onErrorCallback: ((error: string) => void) | null = null;
  private onEndCallback: (() => void) | null = null;
  private currentLang: "hi-IN" | "en-IN" = "hi-IN";

  constructor() {
    this.initRecognition();
  }

  private initRecognition() {
    if (typeof window !== "undefined") {
      const win = window as unknown as IWindow;
      const SpeechRecognitionClass = win.SpeechRecognition || win.webkitSpeechRecognition;

      if (SpeechRecognitionClass) {
        try {
          this.recognition = new SpeechRecognitionClass();
          this.recognition.continuous = true;
          this.recognition.interimResults = true;
          this.recognition.maxAlternatives = 1;
          this.recognition.lang = this.currentLang;

          this.recognition.onresult = (event: any) => {
            let interimTranscript = "";
            let finalTranscript = "";

            for (let i = event.resultIndex; i < event.results.length; ++i) {
              const res = event.results[i];
              if (res.isFinal) {
                finalTranscript += res[0].transcript;
              } else {
                interimTranscript += res[0].transcript;
              }
            }

            if (this.onResultCallback) {
              const textToSend = finalTranscript || interimTranscript;
              this.onResultCallback(textToSend, !!finalTranscript);
            }
          };

          this.recognition.onerror = (event: any) => {
            console.warn("Speech recognition error event:", event.error);
            // Ignore trivial no-speech events when continuous listening
            if (event.error === "no-speech") {
              return;
            }

            let userFriendlyError = event.error;
            if (event.error === "not-allowed") {
              userFriendlyError =
                "Microphone blocked. Please allow microphone in the browser address bar.";
            } else if (event.error === "network") {
              userFriendlyError =
                "Network error connecting to speech recognition service. Please check internet connection.";
            }

            if (this.onErrorCallback) {
              this.onErrorCallback(userFriendlyError);
            }
            this.isListening = false;
            this.shouldKeepListening = false;
          };

          this.recognition.onend = () => {
            // If user did not explicitly stop and continuous listening is enabled, auto-restart
            if (this.shouldKeepListening) {
              try {
                this.recognition.start();
                this.isListening = true;
                return;
              } catch (e) {
                // Ignore start collision
              }
            }

            this.isListening = false;
            if (this.onEndCallback) {
              this.onEndCallback();
            }
          };
        } catch (e) {
          console.error("Failed to construct SpeechRecognition:", e);
        }
      }
    }
  }

  public isSupported(): boolean {
    if (typeof window === "undefined") return false;
    const win = window as unknown as IWindow;
    return !!(win.SpeechRecognition || win.webkitSpeechRecognition);
  }

  public async start(
    lang: "hi-IN" | "en-IN" = "hi-IN",
    onResult: (transcript: string, isFinal: boolean) => void,
    onError?: (error: string) => void,
    onEnd?: () => void
  ): Promise<boolean> {
    if (!this.isSupported()) {
      if (onError) onError("Your browser does not support Speech Recognition. Please use Google Chrome or Edge.");
      return false;
    }

    // First ensure mic permission popup is triggered and granted!
    const perm = await requestMicrophonePermission();
    if (!perm.granted) {
      if (onError) onError(perm.error || "Microphone permission required.");
      return false;
    }

    this.currentLang = lang;
    this.shouldKeepListening = true;
    this.onResultCallback = onResult;
    this.onErrorCallback = onError || null;
    this.onEndCallback = onEnd || null;
    this.currentLang = lang;
    this.shouldKeepListening = true;

    if (!this.recognition) {
      this.initRecognition();
    }

    try {
      this.recognition.lang = lang;
      this.recognition.start();
      this.isListening = true;
      return true;
    } catch (e: any) {
      if (e.name === "InvalidStateError") {
        // Recognition already running, restart safely
        try {
          this.recognition.stop();
          setTimeout(() => {
            this.recognition.start();
            this.isListening = true;
          }, 150);
          return true;
        } catch (inner) {
          console.warn("Could not restart running recognition:", inner);
        }
      }
      console.warn("Could not start speech recognition:", e);
      if (onError) onError(e.message || "Failed to start microphone");
      return false;
    }
  }

  public stop() {
    this.shouldKeepListening = false;
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch {
        // ignore
      }
    }
    this.isListening = false;
  }

  public getIsListening(): boolean {
    return this.isListening;
  }
}

/**
 * Text to Speech (SpeechSynthesis & Native Audio) Helper
 * - Tier 1: Plays real, expressive Gemini AI human voice audio (Aoede/Charon/Puck)
 * - Tier 2: Neural/Natural high-definition browser voices (Microsoft Online Natural / Google)
 */
export class SpeechOutputService {
  private currentAudioElement: HTMLAudioElement | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private endTimeout: any = null;
  private voices: SpeechSynthesisVoice[] = [];

  constructor() {
    this.initVoices();
  }

  private initVoices() {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      this.voices = window.speechSynthesis.getVoices();
      if (!this.voices.length) {
        window.speechSynthesis.onvoiceschanged = () => {
          this.voices = window.speechSynthesis.getVoices();
        };
      }
    }
  }

  public getAvailableVoices(): SpeechSynthesisVoice[] {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      const v = window.speechSynthesis.getVoices();
      if (v.length > 0) {
        this.voices = v;
      }
    }
    return this.voices;
  }

  /**
   * Scores all available voices to pick natural, human neural voices
   * and completely avoids robotic 90s desktop voices (e.g. Microsoft David Desktop).
   */
  public findBestVoice(lang: "hi-IN" | "en-IN" | "en-US" | string): {
    voice: SpeechSynthesisVoice | null;
    isNativeHindi: boolean;
  } {
    const allVoices = this.getAvailableVoices();
    const isHi = lang.startsWith("hi");

    if (allVoices.length === 0) {
      return { voice: null, isNativeHindi: false };
    }

    const scored = [...allVoices].map((v) => {
      let score = 0;
      const name = v.name.toLowerCase();
      const voiceLang = v.lang.toLowerCase();

      if (isHi) {
        if (voiceLang.startsWith("hi") || name.includes("hindi")) score += 120;
        if (voiceLang.includes("in") || name.includes("india")) score += 40;
      } else {
        if (voiceLang.includes("en-in") || name.includes("india")) score += 90;
        if (voiceLang.startsWith("en")) score += 50;
      }

      // Prioritize modern online neural voices (warm, human, fluid)
      if (name.includes("natural") || name.includes("online") || name.includes("neural")) score += 60;
      if (name.includes("google")) score += 45;
      if (name.includes("swara") || name.includes("madhur") || name.includes("neerja") || name.includes("kavya")) score += 35;

      // Penalize legacy mechanical robot desktop voices
      if (name.includes("desktop") || name.includes("david") || name.includes("mark")) score -= 80;

      return { voice: v, score };
    });

    scored.sort((a, b) => b.score - a.score);
    const best = scored[0]?.voice || allVoices[0];
    const isNativeHindi =
      best.lang.toLowerCase().startsWith("hi") || best.name.toLowerCase().includes("hindi");

    return { voice: best, isNativeHindi };
  }

  public isSupported(): boolean {
    return typeof window !== "undefined";
  }

  /**
   * Plays native audio bytes directly from Gemini 2.0 Flash
   */
  public playNativeGeminiAudio(
    audioDataUrl: string,
    options?: {
      onStart?: () => void;
      onEnd?: () => void;
      onError?: (err: any) => void;
    }
  ) {
    this.stop();

    try {
      const audio = new Audio(audioDataUrl);
      this.currentAudioElement = audio;

      audio.onplay = () => {
        if (options?.onStart) options.onStart();
      };

      audio.onended = () => {
        this.currentAudioElement = null;
        if (options?.onEnd) options.onEnd();
      };

      audio.onerror = (e) => {
        console.warn("Native audio play error, falling back to TTS:", e);
        this.currentAudioElement = null;
        if (options?.onError) options.onError(e);
      };

      const promise = audio.play();
      if (promise !== undefined) {
        promise.catch((err) => {
          console.warn("Audio autoplay blocked by browser policy:", err);
          this.currentAudioElement = null;
          if (options?.onError) options.onError(err);
        });
      }
    } catch (e) {
      console.error("Audio constructor error:", e);
      if (options?.onError) options.onError(e);
    }
  }

  /**
   * Speaks using either Real Gemini Voice Audio (Tier 1) or Natural Neural TTS (Tier 2)
   */
  public speak(
    text: string,
    options?: {
      rate?: number;
      pitch?: number;
      lang?: string;
      spokenRomajiFallback?: string;
      audioBase64?: string | null;
      onStart?: () => void;
      onEnd?: () => void;
      onError?: (err: any) => void;
    }
  ) {
    this.stop();

    // 1. TIER 1: Play Real Human Gemini Voice Audio if returned by Gemini 2.0
    if (options?.audioBase64) {
      this.playNativeGeminiAudio(options.audioBase64, {
        onStart: options.onStart,
        onEnd: options.onEnd,
        onError: () => {
          // Fallback to Tier 2 neural voice if audio element playback failed
          this.speakSynthesis(text, options);
        },
      });
      return;
    }

    // 2. TIER 2: Neural/Natural Browser Speech Synthesis
    this.speakSynthesis(text, options);
  }

  private speakSynthesis(
    text: string,
    options?: {
      rate?: number;
      pitch?: number;
      lang?: string;
      spokenRomajiFallback?: string;
      onStart?: () => void;
      onEnd?: () => void;
      onError?: (err: any) => void;
    }
  ) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      if (options?.onEnd) options.onEnd();
      return;
    }

    const win = window as unknown as IWindow;
    const requestedLang = options?.lang || "en-US";
    const { voice, isNativeHindi } = this.findBestVoice(requestedLang);

    let textToSpeak = text;
    if (requestedLang === "hi-IN" && !isNativeHindi && options?.spokenRomajiFallback) {
      textToSpeak = options.spokenRomajiFallback;
    }

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    } else {
      utterance.lang = requestedLang;
    }

    utterance.rate = options?.rate || (requestedLang === "hi-IN" ? 0.95 : 1.0);
    utterance.pitch = options?.pitch || 1.0;

    let hasEnded = false;
    const handleEnd = () => {
      if (hasEnded) return;
      hasEnded = true;
      if (this.endTimeout) clearTimeout(this.endTimeout);
      win._activeUtterance = null;
      this.currentUtterance = null;
      if (options?.onEnd) options.onEnd();
    };

    utterance.onstart = () => {
      if (options?.onStart) options.onStart();
    };

    utterance.onend = handleEnd;

    utterance.onerror = (e) => {
      console.warn("Speech synthesis error:", e);
      handleEnd();
      if (options?.onError) options.onError(e);
    };

    win._activeUtterance = utterance;
    this.currentUtterance = utterance;

    const wordCount = textToSpeak.split(/\s+/).length;
    const estimatedDuration = Math.max(3000, wordCount * 500 + 1500);
    this.endTimeout = setTimeout(() => {
      if (!hasEnded && window.speechSynthesis.speaking) {
        handleEnd();
      }
    }, estimatedDuration);

    try {
      window.speechSynthesis.resume();
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.error("Speech synthesis speak error:", err);
      handleEnd();
    }
  }

  public stop() {
    if (this.currentAudioElement) {
      try {
        this.currentAudioElement.pause();
        this.currentAudioElement.currentTime = 0;
      } catch (e) {
        // ignore
      }
      this.currentAudioElement = null;
    }

    if (this.endTimeout) {
      clearTimeout(this.endTimeout);
      this.endTimeout = null;
    }

    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {
        // Ignore
      }
      this.currentUtterance = null;
      (window as any)._activeUtterance = null;
    }
  }

  public isSpeaking(): boolean {
    const isAudioPlaying = !!(
      this.currentAudioElement &&
      !this.currentAudioElement.paused &&
      !this.currentAudioElement.ended
    );
    const isSynthesisSpeaking =
      typeof window !== "undefined" &&
      "speechSynthesis" in window &&
      window.speechSynthesis.speaking;
    return isAudioPlaying || isSynthesisSpeaking;
  }
}

/**
 * Native Web Speech API helpers for Speech Recognition (STT) and Synthesis (TTS).
 * Full-Duplex Continuous Hands-Free Conversation (Gemini App Experience)
 */

interface IWindow extends Window {
  webkitSpeechRecognition?: any;
  SpeechRecognition?: any;
}

export class SpeechInputService {
  private recognition: any = null;
  private isListening: boolean = false;
  private shouldKeepListening: boolean = false;
  private silenceTimer: any = null;
  private currentTranscript: string = "";

  private onResultCallback: ((transcript: string, isFinal: boolean) => void) | null = null;
  private onErrorCallback: ((error: string) => void) | null = null;
  private onEndCallback: (() => void) | null = null;
  private currentLang: string = "hi-IN";

  constructor() {
    if (typeof window !== "undefined") {
      const win = window as unknown as IWindow;
      const SpeechRecognition = win.SpeechRecognition || win.webkitSpeechRecognition;
      if (SpeechRecognition) {
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = "hi-IN";

        this.recognition.onresult = (event: any) => {
          let interim = "";
          let final = "";

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            const piece = event.results[i][0]?.transcript || "";
            if (event.results[i].isFinal) {
              final += piece;
            } else {
              interim += piece;
            }
          }

          const combined = (final || interim).trim();

          if (final.trim().length > 1) {
            if (this.silenceTimer) clearTimeout(this.silenceTimer);
            this.silenceTimer = setTimeout(() => {
              const sentence = (final || combined).trim();
              this.currentTranscript = "";
              this.onResultCallback?.(sentence, true);
            }, 80);
          } else if (combined) {
            this.currentTranscript = combined;
            this.onResultCallback?.(combined, false);

            if (this.silenceTimer) clearTimeout(this.silenceTimer);
            this.silenceTimer = setTimeout(() => {
              if (this.currentTranscript.trim().length > 1) {
                const sentence = this.currentTranscript.trim();
                this.currentTranscript = "";
                this.onResultCallback?.(sentence, true);
              }
            }, 450);
          }
        };

        this.recognition.onerror = (event: any) => {
          if (event.error === "no-speech" || event.error === "aborted") {
            return;
          }
          console.warn("Speech recognition error:", event.error);
          this.onErrorCallback?.(event.error);
        };

        this.recognition.onend = () => {
          this.isListening = false;
          if (this.shouldKeepListening) {
            setTimeout(() => {
              if (this.shouldKeepListening && !this.isListening) {
                try {
                  this.recognition.lang = this.currentLang;
                  this.recognition.start();
                  this.isListening = true;
                } catch {
                  // already active
                }
              }
            }, 200);
          } else {
            this.onEndCallback?.();
          }
        };
      }
    }
  }

  public isSupported(): boolean {
    return this.recognition !== null;
  }

  public start(
    lang: "hi-IN" | "en-IN" = "hi-IN",
    onResult: (transcript: string, isFinal: boolean) => void,
    onError?: (error: string) => void,
    onEnd?: () => void
  ) {
    this.startContinuous(lang, onResult, onError, onEnd);
  }

  public startContinuous(
    lang: "hi-IN" | "en-IN" = "hi-IN",
    onResult: (transcript: string, isFinal: boolean) => void,
    onError?: (error: string) => void,
    onEnd?: () => void
  ) {
    if (!this.recognition) {
      onError?.("Speech recognition is not supported in this browser. Please use Chrome or Edge.");
      return;
    }

    this.currentLang = lang;
    this.shouldKeepListening = true;
    this.onResultCallback = onResult;
    this.onErrorCallback = onError || null;
    this.onEndCallback = onEnd || null;
    this.currentTranscript = "";

    try {
      this.recognition.lang = lang;
      this.recognition.start();
      this.isListening = true;
    } catch (e: any) {
      console.warn("Speech recognition start note:", e?.message);
    }
  }

  public pause() {
    this.shouldKeepListening = false;
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch {
        // ignore
      }
    }
    this.isListening = false;
  }

  public resume() {
    this.shouldKeepListening = true;
    this.currentTranscript = "";
    if (this.recognition && !this.isListening) {
      try {
        this.recognition.lang = this.currentLang;
        this.recognition.start();
        this.isListening = true;
      } catch {
        // ignore
      }
    }
  }

  public stop() {
    this.shouldKeepListening = false;
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
    if (this.recognition) {
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
 * Text to Speech (SpeechSynthesis) Helper for Doctor & Triage Spoken Audio
 * Includes duration watchdog timer to prevent Chrome speech synthesis stalls.
 */
export class SpeechOutputService {
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private watchdogTimer: any = null;

  public isSupported(): boolean {
    return typeof window !== "undefined" && "speechSynthesis" in window;
  }

  public speak(
    text: string,
    options?: {
      rate?: number;
      pitch?: number;
      lang?: string;
      onStart?: () => void;
      onEnd?: () => void;
      onError?: (err: any) => void;
    }
  ) {
    if (!this.isSupported() || !text?.trim()) return;

    this.stop();

    try {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }

      const utterance = new SpeechSynthesisUtterance(text.trim());
      utterance.rate = options?.rate || 1.0;
      utterance.pitch = options?.pitch || 1.0;
      const targetLang = options?.lang || "hi-IN";
      utterance.lang = targetLang;

      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        const matchedVoice = voices.find(
          (v) =>
            v.lang.toLowerCase() === targetLang.toLowerCase() ||
            v.lang.toLowerCase().startsWith(targetLang.slice(0, 2).toLowerCase())
        );
        if (matchedVoice) {
          utterance.voice = matchedVoice;
        }
      }

      let hasEnded = false;
      const finish = () => {
        if (hasEnded) return;
        hasEnded = true;
        if (this.watchdogTimer) {
          clearTimeout(this.watchdogTimer);
          this.watchdogTimer = null;
        }
        options?.onEnd?.();
      };

      if (options?.onStart) utterance.onstart = options.onStart;
      utterance.onend = finish;
      utterance.onerror = (e) => {
        console.warn("SpeechSynthesis error:", e);
        finish();
      };

      // Failsafe watchdog timer: guarantees onEnd is called even if Chrome bugs out
      const words = text.trim().split(/\s+/).length;
      const maxMs = Math.max(3000, (words / 2.0) * 1000 + 2000);
      this.watchdogTimer = setTimeout(() => {
        if (!hasEnded) {
          console.warn("Speech watchdog timer triggered to keep voice loop running");
          finish();
        }
      }, maxMs);

      this.currentUtterance = utterance;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn("Error during speak:", e);
      options?.onError?.(e);
      options?.onEnd?.();
    }
  }

  public stop() {
    if (this.watchdogTimer) {
      clearTimeout(this.watchdogTimer);
      this.watchdogTimer = null;
    }
    if (this.isSupported()) {
      window.speechSynthesis.cancel();
      this.currentUtterance = null;
    }
  }

  public isSpeaking(): boolean {
    return this.isSupported() && window.speechSynthesis.speaking;
  }
}

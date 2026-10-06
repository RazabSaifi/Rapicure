/**
 * Native Web Speech API helpers for Speech Recognition (STT) and Synthesis (TTS).
 * Strictly zero external dependencies.
 */

// Speech Recognition Type Definitions for TypeScript
interface IWindow extends Window {
  webkitSpeechRecognition?: any;
  SpeechRecognition?: any;
}

export class SpeechInputService {
  private recognition: any = null;
  private isListening: boolean = false;
  private onResultCallback: ((transcript: string, isFinal: boolean) => void) | null = null;
  private onErrorCallback: ((error: string) => void) | null = null;
  private onEndCallback: (() => void) | null = null;

  constructor() {
    if (typeof window !== "undefined") {
      const win = window as unknown as IWindow;
      const SpeechRecognition = win.SpeechRecognition || win.webkitSpeechRecognition;
      if (SpeechRecognition) {
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = "hi-IN"; // Default to Hindi (India)

        this.recognition.onresult = (event: any) => {
          let interimTranscript = "";
          let finalTranscript = "";

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript;
            } else {
              interimTranscript += event.results[i][0].transcript;
            }
          }

          if (this.onResultCallback) {
            const currentText = finalTranscript || interimTranscript;
            this.onResultCallback(currentText, !!finalTranscript);
          }
        };

        this.recognition.onerror = (event: any) => {
          console.warn("Speech recognition error:", event.error);
          if (this.onErrorCallback) {
            this.onErrorCallback(event.error);
          }
          this.isListening = false;
        };

        this.recognition.onend = () => {
          this.isListening = false;
          if (this.onEndCallback) {
            this.onEndCallback();
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
    if (!this.recognition) {
      if (onError) onError("Browser does not support Speech Recognition. Please use Chrome/Edge.");
      return;
    }

    this.onResultCallback = onResult;
    this.onErrorCallback = onError || null;
    this.onEndCallback = onEnd || null;

    try {
      this.recognition.lang = lang;
      this.recognition.start();
      this.isListening = true;
    } catch (e: any) {
      console.warn("Could not start speech recognition:", e);
      if (onError) onError(e.message || "Failed to start microphone");
    }
  }

  public stop() {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch (e) {
        console.warn("Error stopping speech recognition:", e);
      }
    }
    this.isListening = false;
  }

  public getIsListening(): boolean {
    return this.isListening;
  }
}

/**
 * Text to Speech (SpeechSynthesis) Helper for Doctor Audio Briefing
 */
export class SpeechOutputService {
  private currentUtterance: SpeechSynthesisUtterance | null = null;

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
    if (!this.isSupported()) return;

    this.stop(); // Stop any ongoing speech

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = options?.rate || 1.05; // Slightly brisk for busy clinical environment
    utterance.pitch = options?.pitch || 1.0;
    utterance.lang = options?.lang || "en-US";

    if (options?.onStart) utterance.onstart = options.onStart;
    if (options?.onEnd) utterance.onend = options.onEnd;
    if (options?.onError) utterance.onerror = options.onError;

    this.currentUtterance = utterance;
    window.speechSynthesis.speak(utterance);
  }

  public stop() {
    if (this.isSupported()) {
      window.speechSynthesis.cancel();
      this.currentUtterance = null;
    }
  }

  public isSpeaking(): boolean {
    return this.isSupported() && window.speechSynthesis.speaking;
  }
}

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
 * Text to Speech (SpeechSynthesis) Helper for Voice Dialogue and Doctor Audio Briefing
 */
export class SpeechOutputService {
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private endTimeout: any = null;

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
    if (!this.isSupported()) {
      if (options?.onEnd) options.onEnd();
      return;
    }

    this.stop();

    const win = window as unknown as IWindow;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = options?.rate || (options?.lang === "hi-IN" ? 1.0 : 1.05);
    utterance.pitch = options?.pitch || 1.0;
    utterance.lang = options?.lang || "en-US";

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

    // Store in global window to prevent Chrome garbage collector bug cancelling long speech
    win._activeUtterance = utterance;
    this.currentUtterance = utterance;

    // Safety fallback timeout in case browser never fires onend
    const estimatedDuration = Math.max(2500, text.split(/\s+/).length * 400 + 1000);
    this.endTimeout = setTimeout(() => {
      if (!hasEnded && window.speechSynthesis.speaking) {
        console.warn("Speech synthesis timeout safety triggered");
        handleEnd();
      }
    }, estimatedDuration);

    try {
      window.speechSynthesis.resume(); // Ensure speech synthesis queue is not paused
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.error("Speech synthesis speak error:", err);
      handleEnd();
    }
  }

  public stop() {
    if (this.endTimeout) {
      clearTimeout(this.endTimeout);
      this.endTimeout = null;
    }
    if (this.isSupported()) {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {
        // Ignore
      }
      this.currentUtterance = null;
      if (typeof window !== "undefined") {
        (window as any)._activeUtterance = null;
      }
    }
  }

  public isSpeaking(): boolean {
    return this.isSupported() && window.speechSynthesis.speaking;
  }
}

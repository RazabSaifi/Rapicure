/**
 * Live Audio Client Service for Gemini 3.8 Live API
 * Direct Full-Duplex Audio Streaming (Gemini App Experience)
 * Handles microphone capture, 16kHz PCM streaming, gapless 24kHz audio playback,
 * and real-time audio visualization.
 */

export interface LiveAudioCallbacks {
  onStatusChange?: (
    status: "idle" | "connecting" | "ready" | "listening" | "speaking" | "error",
    message?: string
  ) => void;
  onMicPermissionChange?: (hasMic: boolean, notice?: string) => void;
  onTranscriptAgentChunk?: (chunk: string) => void;
  onTranscriptAgentTurnComplete?: (fullText: string) => void;
  onTranscriptUserSpeech?: (text: string) => void;
  onTranscriptUser?: (text: string) => void;
  onAudioLevelChange?: (inputLevel: number, outputLevel: number) => void;
  onError?: (error: string) => void;
  onInterrupted?: () => void;
  onTurnComplete?: () => void;
}

export interface LiveInitConfig {
  apiKey?: string;
  language: "hi-IN" | "en-IN";
  voiceName?: "Aoede" | "Zephyr" | "Kore" | "Puck" | "Fenrir";
  patientInfo?: {
    name?: string;
    age?: string;
    gender?: string;
  };
  vitals?: {
    bpSystolic?: string;
    bpDiastolic?: string;
    pulse?: string;
    temp?: string;
    spo2?: string;
  };
}

/** Downsamples Float32 audio to 16000Hz Int16 PCM Little-Endian */
function downsampleTo16k(input: Float32Array, inputSampleRate: number): Int16Array {
  if (inputSampleRate === 16000) {
    const output = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return output;
  }

  const ratio = inputSampleRate / 16000;
  const newLength = Math.floor(input.length / ratio);
  const output = new Int16Array(newLength);
  for (let i = 0; i < newLength; i++) {
    const originalIndex = Math.min(Math.floor(i * ratio), input.length - 1);
    const s = Math.max(-1, Math.min(1, input[originalIndex]));
    output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return output;
}

/** Fast binary to base64 conversion without char-by-char string concatenation GC pauses */
function pcmToBase64(pcm16: Int16Array): string {
  const bytes = new Uint8Array(pcm16.buffer, pcm16.byteOffset, pcm16.byteLength);
  let binary = "";
  const len = bytes.byteLength;
  const chunkSize = 8192;
  for (let i = 0; i < len; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }
  return btoa(binary);
}

export class GeminiLiveClient {
  private ws: WebSocket | null = null;
  private inputAudioCtx: AudioContext | null = null;
  private outputAudioCtx: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;

  private nextStartTime: number = 0;
  private activeAudioSources: AudioBufferSourceNode[] = [];
  private callbacks: LiveAudioCallbacks = {};
  private isMuted: boolean = false;
  private isConnected: boolean = false;
  private hasMicAccess: boolean = false;
  private currentAgentTurnText: string = "";
  private isUserSpeaking: boolean = false;
  private speechPauseTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(callbacks: LiveAudioCallbacks) {
    this.callbacks = callbacks;
  }

  public async start(config: LiveInitConfig): Promise<void> {
    try {
      this.callbacks.onStatusChange?.("connecting", "Connecting to Gemini Live...");
      this.currentAgentTurnText = "";

      // 1. Setup Output AudioContext (standard default hardware rate for universal device compatibility)
      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

      this.outputAudioCtx = new AudioCtxClass();
      if (this.outputAudioCtx.state === "suspended") {
        await this.outputAudioCtx.resume();
      }

      // Unlock browser audio
      try {
        const unlock = this.outputAudioCtx.createBuffer(1, 1, 22050);
        const src = this.outputAudioCtx.createBufferSource();
        src.buffer = unlock;
        src.connect(this.outputAudioCtx.destination);
        src.start(0);
      } catch (e) {
        // ignore
      }

      this.nextStartTime = this.outputAudioCtx.currentTime;

      // 2. Setup Mic Capture (Hardware adaptive sample rate with 16kHz downsampling)
      await this.tryAcquireMicrophone(AudioCtxClass);

      // 3. Connect WebSocket to Gemini Live backend
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const host = window.location.host;
      const wsUrl = `${protocol}//${host}/api/live`;

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.ws?.send(
          JSON.stringify({
            type: "init",
            apiKey: config.apiKey,
            language: config.language,
            voiceName: config.voiceName || "Aoede",
            patientInfo: config.patientInfo,
            vitals: config.vitals,
          })
        );
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.handleServerMessage(msg);
        } catch (err) {
          console.error("Failed to parse Live WS message:", err);
        }
      };

      this.ws.onerror = (err) => {
        console.error("Live WebSocket error:", err);
        this.callbacks.onError?.("Live connection failed. Retrying...");
        this.callbacks.onStatusChange?.("error", "Connection error");
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.callbacks.onStatusChange?.("idle", "Live session ended");
      };
    } catch (err: unknown) {
      console.error("Failed to start Gemini Live client:", err);
      const msg = err instanceof Error ? err.message : "Connection error";
      this.callbacks.onError?.(msg);
      this.callbacks.onStatusChange?.("error", msg);
      this.stop();
    }
  }

  public async retryMicrophone(): Promise<boolean> {
    const AudioCtxClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    return await this.tryAcquireMicrophone(AudioCtxClass);
  }

  private async tryAcquireMicrophone(AudioCtxClass: typeof AudioContext): Promise<boolean> {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        this.hasMicAccess = false;
        this.callbacks.onMicPermissionChange?.(
          false,
          "Microphone is not available in this browser. Please use Chrome or Edge."
        );
        return false;
      }

      // Request mic stream with permissive audio constraint
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Native AudioContext for input capture
      this.inputAudioCtx = new AudioCtxClass();
      if (this.inputAudioCtx.state === "suspended") {
        await this.inputAudioCtx.resume();
      }

      const hardwareSampleRate = this.inputAudioCtx.sampleRate;
      this.sourceNode = this.inputAudioCtx.createMediaStreamSource(this.mediaStream);
      this.scriptProcessor = this.inputAudioCtx.createScriptProcessor(4096, 1, 1);

      this.sourceNode.connect(this.scriptProcessor);

      // Connect to a muted gain node to prevent speaker feedback loop
      const muteGain = this.inputAudioCtx.createGain();
      muteGain.gain.value = 0;
      this.scriptProcessor.connect(muteGain);
      muteGain.connect(this.inputAudioCtx.destination);

      this.scriptProcessor.onaudioprocess = (e) => {
        if (this.isMuted) return;

        const inputChannel = e.inputBuffer.getChannelData(0);

        // Volume level metric for visualizer
        let sum = 0;
        for (let i = 0; i < inputChannel.length; i++) {
          sum += inputChannel[i] * inputChannel[i];
        }
        const rms = Math.sqrt(sum / inputChannel.length);
        const level = Math.min(100, Math.round(rms * 280));
        this.callbacks.onAudioLevelChange?.(level, 0);

        // Fast voice activity & pause detection to eliminate response latency:
        if (level > 12) {
          this.isUserSpeaking = true;
          if (this.speechPauseTimer) {
            clearTimeout(this.speechPauseTimer);
            this.speechPauseTimer = null;
          }
        } else if (this.isUserSpeaking && level < 8) {
          // If the patient finished speaking and pauses for 550ms:
          if (!this.speechPauseTimer) {
            this.speechPauseTimer = setTimeout(() => {
              if (this.isUserSpeaking) {
                this.isUserSpeaking = false;
                this.sendAudioStreamEnd();
              }
              this.speechPauseTimer = null;
            }, 550);
          }
        }

        // Downsample to 16kHz PCM Little-Endian
        const pcm16 = downsampleTo16k(inputChannel, hardwareSampleRate);
        const base64 = pcmToBase64(pcm16);

        // Stream audio chunk directly to Gemini Live backend
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ type: "audio", audio: base64 }));
        }
      };

      this.hasMicAccess = true;
      this.callbacks.onMicPermissionChange?.(true);
      return true;
    } catch (micErr: unknown) {
      console.warn("Microphone access could not be acquired:", micErr);
      this.hasMicAccess = false;
      this.callbacks.onMicPermissionChange?.(
        false,
        "Microphone continuous stream is resting. You can speak via in-app voice, quick chips, or text."
      );
      return false;
    }
  }

  private handleServerMessage(msg: {
    type: string;
    audio?: string;
    text?: string;
    status?: string;
    message?: string;
    error?: string;
  }) {
    switch (msg.type) {
      case "status":
        if (msg.status === "ready") {
          this.isConnected = true;
          this.callbacks.onStatusChange?.("ready", "Gemini Live Call Active");
        } else if (msg.status === "connecting") {
          this.callbacks.onStatusChange?.("connecting", msg.message || "Connecting to Gemini Live...");
        } else if (msg.status === "closed" || msg.status === "idle") {
          this.isConnected = false;
          this.callbacks.onStatusChange?.("idle");
        }
        break;

      case "audio":
        if (msg.audio) {
          this.playAudioChunk(msg.audio);
          this.callbacks.onStatusChange?.("speaking", "Gemini Live speaking...");
        }
        break;

      case "transcript_agent":
        if (msg.text) {
          this.currentAgentTurnText += msg.text;
          this.callbacks.onTranscriptAgentChunk?.(msg.text);
        }
        break;

      case "transcript_user_speech":
        if (msg.text) {
          this.callbacks.onTranscriptUserSpeech?.(msg.text);
        }
        break;

      case "interrupted":
        this.stopAllAudio();
        this.callbacks.onInterrupted?.();
        this.callbacks.onStatusChange?.("listening", "Listening (Barge-in active)...");
        break;

      case "turn_complete":
        if (this.currentAgentTurnText.trim()) {
          this.callbacks.onTranscriptAgentTurnComplete?.(this.currentAgentTurnText.trim());
          this.currentAgentTurnText = "";
        }
        this.callbacks.onTurnComplete?.();
        this.callbacks.onStatusChange?.("listening", "Listening to you...");
        break;

      case "error":
        this.callbacks.onError?.(msg.error || "Gemini Live error");
        this.callbacks.onStatusChange?.("error", msg.error);
        break;
    }
  }

  private playAudioChunk(base64Audio: string) {
    if (!this.outputAudioCtx) return;

    try {
      if (this.outputAudioCtx.state === "suspended") {
        this.outputAudioCtx.resume();
      }

      const binary = atob(base64Audio);
      const length = Math.floor(binary.length / 2);
      if (length === 0) return;

      const float32 = new Float32Array(length);
      let sum = 0;

      for (let i = 0; i < length; i++) {
        const low = binary.charCodeAt(i * 2);
        const high = binary.charCodeAt(i * 2 + 1);
        let val = (high << 8) | low;
        if (val >= 0x8000) val -= 0x10000;
        const sample = val / 32768.0;
        float32[i] = sample;
        sum += sample * sample;
      }

      // Model speaking audio level
      const rms = Math.sqrt(sum / length);
      const level = Math.min(100, Math.round(rms * 280));
      this.callbacks.onAudioLevelChange?.(0, level);

      // Web Audio resamples smoothly from 24kHz to hardware rate
      const audioBuffer = this.outputAudioCtx.createBuffer(1, length, 24000);
      audioBuffer.copyToChannel(float32, 0);

      const source = this.outputAudioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.outputAudioCtx.destination);

      const currentTime = this.outputAudioCtx.currentTime;
      if (this.nextStartTime < currentTime) {
        this.nextStartTime = currentTime + 0.02;
      }

      source.start(this.nextStartTime);
      this.nextStartTime += audioBuffer.duration;

      this.activeAudioSources.push(source);
      source.onended = () => {
        const idx = this.activeAudioSources.indexOf(source);
        if (idx !== -1) {
          this.activeAudioSources.splice(idx, 1);
        }
        if (this.activeAudioSources.length === 0) {
          this.callbacks.onAudioLevelChange?.(0, 0);
        }
      };
    } catch (err) {
      console.error("Error playing audio chunk:", err);
    }
  }

  public sendTextMessage(text: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "text", text }));
      this.callbacks.onTranscriptUser?.(text);
      this.callbacks.onStatusChange?.("listening", "Processing message...");
    }
  }

  public sendAudioStreamEnd() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "audio_end" }));
    }
  }

  public setMute(muted: boolean) {
    this.isMuted = muted;
    if (this.mediaStream) {
      this.mediaStream.getAudioTracks().forEach((track) => {
        track.enabled = !muted;
      });
    }
  }

  public interrupt() {
    this.stopAllAudio();
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "interrupt" }));
    }
  }

  public stopAllAudio() {
    for (const source of this.activeAudioSources) {
      try {
        source.stop();
      } catch {
        // ignore
      }
    }
    this.activeAudioSources = [];
    if (this.outputAudioCtx) {
      this.nextStartTime = this.outputAudioCtx.currentTime;
    }
    this.callbacks.onAudioLevelChange?.(0, 0);
  }

  public stop() {
    this.isConnected = false;
    this.hasMicAccess = false;
    if (this.speechPauseTimer) {
      clearTimeout(this.speechPauseTimer);
      this.speechPauseTimer = null;
    }
    this.isUserSpeaking = false;
    this.stopAllAudio();

    if (this.ws) {
      try {
        this.ws.send(JSON.stringify({ type: "close" }));
        this.ws.close();
      } catch {}
      this.ws = null;
    }

    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect();
      } catch {}
      this.sourceNode = null;
    }

    if (this.scriptProcessor) {
      try {
        this.scriptProcessor.disconnect();
      } catch {}
      this.scriptProcessor = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
    }

    if (this.inputAudioCtx) {
      try {
        this.inputAudioCtx.close();
      } catch {}
      this.inputAudioCtx = null;
    }

    if (this.outputAudioCtx) {
      try {
        this.outputAudioCtx.close();
      } catch {}
      this.outputAudioCtx = null;
    }

    this.callbacks.onStatusChange?.("idle");
  }
}

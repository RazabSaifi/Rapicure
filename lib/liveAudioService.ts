/**
 * Live Audio Client Service for Gemini 3.8 Live API
 * Handles 16kHz microphone capture (when permitted), PCM conversion, WebSocket streaming,
 * and 24kHz gapless playback with visualizer metrics.
 * Gracefully degrades if microphone permission is denied or blocked.
 */

export interface LiveAudioCallbacks {
  onStatusChange?: (
    status: "idle" | "connecting" | "ready" | "listening" | "speaking" | "error",
    message?: string
  ) => void;
  onMicPermissionChange?: (hasMic: boolean, notice?: string) => void;
  onTranscriptAgent?: (text: string) => void;
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

  constructor(callbacks: LiveAudioCallbacks) {
    this.callbacks = callbacks;
  }

  public async start(config: LiveInitConfig): Promise<void> {
    try {
      this.callbacks.onStatusChange?.("connecting", "Connecting to Gemini 3.8 Live...");

      // 1. Setup Output AudioContext (always enabled for model speech playback)
      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

      this.outputAudioCtx = new AudioCtxClass({ sampleRate: 24000 });
      if (this.outputAudioCtx.state === "suspended") {
        await this.outputAudioCtx.resume();
      }
      this.nextStartTime = this.outputAudioCtx.currentTime;

      // 2. Attempt Mic Capture (Gracefully handled if permission denied)
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
        this.callbacks.onError?.("WebSocket connection to Gemini 3.8 Live failed.");
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
          "Microphone API is not supported in this browser context. You can use text/chips to converse."
        );
        return false;
      }

      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      this.inputAudioCtx = new AudioCtxClass({ sampleRate: 16000 });
      if (this.inputAudioCtx.state === "suspended") {
        await this.inputAudioCtx.resume();
      }

      this.sourceNode = this.inputAudioCtx.createMediaStreamSource(this.mediaStream);
      this.scriptProcessor = this.inputAudioCtx.createScriptProcessor(2048, 1, 1);

      this.sourceNode.connect(this.scriptProcessor);
      this.scriptProcessor.connect(this.inputAudioCtx.destination);

      this.scriptProcessor.onaudioprocess = (e) => {
        if (!this.isConnected || this.isMuted) return;

        const inputChannel = e.inputBuffer.getChannelData(0);

        // Compute volume level for visualizer
        let sum = 0;
        for (let i = 0; i < inputChannel.length; i++) {
          sum += inputChannel[i] * inputChannel[i];
        }
        const rms = Math.sqrt(sum / inputChannel.length);
        const level = Math.min(100, Math.round(rms * 250));
        this.callbacks.onAudioLevelChange?.(level, 0);

        // Convert Float32 (-1.0 to 1.0) to 16-bit PCM Little Endian
        const pcm16 = new Int16Array(inputChannel.length);
        for (let i = 0; i < inputChannel.length; i++) {
          const s = Math.max(-1, Math.min(1, inputChannel[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }

        // Base64 encode
        const bytes = new Uint8Array(pcm16.buffer);
        let binary = "";
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);

        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ type: "audio", audio: base64 }));
        }
      };

      this.hasMicAccess = true;
      this.callbacks.onMicPermissionChange?.(true);
      return true;
    } catch (micErr: unknown) {
      console.warn("Microphone access denied or unavailable; continuing in text-to-voice mode:", micErr);
      this.hasMicAccess = false;
      this.callbacks.onMicPermissionChange?.(
        false,
        "Microphone permission not granted. Interactive text-to-speech mode enabled: Gemini 3.8 Live will still speak aloud in real-time, and you can reply using symptom chips or typing!"
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
          const statusText = this.hasMicAccess
            ? "Gemini 3.8 Live connected (Voice Active)"
            : "Gemini 3.8 Live connected (Text-to-Voice Mode)";
          this.callbacks.onStatusChange?.("ready", statusText);
        } else if (msg.status === "connecting") {
          this.callbacks.onStatusChange?.("connecting", msg.message || "Connecting...");
        } else if (msg.status === "closed" || msg.status === "idle") {
          this.isConnected = false;
          this.callbacks.onStatusChange?.("idle");
        }
        break;

      case "audio":
        if (msg.audio) {
          this.playAudioChunk(msg.audio);
          this.callbacks.onStatusChange?.("speaking", "Gemini 3.8 Live speaking");
        }
        break;

      case "transcript_agent":
        if (msg.text) {
          this.callbacks.onTranscriptAgent?.(msg.text);
        }
        break;

      case "interrupted":
        this.stopAllAudio();
        this.callbacks.onInterrupted?.();
        this.callbacks.onStatusChange?.(
          "listening",
          this.hasMicAccess ? "Listening to patient..." : "Ready for next message"
        );
        break;

      case "turn_complete":
        this.callbacks.onTurnComplete?.();
        this.callbacks.onStatusChange?.(
          "listening",
          this.hasMicAccess ? "Listening to patient..." : "Ready for next message"
        );
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
      const binary = atob(base64Audio);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const int16 = new Int16Array(bytes.buffer);
      const float32 = new Float32Array(int16.length);

      let sum = 0;
      for (let i = 0; i < int16.length; i++) {
        const val = int16[i] / 32768.0;
        float32[i] = val;
        sum += val * val;
      }

      // Model speaking audio level
      const rms = Math.sqrt(sum / int16.length);
      const level = Math.min(100, Math.round(rms * 280));
      this.callbacks.onAudioLevelChange?.(0, level);

      const audioBuffer = this.outputAudioCtx.createBuffer(1, float32.length, 24000);
      audioBuffer.copyToChannel(float32, 0);

      const source = this.outputAudioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.outputAudioCtx.destination);

      const currentTime = this.outputAudioCtx.currentTime;
      if (this.nextStartTime < currentTime) {
        this.nextStartTime = currentTime + 0.03;
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
    this.stopAllAudio();

    if (this.ws) {
      try {
        this.ws.send(JSON.stringify({ type: "close" }));
        this.ws.close();
      } catch {
        // ignore
      }
      this.ws = null;
    }

    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect();
      } catch {
        // ignore
      }
      this.sourceNode = null;
    }

    if (this.scriptProcessor) {
      try {
        this.scriptProcessor.disconnect();
      } catch {
        // ignore
      }
      this.scriptProcessor = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    if (this.inputAudioCtx) {
      try {
        this.inputAudioCtx.close();
      } catch {
        // ignore
      }
      this.inputAudioCtx = null;
    }

    if (this.outputAudioCtx) {
      try {
        this.outputAudioCtx.close();
      } catch {
        // ignore
      }
      this.outputAudioCtx = null;
    }

    this.callbacks.onStatusChange?.("idle");
  }
}

const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { WebSocketServer } = require("ws");
const { GoogleGenAI, Modality } = require("@google/genai");

const port = 3000;
const dev = process.env.NODE_ENV !== "production";
const app = next({ dev, hostname: "0.0.0.0", port });
const handle = app.getRequestHandler();

// Start preparing Next.js in background
const preparePromise = app.prepare().then(() => {
  console.log("> Next.js app prepared successfully");
});

const server = createServer(async (req, res) => {
  try {
    // Immediate 200 response for basic health checks so probes never time out
    if (req.url === "/health" || req.url === "/_health") {
      res.statusCode = 200;
      res.setHeader("Content-Type", "text/plain");
      res.end("OK");
      return;
    }

    // Await Next.js preparation before routing pages
    await preparePromise;
    const parsedUrl = parse(req.url, true);
    await handle(req, res, parsedUrl);
  } catch (err) {
    console.error("Error occurred handling", req.url, err);
    res.statusCode = 500;
    res.end("Internal Server Error");
  }
});

const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (req, socket, head) => {
  const { pathname } = parse(req.url || "");
  if (pathname === "/api/live" || pathname === "/live") {
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  }
});

wss.on("connection", async (clientWs, req) => {
  console.log("[Gemini Live API] Client connected to live WebSocket");
  let liveSession = null;
  let isConnected = false;

  const cleanup = () => {
    if (liveSession) {
      try {
        liveSession.close();
      } catch (e) {
        // ignore
      }
      liveSession = null;
    }
    isConnected = false;
  };

  clientWs.on("close", () => {
    console.log("[Gemini Live API] Client disconnected");
    cleanup();
  });

  clientWs.on("error", (err) => {
    console.error("[Gemini Live API] WebSocket client error:", err);
    cleanup();
  });

  clientWs.on("message", async (rawMessage) => {
    try {
      const msg = JSON.parse(rawMessage.toString());

      if (msg.type === "init") {
        cleanup();
        const apiKey = msg.apiKey || process.env.GEMINI_API_KEY;

        if (!apiKey) {
          clientWs.send(
            JSON.stringify({
              type: "error",
              error:
                "No GEMINI_API_KEY available. Please set your key in the Settings modal.",
            })
          );
          return;
        }

        const ai = new GoogleGenAI({
          apiKey,
          httpOptions: {
            headers: {
              "User-Agent": "aistudio-build",
            },
          },
        });

        const language = msg.language || "hi-IN";
        const patientInfo = msg.patientInfo || {};
        const vitals = msg.vitals || {};
        const voiceName = msg.voiceName || "Aoede";

        const systemPrompt = `You are "RapiCure Live", an empathetic, highly skilled clinical triage doctor at AIIMS Pre-OPD Emergency Triage.
You are conversing verbally with a patient in real time.

LANGUAGE RULE (STRICT):
- When the patient speaks in Hinglish or Hindi (e.g., "mujhe 2 din se bukhar hai", "pet me dard ho raha hai"), RESPOND NATURALLY IN HINGLISH.
- When the patient speaks in English, RESPOND IN ENGLISH.
- Mirror the patient's language instantly and smoothly.

LATENCY & CONVERSATION RULES:
1. Fast Response & Extreme Brevity: Speak strictly in 1 to 2 short sentences (maximum 20 words). Do not give long speeches or monologues. This ensures ultra-fast voice output.
2. Clinical Focus: Ask about onset, exact duration, pain scale (1-10), and screen for red flags (breathing difficulty, chest pain, high fever, fainting).
3. Warmth: Acknowledge symptoms empathetically and reassure the patient kindly.`;

        try {
          clientWs.send(JSON.stringify({ type: "status", status: "connecting" }));

          liveSession = await ai.live.connect({
            model: "gemini-3.8-live",
            config: {
              responseModalities: [Modality.AUDIO],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName },
                },
              },
              outputAudioTranscription: {},
              inputAudioTranscription: {},
              systemInstruction: systemPrompt,
            },
            callbacks: {
              onmessage: (serverMsg) => {
                // 1. Audio Output chunks (24kHz PCM)
                const parts = serverMsg.serverContent?.modelTurn?.parts || [];
                for (const part of parts) {
                  if (part.inlineData?.data) {
                    clientWs.send(
                      JSON.stringify({
                        type: "audio",
                        audio: part.inlineData.data,
                      })
                    );
                  }
                }

                // 2. Real-time text transcription of model speech
                if (serverMsg.serverContent?.outputTranscription?.text) {
                  clientWs.send(
                    JSON.stringify({
                      type: "transcript_agent",
                      text: serverMsg.serverContent.outputTranscription.text,
                    })
                  );
                }

                // 3. Real-time transcription of patient spoken input
                if (serverMsg.serverContent?.inputTranscription?.text) {
                  clientWs.send(
                    JSON.stringify({
                      type: "transcript_user_speech",
                      text: serverMsg.serverContent.inputTranscription.text,
                    })
                  );
                }

                // 4. Interruption (barge-in) notice
                if (serverMsg.serverContent?.interrupted) {
                  clientWs.send(JSON.stringify({ type: "interrupted" }));
                }

                // 5. Turn complete
                if (serverMsg.serverContent?.turnComplete) {
                  clientWs.send(JSON.stringify({ type: "turn_complete" }));
                }
              },
              onclose: () => {
                console.log("[Gemini Live API] Gemini session closed");
                clientWs.send(JSON.stringify({ type: "status", status: "closed" }));
                isConnected = false;
              },
              onerror: (e) => {
                console.error("[Gemini Live API] Gemini session error:", e);
                clientWs.send(
                  JSON.stringify({
                    type: "error",
                    error: e?.message || "Live API session encountered an error",
                  })
                );
              },
            },
          });

          isConnected = true;
          clientWs.send(
            JSON.stringify({
              type: "status",
              status: "ready",
              message: "Gemini 3.8 Live session established.",
            })
          );

          // Initiate warm spoken greeting via sendClientContent
          liveSession.sendClientContent({
            turns: [
              {
                role: "user",
                parts: [
                  {
                    text:
                      "Give a warm, natural 1-sentence greeting to the patient and ask what symptoms they have today in " +
                      (language === "hi-IN" ? "natural conversational Hinglish." : "clear English."),
                  },
                ],
              },
            ],
            turnComplete: true,
          });
        } catch (sessionErr) {
          console.error("[Gemini Live API] Connection failed:", sessionErr);
          clientWs.send(
            JSON.stringify({
              type: "error",
              error:
                sessionErr?.message ||
                "Failed to connect to Gemini 3.8 Live model.",
            })
          );
        }
      } else if (msg.type === "audio") {
        // Stream raw 16kHz PCM audio from microphone directly to Gemini Live mediaChunks
        if (liveSession && isConnected && msg.audio) {
          liveSession.sendRealtimeInput({
            media: {
              data: msg.audio,
              mimeType: "audio/pcm;rate=16000",
            },
          });
        }
      } else if (msg.type === "audio_end") {
        // Signals speech turn ended: prompts Gemini Live to answer immediately without waiting
        if (liveSession && isConnected) {
          try {
            liveSession.sendRealtimeInput({
              audioStreamEnd: true,
            });
          } catch (endErr) {
            console.warn("[Gemini Live API] audioStreamEnd warning:", endErr);
          }
        }
      } else if (msg.type === "text") {
        // Process user text input or symptom chips via sendClientContent
        if (liveSession && isConnected && msg.text) {
          liveSession.sendClientContent({
            turns: [
              {
                role: "user",
                parts: [{ text: msg.text }],
              },
            ],
            turnComplete: true,
          });
        }
      } else if (msg.type === "interrupt") {
        // Interruption requested
      } else if (msg.type === "close") {
        cleanup();
        clientWs.send(JSON.stringify({ type: "status", status: "idle" }));
      }
    } catch (msgErr) {
      console.error("[Gemini Live API] Message processing error:", msgErr);
    }
  });
});

// Bind immediately on port 3000
server.listen(port, "0.0.0.0", (err) => {
  if (err) throw err;
  console.log(`> Server listening on http://0.0.0.0:${port}`);
});

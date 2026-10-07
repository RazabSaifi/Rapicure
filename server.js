const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { WebSocketServer } = require("ws");
const { GoogleGenAI, Modality } = require("@google/genai");

const port = parseInt(process.env.PORT || "3000", 10);
const dev = process.env.NODE_ENV !== "production";
const app = next({ dev, hostname: "0.0.0.0", port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
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
    // Note: other paths (like Next.js HMR) are handled by Next.js if attached
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
      console.error("[Gemini Live API] WebSocket error:", err);
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
                  "No GEMINI_API_KEY available. Please configure the key in the settings.",
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

          const systemPrompt = `You are "MedAssist AI Live", an expert clinical triage voice assistant at a busy hospital OPD (e.g., AIIMS / District Civil Hospital).
You are conversing verbally with a patient in real-time.
Language preference: ${language === "hi-IN" ? "Hindi / Hinglish (natural conversational everyday Hindi, e.g. 'Aapko kab se takleef hai?', 'Bukhar kitna tezz hai?')" : "Indian English / Hinglish"}.

Patient Profile on file:
Name: ${patientInfo.name || "Patient"} | Age: ${patientInfo.age || "Unknown"} | Gender: ${patientInfo.gender || "Unknown"}
Recorded Vitals: BP ${vitals.bpSystolic || "--"}/${vitals.bpDiastolic || "--"} mmHg, Pulse ${vitals.pulse || "--"} bpm, Temp ${vitals.temp || "--"}°F, SpO2 ${vitals.spo2 || "--"}%.

Clinical Guidelines:
1. Speak concisely, naturally, and warmly. Keep responses to 1-2 spoken sentences so the patient can answer easily.
2. Ask about primary complaint, exact onset (duration in days/hours), severity scale (1 to 10), and any red flags (chest tightness, severe breathlessness, high fever with chills, vomiting blood, sudden weakness).
3. Be empathetic: reassure anxious patients while systematically collecting clinical triage facts.
4. When the patient explains a symptom, acknowledge it kindly and ask one clear clarifying question.
5. If the patient asks to summarize or finish, summarize the key symptoms in 2 sentences and thank them.`;

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
                systemInstruction: systemPrompt,
              },
              callbacks: {
                onmessage: (serverMsg) => {
                  // Audio chunk (24kHz PCM)
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
                    if (part.text) {
                      clientWs.send(
                        JSON.stringify({
                          type: "transcript_agent",
                          text: part.text,
                        })
                      );
                    }
                  }

                  if (serverMsg.serverContent?.interrupted) {
                    clientWs.send(JSON.stringify({ type: "interrupted" }));
                  }

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

            // Trigger initial warm greeting
            liveSession.sendRealtimeInput({
              text: "Hello, please give a warm, brief 1-sentence greeting to the patient and ask what brings them to the clinic today in " + (language === "hi-IN" ? "conversational Hindi." : "English."),
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
          // PCM 16kHz base64 from client
          if (liveSession && isConnected && msg.audio) {
            liveSession.sendRealtimeInput({
              audio: {
                data: msg.audio,
                mimeType: "audio/pcm;rate=16000",
              },
            });
          }
        } else if (msg.type === "text") {
          // Patient text message / prompt
          if (liveSession && isConnected && msg.text) {
            liveSession.sendRealtimeInput({
              text: msg.text,
            });
          }
        } else if (msg.type === "interrupt") {
          // User interrupted or spoke
          if (liveSession && isConnected) {
            // Live API handles barge-in natively when new audio/text arrives
          }
        } else if (msg.type === "close") {
          cleanup();
          clientWs.send(JSON.stringify({ type: "status", status: "idle" }));
        }
      } catch (msgErr) {
        console.error("[Gemini Live API] Message processing error:", msgErr);
      }
    });
  });

  server.listen(port, "0.0.0.0", (err) => {
    if (err) throw err;
    console.log(`> Server ready and listening on http://0.0.0.0:${port}`);
  });
});

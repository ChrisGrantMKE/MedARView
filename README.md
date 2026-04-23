# MedARView

MedARView is a WebXR mockup for a medical smart-glasses heads-up display (HUD), designed to run in the Meta Quest Browser with AR passthrough.

The app overlays simulated clinical UI in 3D space using React, Three.js, and React Three XR.

## Current Features

- AR entry using immersive AR session support
- Camera-locked HUD panels for glanceable overlays
- Mock live vitals (blood pressure and SpO2) with periodic updates
- Voice capture architecture planned for short commands plus long-form clinical dictation
- Automatic Doctor/Patient attribution pipeline scaffold (API-first design)
- Patient abstract panel with mock history and AI summary

## Tech Stack

- React + Vite
- three
- @react-three/fiber
- @react-three/xr
- @react-three/drei

## Local Development

Install dependencies:

```bash
npm install
```

Run dev server:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

## WebXR Notes

- WebXR AR generally requires HTTPS (or trusted localhost contexts).
- mkcert is included as a dev dependency for local certificate workflows.
- For Quest testing, use Meta Quest Browser and ensure your local network setup allows device access.

## Speech Recognition Strategy

MedARView should use a two-path speech pipeline instead of relying on browser speech recognition for everything.

- Short command-and-control phrases can use the browser Web Speech API.
- Long-form dictation and room conversation capture should use `navigator.mediaDevices.getUserMedia()` and stream raw mic audio to a backend-managed cloud speech provider.
- The Quest/browser path should treat browser-native speech recognition as a convenience feature only, not as the primary transcription engine for 10-minute sessions.

### Current Test Environment Decision

For the current home-hosted mock-data test environment, the best provider choice changes because the target usage is capped at 60 total minutes over the next 30 days.

- Use Google Cloud Speech-to-Text `medical_conversation` as the primary long-form test provider.
- Keep the browser Web Speech API for short local commands.
- Defer Deepgram until usage grows past the free test window or until lower-friction live WebSocket integration matters more than minimizing cost.

This recommendation is specific to the current prototype constraints:

- mock data only
- self-hosted at home behind an existing domain
- usage budget capped at 60 minutes in the next 30 days

### 60-Minute Usage Plan

To stay under the current free test allowance, treat the external speech provider as a limited resource instead of leaving it on continuously.

1. Reserve browser Web Speech for onboarding commands and manual UI control.
2. Start long-form dictation only after the visit actually begins.
3. End the dictation session as soon as the simulated conversation ends.
4. Keep individual test visits short, ideally 5 to 10 minutes.
5. Check cumulative usage after each session and stop once the 60-minute window is reached.

Practical test cadence:

- 6 sessions at 10 minutes each, or
- 8 sessions at about 7.5 minutes each, or
- 12 sessions at 5 minutes each

The frontend now includes a local budget tracker intended to keep the mock environment honest during this test window. It is advisory only and should be backed by provider-side usage checks before relying on it for billing control.

### Recommended Provider For This Test Phase: Google Cloud Speech-to-Text Medical

Google Cloud Speech-to-Text Medical is the best temporary choice for this phase.

- The `medical_conversation` model is built for provider/patient conversations and supports speaker diarization.
- Google currently lists the first 60 minutes per month of v1 medical transcription as free, which matches the stated testing cap.
- The integration is heavier than Deepgram, but the cost profile is better for this specific test window.

Recommended architecture:

1. Capture microphone audio in the WebXR client.
2. Stream audio chunks to a secure Node/Express backend over WebSocket or `fetch`.
3. Forward the audio stream from the backend to Google Cloud Speech-to-Text Medical using the `medical_conversation` model.
4. Map returned speaker labels into MedARView roles such as `Doctor` and `Patient`.
5. Persist transcript segments, confidence, and timestamps for summary/export workflows.

### Backend Integration Plan

The repository now includes a local speech gateway scaffold at `server/speechGateway.mjs` and an example environment file at `.env.example`.

Recommended implementation order:

1. Run the local gateway behind your existing home-hosted domain or reverse proxy.
2. Keep browser speech recognition for short commands only.
3. Use the gateway to expose health and usage endpoints for local diagnostics.
4. Add Google streaming transcription inside the gateway and return speaker-labeled transcript chunks.
5. Point `VITE_DICTATION_API_URL` and `VITE_SPEAKER_API_URL` at that gateway once streaming is wired.

Current scaffold status:

- `/health` reports gateway readiness and whether Google credentials are configured.
- `/usage` and `/usage/record` maintain a local test budget ledger.
- `/diarize` is intentionally a placeholder until streaming transcription is added.

### Why Not Deepgram First?

Deepgram remains the strongest alternate once this project moves beyond the current cost ceiling.

- Its live WebSocket flow is simpler for a React/WebXR frontend plus Node backend.
- Its diarization on live streaming audio is a better fit for rapid implementation.
- It stops being the best current choice only because the test budget is explicitly capped at a free 60-minute window.

Deepgram should be revisited first if test usage expands beyond the free Google medical allowance.

### Why Not AssemblyAI First?

AssemblyAI is also a strong option, but it lands behind Deepgram for this repo.

- Its streaming API is developer-friendly and its diarization is strong for long-form audio.
- It adds useful downstream features such as summarization and speaker identification.
- For this specific React/WebXR dictation path, Deepgram has the cleaner default story for low-friction live streaming plus diarization.

### Provider Ranking For This Project

1. Google Cloud Speech-to-Text Medical: best fit for this 60-minute mock-data test window because the current free allowance matches the stated usage cap.
2. Deepgram: best fit once ease of streaming integration matters more than minimizing spend.
3. AssemblyAI: viable, but less compelling than the other two for this narrow test phase.

### Operational Notes

- Do not send provider API keys directly from the browser; proxy through a backend service.
- Expect weaker pickup for the patient voice on Quest-class headsets because the microphones are physically closer to the wearer.
- Add noise suppression, confidence thresholds, and transcript correction UX before treating transcripts as chart-ready.
- Since the app is self-hosted at home with an existing domain, terminate HTTPS on your own host or reverse proxy so Quest mic access and WebXR permissions remain reliable.
- Potential privacy and HIPAA-adjacent concerns are tracked separately in `HIPAA.md` for this folder, even though this test environment uses mock data.
- The built-in budget tracker is local-state based and should be treated as a guardrail, not a billing source of truth.

## Dictation / Attribution API Notes

The app now supports automatic speaker attribution through an external API endpoint.

- Environment variable:

```bash
VITE_SPEAKER_API_URL=https://your-api.example.com/diarize
```

For the current test path, this endpoint should act as a backend proxy/orchestrator for Google Cloud Speech-to-Text Medical rather than a browser-only heuristic endpoint.

- Request payload shape (sent by the app):
	- `utterance: string`
	- `conversationTail: Array<{ speaker, text, timestamp }>`
	- `previousSpeaker: 'Doctor' | 'Patient'`

- Expected response shape:
	- `speaker: 'Doctor' | 'Patient'`
	- `confidence: number` (0..1, optional)

If no API is configured or the endpoint is unavailable, the app falls back to local heuristic attribution in `src/speakerAttribution.js`.

## New Dependencies / Integrations To Consider

- Google Cloud Speech-to-Text client or REST integration for `medical_conversation`
- Secure backend proxy for speech streaming, transcript persistence, and provider auth
- Optional in-browser summarization model (`@xenova/transformers`) for offline/local demos
- Optional provider abstraction layer so Google Medical or AssemblyAI can be evaluated later without rewriting the XR client

## Visit Summary Engine

MedARView generates a structured clinical note draft at the end of each visit session without sending any data to an external service. The approach is a **hybrid extractive-to-SOAP formatter**: the existing clinical keyword scorer provides structured input data, and a template engine maps that data into SOAP-section output. No model, no API, no download — it runs in the browser in zero perceptible time.

### How It Works

Every spoken turn is broken into sentences using punctuation boundaries. Each sentence is scored against seven clinical pattern categories using regex matching:

| Category | Signal keywords |
|---|---|
| Cardiovascular | heart, cardiac, chest, palpitations, blood pressure, hypertension |
| Respiratory | breath, dyspnea, oxygen, SpO₂, saturation, cough, wheeze, lung |
| Pain | pain, ache, hurt, discomfort, tender, sore |
| Medications | medication, drug, dosage, prescription, mg, pill, tablet |
| Symptoms | symptom, complaint, nausea, fever, fatigue, dizzy, swelling, edema |
| History | history, diagnosis, condition, diabetes, cancer, surgery, allergy |
| Vitals | temperature, pulse, rate, weight, height, BMI |

Speaker attribution (Doctor vs Patient) is already attached to each turn by the attribution pipeline. Combining category hits with speaker role allows sentences to be routed into SOAP sections:

- **S — Subjective**: Patient-speaker sentences matching Pain, Symptoms, or History categories. The first patient turn is always used as the chief complaint line.
- **O — Objective**: Captured vitals (BP and SpO₂) plus the full list of clinical topics detected anywhere in the conversation.
- **A — Assessment**: Doctor-speaker sentences matching Cardiovascular, Respiratory, Pain, Symptoms, or History categories.
- **P — Plan**: Doctor-speaker sentences matching Medications, or any sentence matching plan-signal keywords (follow-up, refer, prescribe, schedule, monitor, recommend, start, continue, increase, decrease, stop, hold, taper).

The top sentences in each bucket (up to 3 per section) are selected, truncated at 120 characters if needed, and written as plain text lines under each SOAP heading.

### What This Does Not Do

- It does not interpret or infer meaning — it only routes sentences that contain matching keywords.
- It does not synthesize across turns — each output line is an original spoken sentence.
- It does not correct transcription errors, misattributions, or coverage gaps.
- A section will show a fallback message if no sentences scored against its category set.

### Data Flow

```
Conversation turns (in-memory, browser only)
        │
        ▼
  Sentence extraction + clinical keyword scoring
        │
        ▼
  SOAP bucket routing (by speaker role + category)
        │
        ▼
  Template formatter → structured draft note (string)
        │
        ▼
  SessionEndScreen (displayed in-app, never transmitted)
```

No transcript data leaves the browser during summarization. The note exists only in React component state and is cleared when the session ends or the page is refreshed.

### Hardware Context

This approach was chosen specifically for the current home-hosted environment (Ubuntu, 8th-gen i5, 8 GB RAM). The formatter adds no server-side load and no client-side latency — the Ubuntu machine is only serving the static bundle. There is no model to load, no inference queue, and no memory pressure from this step.

### Upgrade Paths

**Option A — In-browser LLM (no server, fully private)**

Replace the SOAP formatter with `@xenova/transformers` running `distilbart-cnn-6-6` in a Web Worker. The `generateAbstract()` signature stays identical. Tradeoffs: approximately 250 MB first-run model download cached in IndexedDB; 10–30 second inference time on consumer hardware; Quest browser WASM performance is uncertain and may exceed memory limits on the headset itself.

**Option B — Server-side GPT-4o**

POST the transcript to a backend endpoint that calls GPT-4o with a medical scribe system prompt. Returns a structured SOAP note with higher clinical fidelity. Tradeoffs: requires OpenAI API key and ongoing cost; transcript data leaves the device and requires HIPAA-compliant handling before use with any real patient data.

The current hybrid approach has no runtime cost, no latency, and no data risk, making it the correct choice for this mock test environment.

## Next Steps (Recommended)

1. Configure HTTPS in Vite using `mkcert` certificates for reliable Quest immersive-ar support.
2. Add a backend speech gateway that streams microphone audio to Google Cloud Speech-to-Text Medical using `medical_conversation`.
3. Keep Web Speech API only for short local commands such as UI navigation and HUD toggles.
4. Add transcript confidence filtering and noise handling for exam-room conditions.
5. SOAP-style visit note formatter implemented via the hybrid extractive approach — see Visit Summary Engine section above.
6. Add session export options (JSON/PDF/EMR-compatible payload).
7. Add runtime diagnostics dashboard for AR capability, mic permission, diarization latency, and API health.

## Ideal Experience Roadmap

- Enter room with glasses, launch AR passthrough HUD instantly.
- Onboarding transitions into live visit mode through natural speech.
- Conversation is captured continuously and attributed automatically to Doctor vs Patient.
- Vitals and context are fused into a live clinical assistant view without breaking eye contact.
- Ending simulation exports full transcript + clinician-ready summary with audit metadata.

## Project Status

Prototype is now in an integration-ready stage with onboarding, live HUD workflow, end-of-session export view, and API-ready speech/dictation scaffolding.

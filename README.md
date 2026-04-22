# MedARView

MedARView is a WebXR mockup for a medical smart-glasses heads-up display (HUD), designed to run in the Meta Quest Browser with AR passthrough.

The app overlays simulated clinical UI in 3D space using React, Three.js, and React Three XR.

## Current Features

- AR entry using immersive AR session support
- Camera-locked HUD panels for glanceable overlays
- Mock live vitals (blood pressure and SpO2) with periodic updates
- Voice dictation capture using browser speech recognition APIs
- Automatic Doctor/Patient attribution pipeline (API-first with local fallback)
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

## Speaker Attribution API Notes

The app now supports automatic speaker attribution through an external API endpoint.

- Environment variable:

```bash
VITE_SPEAKER_API_URL=https://your-api.example.com/diarize
```

- Request payload shape (sent by the app):
	- `utterance: string`
	- `conversationTail: Array<{ speaker, text, timestamp }>`
	- `previousSpeaker: 'Doctor' | 'Patient'`

- Expected response shape:
	- `speaker: 'Doctor' | 'Patient'`
	- `confidence: number` (0..1, optional)

If no API is configured or the endpoint is unavailable, the app falls back to local heuristic attribution in `src/speakerAttribution.js`.

## New Dependencies / Integrations To Consider

- Diarization + speaker-ID engine service (recommended for production quality)
- Optional in-browser summarization model (`@xenova/transformers`) for offline/local demos
- Optional secure backend (Express) for:
	- transcript persistence
	- abstract generation
	- visit export workflows
	- attribution API proxying

## Next Steps (Recommended)

1. Configure HTTPS in Vite using `mkcert` certificates for reliable Quest immersive-ar support.
2. Replace heuristic speaker fallback with a real diarization service and doctor voice enrollment flow.
3. Add transcript confidence filtering and noise handling for exam-room conditions.
4. Upgrade abstract generation to structured clinical output (SOAP-style summary).
5. Add session export options (JSON/PDF/EMR-compatible payload).
6. Add runtime diagnostics dashboard for AR capability, mic permission, diarization latency, and API health.

## Ideal Experience Roadmap

- Enter room with glasses, launch AR passthrough HUD instantly.
- Onboarding transitions into live visit mode through natural speech.
- Conversation is captured continuously and attributed automatically to Doctor vs Patient.
- Vitals and context are fused into a live clinical assistant view without breaking eye contact.
- Ending simulation exports full transcript + clinician-ready summary with audit metadata.

## Project Status

Prototype is now in an integration-ready stage with onboarding, live HUD workflow, end-of-session export view, and API-ready speaker attribution scaffolding.

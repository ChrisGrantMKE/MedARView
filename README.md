# MedARView

MedARView is a WebXR mockup for a medical smart-glasses heads-up display (HUD), designed to run in the Meta Quest Browser with AR passthrough.

The app overlays simulated clinical UI in 3D space using React, Three.js, and React Three XR.

## Current Features

- AR entry using immersive AR session support
- Camera-locked HUD panels for glanceable overlays
- Mock live vitals (blood pressure and SpO2) with periodic updates
- Voice dictation toggle using browser speech recognition APIs
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

## Project Status

Foundational prototype is in place. Next session can focus on HTTPS certificate wiring in Vite, interaction polish, and backend API swap-in points.

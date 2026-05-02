# Touched Files

## Desktop canvas / HUD layout fix (R3F host sizing)

- `src/App.css` — added `.app-canvas-host` so the WebGL canvas fills the viewport on Chrome/Edge
- `src/App.jsx` — apply `app-canvas-host` on the Canvas wrapper when not using invisible `landing-xr-bootstrap`

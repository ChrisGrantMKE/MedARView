# WebXR AR entry and exit (MedARView)

This document describes what runs when you **enter** immersive AR in MedARView and the full **cascade** when you **end simulation** in WebXR. It separates **application code** from **browser / WebXR / Meta Quest** behavior.

Implementation lives primarily in `src/App.jsx`, with supporting UI in `src/App.css`, the dom-overlay end bar, and `@react-three/xr` / `@pmndrs/xr`.

---

## 1. What starts up when you enter AR view

Entry begins when the user taps **Enter Medical AR HUD** (the `ARButton`). Before that, several systems are already running; the list below is ordered from **long-lived setup** to **immersive-session-specific** behavior.

### 1.1 Application bootstrap (before any AR session)

| What | Role |
|------|------|
| **Module-level `xrStore`** | `createXRStore({ offerSession: false, handTracking: true, layers: false, domOverlay: true })` in `App.jsx`. Builds the Zustand store used for session state, frame hooks, and dom-overlay root. `offerSession: false` means the runtime does not auto-start AR; the user must use `ARButton`. |
| **`navigator.xr` probe** | `useEffect` calling `navigator.xr.isSessionSupported('immersive-ar')` sets React state `arSupport` (checked / supported / reason). **Native:** WebXR API in Quest Browser. **App:** only reads the result and gates UI. |
| **React `App` tree** | Phases: `landing` → `onboarding` → `active` → `ended` (or `xr-exiting` during immersive teardown). Canvas visibility follows `showCanvas` (hidden on `landing`, `unsupported-mobile`, `ended`). |
| **`<Canvas>` (R3F)** | When `showCanvas` is true, React Three Fiber creates a WebGL context and scene. **Native:** browser WebGL; on Quest, the same context later attaches to XR via Three’s `WebXRManager`. |
| **`<XR store={xrStore}>`** | **App uses `@react-three/xr`.** On mount it calls `store.setWebXRManager(gl.xr)` so the pmndrs store drives the same `WebXRManager` as Three.js. Subscribes to session changes to swap R3F’s active camera between the normal perspective camera and `gl.xr.getCamera()` while immersive. |
| **`XrActiveSessionProbe`** | Every frame: `xrNativeSessionRef.current = gl.xr.getSession() ?? null`. **App:** keeps a ref aligned with Three’s session for exit paths. **Native:** `XRSession` from the browser once a session exists. |
| **Speech / dictation `useEffect`** | When phase is `active` and dictation is enabled, starts `SpeechRecognition`, updates mic state, conversation, captions, etc. **App:** Web Speech API usage. **Native:** browser implementation (varies by platform; Quest Browser may differ from desktop Chrome). |
| **Vitals interval** | `setInterval` randomizes demo vitals every 2s. Purely **app** logic. |

Until a session exists, `webxrImmersive` is false (`useSyncExternalStore` on `xrStore`’s `session`). The same `<XR>` tree can render **non-immersive** content (`SimulatedHUD`, onboarding) with no active `XRSession`.

### 1.2 User taps “Enter Medical AR HUD”

| Step | Implemented by | What happens |
|------|----------------|--------------|
| 1 | **`ARButton` (`@react-three/xr`)** | Renders a DOM `<button>`. On click: if `store` already has a `session`, it calls `session.end()`; otherwise it calls `store.enterXR('immersive-ar')` (AR mode). |
| 2 | **`@pmndrs/xr` session creation** | The store builds session init from options (`handTracking`, `layers: false`, `domOverlay: true`, etc.) and calls the **WebXR** `navigator.xr.requestSession('immersive-ar', init)`. **Native / framework:** browser negotiates features with the **Meta XR runtime** (passthrough, input, compositor). **App:** only supplies flags via `createXRStore`. |
| 3 | **Session granted** | Zustand `session` becomes non-null. **Native:** Quest OS / browser own the actual `XRSession` object and presentation to the headset. |
| 4 | **`XR` component session subscription** | When `session` transitions from null → non-null, R3F root state sets `camera: gl.xr.getCamera()`. **Three.js + WebXR:** stereo / immersive camera rig. **App:** no custom camera code beyond using `<XR>`. |
| 5 | **`webxrImmersive` true** | `arSupport.checked && arSupport.supported && xrSession != null`. React re-renders the immersive branch. |
| 6 | **Immersive scene content** | **Onboarding:** `OnboardingHUD` if phase is onboarding. **Active visit:** `WebXrSessionEndBar` (dom overlay), `XRActiveFallback` (3D HUD: `HudMenuPanel`, dictation panel, end button). |
| 7 | **`XRDomOverlay`** | For active phase, `WebXrSessionEndBar` wraps a real HTML button in `XRDomOverlay`, which portals into the **dom-overlay root** the session was requested with. **WebXR:** optional feature `dom-overlay`; **Quest Browser** composites that DOM layer in-headset. **App:** markup + CSS classes in `App.css`. |
| 8 | **Per-frame XR store hooks** | `<XR>` registers `useFrame` callbacks: `store.onBeforeFrame`, `store.onBeforeRender`, plus pointer / visibility integration from pmndrs. **Library:** session pose, input, layers handling. **App:** does not call these directly. |
| 9 | **`XRActiveFallback` `useFrame`** | Positions the HUD root group using `activeOffset` in camera space (aligned with onboarding demo-setup framing). **App-only** layout. |
| **`HudMenuPanel`** | Same component as 2D simulation: overlay toggle, backdrop, menu rows, drill textures. **App:** React + drei `useTexture`; interactions are R3F pointer events. |

### 1.3 What Meta Quest 3 / Quest Browser / WebXR own on entry

- **Requesting and granting** the immersive-ar session, **security** (HTTPS / secure context), and **feature support** (passthrough AR, hand tracking if enabled, dom-overlay if supported).
- **Compositor:** rendering the WebGL layer(s) in the headset, **passthrough** video, **reprojection**, and **boundary / guardian** UI when applicable.
- **Input:** hand/controller poses exposed through WebXR; pmndrs maps these into the scene.
- **Oxygen / system UI:** universal menu, recentering, browser chrome when exiting immersive presentation—these are **not** controlled by MedARView.

---

## 2. End simulation in WebXR: every trigger and cascade

Ending can be initiated from:

- The **dom-overlay** button **End simulation** (`WebXrSessionEndBar` → `handleEndSimulation`).
- The **3D** control in `XRActiveFallback` (rounded **END SIMULATION** hit target → same `handleEndSimulation`).
- Optionally the page **Exit AR** `ARButton` (calls `session.end()` via the library, but **does not** run `handleEndSimulation` by itself—so budget/speech cleanup and phase transitions are tied to the paths above).

Below is the cascade for **`handleEndSimulation`** when **`session != null`** and **`arSupport.supported`** (true WebXR immersive path).

### 2.1 Synchronous steps inside `handleEndSimulation` (app)

1. **`recognitionRef.current?.stop()`** (try/catch)  
   Stops Web Speech recognition if it was running.

2. **Speech budget**  
   If dictation is enabled and `sessionBudgetStartRef` is set, **`recordSpeechSession`**, **`setBudgetSnapshot`**, clear `sessionBudgetStartRef`.

3. **`setMicStatus('idle')`**  
   React state update for UI.

4. **Guards and refs**  
   - If no `session` (store and GL ref both null): **`goToEnded()`** → `setPhase('ended')` (non-immersive shortcut; unmounts canvas per `showCanvas`).  
   - If AR not supported flag path: same **`goToEnded()`**.  
   - If **`xrImmersiveExitBusyRef`** already true: **return** (avoid double exit wiring).

5. **`xrImmersiveExitBusyRef.current = true`**

6. **Schedule teardown helpers**  
   - **`scheduleDomExit`**: at most once—clears fail timer, sets **`xrImmersiveExitBusyRef` false**, then **`requestAnimationFrame` × 2**, then **`setTimeout(..., 320)`** → **`setPhase('ended')`**.  
   - **`nativeSession.addEventListener('end', scheduleDomExit, { once: true })`** where **`nativeSession = glSession ?? storeSession`** (prefer Three’s `gl.xr.getSession()`).  
   - **`failTimer = setTimeout(scheduleDomExit, 8000)`** if **`end`** never fires.

7. **`setPhase('xr-exiting')`**  
   React re-render while the XR session is still winding down.

8. **`nativeSession.end()`** (try/catch)  
   **WebXR:** asks the browser to end the session. **Native:** runtime begins tearing down immersive presentation.

### 2.2 Re-renders and UI triggered by `xr-exiting` (app)

- **`showCanvas`** stays **true** (`xr-exiting` is not `ended`), so **`<Canvas>` stays mounted**—avoids disposing WebGL while the compositor is still releasing the session (a known pain point on Quest).
- **Speech `useEffect`**: early return for `phase === 'xr-exiting'` or `ended`—does not start a new `SpeechRecognition` instance; **`rec.onend`** also avoids restarting when phase is `xr-exiting` / `ended`.
- **DOM overlay** (fixed): **`xr-exit-overlay`** in `main` (“Exiting AR…”).
- **Immersive dom-overlay**: **`XRDomOverlay`** with the same copy so in-headset DOM overlay users see the message if the feature is active.
- **3D content**: immersive branch no longer shows **`WebXrSessionEndBar`** / **`XRActiveFallback`** for active-only; with phase `xr-exiting`, only the exiting overlay may show inside XR (and **`XrActiveSessionProbe`** still runs inside `<XR>`).

### 2.3 When the native session actually ends (browser / WebXR + app reaction)

- The **`XRSession`** fires **`end`**.  
  **Native / WebXR:** session is invalid; compositor transitions back toward **inline** / **non-immersive** browser view.  
  **App:** **`scheduleDomExit`** runs (if not already run by timeout).

- **`scheduleDomExit`** → after two animation frames and **320 ms**, **`setPhase('ended')`**.

### 2.4 Phase `ended` (app)

- **`showCanvas`** becomes **false** → **`<Canvas>` unmounts** → R3F disposes the WebGL resource that was used for that page (timing is **after** delayed transition by design).
- **`SessionEndScreen`** mounts with **`key={sessionStartRef.current}`** (closing copy, then transcript / abstract).
- **`app-shell--landing`** class applies for layout.
- **AR controls** (`ARButton`, diagnostics) are hidden when phase is `ended` or `xr-exiting` (per JSX conditions).

### 2.5 Parallel path: `XR` store session → null

When the session ends, **`@react-three/xr`’s `<XR>`** subscription sees **`session` null** and restores R3F’s **`camera`** to the saved non-XR camera. **Library + Three.js** behavior; MedARView does not implement that subscription directly.

### 2.6 Summary table: who does what on exit

| Piece | Owner |
|-------|--------|
| `handleEndSimulation`, phases, overlays, speech/budget cleanup, `xrImmersiveExitBusyRef`, `xrNativeSessionRef` | **MedARView (`App.jsx`)** |
| `session.end()`, `XRSession` `end` event, dom-overlay API | **WebXR spec + Quest Browser implementation** |
| Passthrough off, compositor teardown, return to browser shell, guardian | **Meta Quest OS / runtime** (with browser in the middle) |
| `ARButton` / store `enterXR` / `session.end` wiring, `setWebXRManager`, per-frame `onBeforeFrame`, camera swap on session | **`@react-three/xr` / `@pmndrs/xr`** (app chooses store options) |
| Three.js `WebXRManager`, `gl.xr.getSession()`, render loop in XR | **Three.js** (used by R3F) |

### 2.7 Known product risk (why “menu but no exit” has been a theme)

If the **GPU / compositor** and **page** get out of sync—e.g. destroying the WebGL context **before** the session fully ends—Quest can show **black passthrough**, **boundary only**, or **missing controllers**. MedARView mitigates by **`xr-exiting`**, listening for **`end`**, and **delaying** `setPhase('ended')` so the canvas is not torn down immediately on **`session.end()`**. Residual issues may still be **browser or OS** bugs or limitations, not something the SPA can fully fix.

---

## 3. File map (quick reference)

| File / symbol | Purpose |
|----------------|---------|
| `src/App.jsx` — `xrStore`, `handleEndSimulation`, `XR`, `ARButton`, `XrActiveSessionProbe`, `WebXrSessionEndBar`, `XRActiveFallback` | Core WebXR lifecycle and HUD |
| `src/App.css` — `.xr-session-end-bar`, `.xr-exit-overlay` | Dom-overlay and exit messaging styles |
| `node_modules/@react-three/xr` — `createXRStore`, `XR`, `ARButton`, `XRDomOverlay` | Session + DOM overlay integration |
| `node_modules/@pmndrs/xr` (internals) | Session request, frame loop, store |

This document reflects the codebase as of the commit that introduced `EXIT.md`; re-read `App.jsx` after major refactors.

---

## 4. External references (community troubleshooting)

These are public threads and issues that describe **black screens, hangs, or bad teardown** when **entering or leaving** WebXR on Meta Quest (or similar), including cases that are **not app-specific**.

### Meta / Quest Browser

- [Meta Quest browser shows a black screen for some webxr apps in latest patch](https://communityforums.atmeta.com/t5/Quest-Development/Meta-Quest-browser-shows-a-black-screen-for-some-webxr-apps-in/td-p/1224303) — Quest Development forums; regression-style black screen after browser updates.
- [WebXR: Meta Quest Browser crashes when exiting VR or navigating link](https://communityforums.atmeta.com/t5/OpenXR-Development/WebXR-Meta-Quest-Browser-crashes-when-exiting-VR-or-navigating/td-p/1174627) — OpenXR / WebXR forum; problems when **exiting** immersive mode or navigating while in VR (includes `session.end()`).

### Three.js

- [Issue #31080 — When exiting a WebXR session with multiview enabled. Rendering is black.](https://github.com/mrdoob/three.js/issues/31080) — Black rendering after exit with **multiview**; discussion mentions **Quest OS** versions.
- [PR #31835 — XRManager: Reset XRWebGLBinding on session end](https://github.com/mrdoob/three.js/pull/31835) — Fixes stale **XRWebGLBinding** / projection layer state across session boundaries (related [issue #31821](https://github.com/mrdoob/three.js/issues/31821)).
- [How to exit a webxr session in Quest and return to browser?](https://discourse.threejs.org/t/how-to-exit-a-webxr-session-in-quest-and-return-to-browser/18933) — three.js forum; practical exit / return-to-2D discussion.

### pmndrs / React-XR

- [Issue #490 — WebXR Session Persists State When Re-entering AR Experience After Session End](https://github.com/pmndrs/xr/issues/490)
- [Issue #473 — "XRSpace and XRFrame sessions do not match" after end and restart](https://github.com/pmndrs/xr/issues/473)
- [Issue #494 — XRLayers causing InvalidStateError when leaving and reentering](https://github.com/pmndrs/xr/issues/494)
- [Issue #495 — Stale XRSpace during VR session re-entry](https://github.com/pmndrs/xr/issues/495)

### Spec / MDN

- [Starting up and shutting down a WebXR session](https://developer.mozilla.org/en-US/docs/Web/API/WebXR_Device_API/Startup_and_shutdown) (MDN)
- [`XRSession.end()`](https://developer.mozilla.org/en-US/docs/Web/API/XRSession/end) (MDN)

---

## 5. Research synthesis: fixes we have not tried vs. what might still hurt

This section ties the **references above** to **MedARView’s current code** (`src/App.jsx`, Three.js **^0.184.0**, `@react-three/xr` **^6.6.29**). It is **not** a guarantee that any one change fixes Quest; it is a prioritized experiment list.

### 5.1 Mitigations that appear in the wild and are **not** fully covered by our app

| Idea (from threads / issues) | Status in MedARView | Notes |
|------------------------------|---------------------|--------|
| **Avoid tearing down WebGL until the session is really dead** | **Partially** | We keep `<Canvas>` through `xr-exiting` and delay `ended`. We still **unmount the canvas** on `ended`; if 320 ms is too aggressive on some OS builds, try **longer delay** or **wait for `visibilitychange` / `window` focus** before unmount (experimental). |
| **Projection / XR GL binding cleanup (Three.js)** | **Relying on Three version** | [PR #31835](https://github.com/mrdoob/three.js/pull/31835) targets stale **`XRWebGLBinding`** after `end`. The project uses **three@^0.184.0**, which should include that class of fix—**stay on current Three** and watch release notes if black-screen-on-exit returns after an upgrade. |
| **Multiview off / avoid multiview-related exit bugs** | **Not explicitly toggled in app** | [three.js#31080](https://github.com/mrdoob/three.js/issues/31080) ties **multiview** to black rendering after exit on some Quest stacks. We do not set multiview in app code; if a future flag or default enables it, **disable multiview** for Quest testing. |
| **`layers: false` to reduce projection-layer teardown bugs** | **Already** | `createXRStore({ layers: false, … })` aligns with [pmndrs#494](https://github.com/pmndrs/xr/issues/494)-style **layer** invalidation reports. |
| **Single, consistent `session.end()` path** | **Partial gap** | **`Exit AR`** on `ARButton` calls **`session.end()`** via the library but **does not** run **`handleEndSimulation`** (no budget/speech/`xr-exiting` sequencing). If users exit that way, behavior may **diverge** from **End simulation**. **Worth trying:** wire **`Exit AR`** through the same handler, or hide **`ARButton`** while immersive so only in-flow exit runs. |
| **Dom-overlay A/B test** | **Not tried as isolation** | WebXR **dom-overlay** is a separate compositing path. [Meta forum threads](https://communityforums.atmeta.com/t5/Quest-Development/Meta-Quest-browser-shows-a-black-screen-for-some-webxr-apps-in/td-p/1224303) discuss **browser-wide** black screens for WebXR apps. **Experiment:** temporary **`domOverlay: false`** (lose **`WebXrSessionEndBar`** in-headset; rely on **3D END** or system exit) to see if the void **disappears**. |
| **Hand tracking / optional features off** | **Not tried** | We use **`handTracking: true`**. Extra features can widen teardown surface on buggy builds. **Experiment:** **`handTracking: false`** for a Quest-only build to see if exit stabilizes. |
| **pmndrs store / stale space guards** | **Library updates** | [pmndrs#473](https://github.com/pmndrs/xr/issues/473) / [#495](https://github.com/pmndrs/xr/issues/495) are mostly **frame / space** hygiene on **re-entry**; upgrading **`@react-three/xr` / `@pmndrs/xr`** may pick up fixes we do not implement ourselves. |
| **Browser / OS version** | **User environment** | Meta threads report **patch-level** regressions; sometimes the “fix” is **Quest Browser or OS update** (or reporting a repro to Meta). |

### 5.2 Things we **are** doing that **could** contribute to fragile exit (hypotheses)

| Area | Why it might matter |
|------|---------------------|
| **`domOverlay: true` + `XRDomOverlay` + fixed DOM overlay** | More layers and more React/DOM churn during **`xr-exiting`**; if the browser has a dom-overlay teardown bug, we are **on that path**. |
| **Immediate `recognitionRef.stop()` at start of `handleEndSimulation`** | Generally good for cleanup; on some browsers, **heavy main-thread work** right as **`session.end()`** fires might be worth **deferring** slightly (microtask)—**low confidence**, easy to A/B. |
| **Two `requestAnimationFrame` + 320 ms delay** | Tuned heuristically; **too short** → canvas disposed before compositor finishes; **too long** → bad UX. Worth logging **`end`** vs **`setPhase('ended')`** timings on device. |
| **Unmounting `<Canvas>` on `ended`** | Correct for SPA flow; still the **strongest** WebGL teardown. If issues persist, a **nuclear** test is **keep canvas mounted** on `ended` and only **hide** it with CSS (memory cost)—to see if disposal timing is the trigger. |
| **`Exit AR` without `handleEndSimulation`** | Can leave **phase** and **XR** out of sync from the path we tested most (End simulation / 3D button). |

### 5.3 Practical next experiments (ordered)

1. **`Exit AR`** → call **`handleEndSimulation`** (or block **`ARButton`** while immersive).  
2. **A/B: `domOverlay: false`** on Quest only; confirm whether black void is **overlay-related**.  
3. **A/B: `handTracking: false`**.  
4. **Increase post-`end` delay** (e.g. 500–800 ms) once, measure.  
5. **Bump `@react-three/xr` / `three`** on a branch and re-test exit (watch for [three.js#31080](https://github.com/mrdoob/three.js/issues/31080)-style regressions if multiview defaults change).  

Record outcomes in **Section 6** (checklist and log template) so the next session can continue without re-deriving the plan.

---

## 6. Troubleshooting playbook (resume here)

Use this section as the **single place** to continue exit/black-void work after a break. It turns Section 5 into an **ordered strategy** with clear success criteria and a lightweight log.

### 6.1 Goal and success criteria

**Goal:** Leaving immersive WebXR (from MedARView’s **End simulation** / **3D END** flow) reliably returns to a **normal Quest Browser 2D tab**, then shows **`SessionEndScreen`** without a long-lived **black compositor void** (guardian-only, no controllers, or frozen passthrough).

**Pass (one test session):**

- From **active** AR visit, trigger exit **three times** (mix of dom-overlay **End simulation** and **3D END** if both exist).
- Each time: within ~15 s you see the **browser UI** and the app’s **ended** flow (or an acceptable full-screen summary), without **force-quitting** the browser.

**Fail:** Any exit leaves **persistent black / void** until browser or headset recovery.

### 6.2 Baseline repro (always document)

Before changing code, capture:

| Field | Example |
|--------|---------|
| Headset | Quest 3 |
| OS build | Settings → System → Software update (note version) |
| Quest Browser version | Browser → … → About |
| URL | HTTPS dev URL or deployed origin |
| Entry | Enter Medical AR HUD → complete onboarding → Begin visit |
| Exit path used | Dom-overlay **End simulation** only / **3D END** only / **Exit AR** button |
| Dictation on/off | Per `VITE_*` / config |

### 6.3 Strategy order (do not skip ahead without a log entry)

Work **top to bottom**. For each step: implement on a **branch**, run the **baseline repro**, mark result, then proceed or roll back.

| Step | Action | Purpose | Result (fill in) |
|------|--------|---------|------------------|
| 0 | **Confirm current `main` behavior** | Establishes baseline | Pass / Fail — notes: |
| 1 | **Unify exit:** make **Exit AR** (`ARButton`) invoke **`handleEndSimulation`** (or hide **ARButton** while `xrSession != null`) so every exit runs the same **`xr-exiting` → `end` → delayed `ended`** path | Removes divergent **`session.end()`**-only teardown | |
| 2 | **A/B `domOverlay: false`** in `createXRStore` (and remove or gate **`WebXrSessionEndBar`** / **`XRDomOverlay`** for that build) | Isolates dom-overlay compositor bugs | |
| 3 | **`handTracking: false`** in `createXRStore` | Reduces optional XR features during teardown | |
| 4 | **Increase** `scheduleDomExit` delay (e.g. **320 → 600–800 ms**); optionally add **`visibilitychange`** / **`pageshow`** guard before `setPhase('ended')` | More time for compositor + inline transition | |
| 5 | **Defer** `recognitionRef.stop()` to **`queueMicrotask`** or next frame (one-line experiment) | Rule out main-thread contention with `session.end()` | |
| 6 | **Keep `<Canvas>` mounted** on `ended`: `showCanvas` true for `ended`, hide with CSS (`visibility: hidden` / zero size), unmount only after delay or on next navigation | Nuclear test: disposal timing vs black void | |
| 7 | **Dependency branch:** bump **`@react-three/xr`** / **`three`** to latest compatible; re-run full matrix | Picks up pmndrs / Three teardown fixes | |
| 8 | If still failing: **minimal repro** (empty scene + `session.end()` only) in a **throwaway HTML** or **glitch** demo; file **Meta** / **Chromium** feedback with build numbers | Proves browser/runtime vs app | |

### 6.4 Lightweight instrumentation (optional, remove before merge)

In `handleEndSimulation` / `scheduleDomExit`, temporary **`console.log`** with timestamps (`performance.now()`) for:

- start of `handleEndSimulation`
- `setPhase('xr-exiting')`
- `nativeSession.end()` called
- **`end`** event fired
- `setPhase('ended')`

On Quest Browser, use **remote debugging** (Chrome `chrome://inspect`) to read logs.

### 6.5 Decision hints

- If **Step 1** fixes void when users previously used **Exit AR**, the bug was **path divergence**, not compositor-only.
- If **Step 2** fixes void, prioritize **dom-overlay** workarounds (copy for “exit” in 3D only, or different overlay root pattern).
- If only **Step 6** fixes void, focus on **canvas lifecycle** and **ordering** relative to **`XRSession.end`**.
- If **nothing** changes, treat as **browser/OS** regression; capture **Step 8** minimal repro and **external links** in Section 4.

### 6.6 Changelog (maintainers)

Append a one-line note per meaningful experiment:

| Date | Step | Outcome |
|------|------|---------|
| | | |

---

*End of playbook — update Section 6.6 and the Result column in 6.3 as you go.*

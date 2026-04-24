# MedARView Ubuntu Deployment Runbook

This file is the Ubuntu-specific setup and deployment guide for MedARView.
Use it as the first-run checklist before exposing the app through your domain.

## 0) Security First (Do This Before Anything Else)

If a service-account key was ever pasted into chat, logs, screenshots, or shared files:

1. Go to Google Cloud Console -> IAM & Admin -> Service Accounts.
2. Open the service account used for speech.
3. Delete the exposed key.
4. Create a new JSON key.
5. Deploy only the new key to the Ubuntu server.

Never commit JSON credential keys to git.

## 1) Target Runtime Architecture

- Frontend: Vite build output (static files)
- Backend: Node gateway at `server/speechGateway.mjs`
- Speech provider: Google Cloud Speech-to-Text via service account key
- Public ingress: Cloudflare Tunnel + domain

Recommended routing through Cloudflare Tunnel:

- `https://xrcc2026.top` -> frontend service
- `https://xrcc2026.top/api/*` -> Node gateway service

## 2) Server Prerequisites (Ubuntu)

Install system packages:

```bash
sudo apt update
sudo apt install -y curl git ffmpeg
```

Install Node.js LTS (22.x example):

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node -v
npm -v
```

Optional but recommended:

```bash
sudo apt install -y build-essential
```

## 3) App Placement and Linux User

```bash
sudo useradd --system --create-home --shell /bin/bash medarview || true
sudo mkdir -p /opt/medarview
sudo chown -R medarview:medarview /opt/medarview
```

Deploy app code into `/opt/medarview/app`.

## 4) Install App Dependencies

From app root (`/opt/medarview/app`):

```bash
npm ci
```

This installs all dependencies already tracked by the app install files:

- `package.json`
- `package-lock.json`

Current runtime dependencies include:

- `@google-cloud/speech`
- `express`
- `ws`
- `fluent-ffmpeg`
- `react`
- `react-dom`
- `three`
- `@react-three/*`

Note: `fluent-ffmpeg` requires OS-level `ffmpeg` (installed in step 2).

## 5) Build Frontend

```bash
npm run build
```

For basic production preview testing:

```bash
npm run preview -- --host 0.0.0.0 --port 4173
```

## 6) Secrets and Environment Variables

Store credentials outside the repo:

```bash
sudo mkdir -p /opt/medarview/secrets
sudo chown -R medarview:medarview /opt/medarview/secrets
sudo chmod 700 /opt/medarview/secrets
```

Copy new Google key to:

- `/opt/medarview/secrets/google-speech.json`

Restrict key permissions:

```bash
sudo chown medarview:medarview /opt/medarview/secrets/google-speech.json
sudo chmod 600 /opt/medarview/secrets/google-speech.json
```

Create `/opt/medarview/app/.env.production`:

```env
GOOGLE_APPLICATION_CREDENTIALS=/opt/medarview/secrets/google-speech.json
MEDARVIEW_ENABLE_GOOGLE_SPEECH=true
MEDARVIEW_SPEECH_GATEWAY_PORT=8787
MEDARVIEW_GOOGLE_RECOGNIZER=projects/YOUR_PROJECT_NUMBER/locations/global/recognizers/YOUR_RECOGNIZER_ID
MEDARVIEW_GOOGLE_MODEL=latest_long
MEDARVIEW_SPEECH_LANGUAGE=en-US
MEDARVIEW_SPEECH_WS_PATH=/ws/stt
VITE_GATEWAY_URL=/api
```

Notes:

- `VITE_*` variables are compile-time variables for frontend builds.
- If you change `VITE_*`, rebuild with `npm run build`.
- Real-time STT is exposed at `wss://<domain>/api/ws/stt` when Cloudflare routes `/api/*` to the gateway.

## 7) Systemd Services

### 7.1 Gateway Service

Create `/etc/systemd/system/medarview-gateway.service`:

```ini
[Unit]
Description=MedARView Speech Gateway
After=network.target

[Service]
Type=simple
User=medarview
WorkingDirectory=/opt/medarview/app
EnvironmentFile=/opt/medarview/app/.env.production
ExecStart=/usr/bin/node /opt/medarview/app/server/speechGateway.mjs
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

### 7.2 Frontend Preview Service (simple option)

Create `/etc/systemd/system/medarview-frontend.service`:

```ini
[Unit]
Description=MedARView Frontend Preview
After=network.target

[Service]
Type=simple
User=medarview
WorkingDirectory=/opt/medarview/app
ExecStart=/usr/bin/npm run preview -- --host 127.0.0.1 --port 4173
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

Enable and start services:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now medarview-gateway.service
sudo systemctl enable --now medarview-frontend.service
```

Check status/logs:

```bash
sudo systemctl status medarview-gateway.service
sudo systemctl status medarview-frontend.service
journalctl -u medarview-gateway.service -f
journalctl -u medarview-frontend.service -f
```

## 8) Cloudflare Tunnel

Install cloudflared, authenticate, create tunnel, then configure ingress.

Example `config.yml`:

```yaml
tunnel: YOUR_TUNNEL_ID
credentials-file: /etc/cloudflared/YOUR_TUNNEL_ID.json

ingress:
  - hostname: xrcc2026.top
    service: http://127.0.0.1:4173
  - hostname: xrcc2026.top
    path: /api/*
    service: http://127.0.0.1:8787
  - service: http_status:404
```

Run and/or enable cloudflared service per Cloudflare docs.

## 9) Pre-Deployment Verification Checklist

From Ubuntu server:

```bash
curl -sS http://127.0.0.1:8787/health
curl -I http://127.0.0.1:4173
```

From outside via domain:

1. Open `https://xrcc2026.top`
2. Verify app loads.
3. Trigger an end-session save and verify files are created under:
   - `server/.data/visits/...`
4. Verify gateway health through domain path:
   - `https://xrcc2026.top/api/health`

## 10) What Is Different From Windows Local Testing

- No mkcert local LAN cert workflow required for production domain usage.
- No per-terminal PowerShell env var setup.
- Use systemd `EnvironmentFile` instead.
- Use Cloudflare/domain route, not `localhost` or LAN IP from Quest.

## 11) Update Policy For This File

When scripts, ports, env variables, gateway paths, or dependencies change, update this file in the same commit.

Minimum update checklist:

1. Update changed npm commands.
2. Update any new/removed env vars.
3. Update service files if ports or entrypoints changed.
4. Update Cloudflare ingress paths if API routes changed.
5. Update dependency notes if runtime requirements changed.

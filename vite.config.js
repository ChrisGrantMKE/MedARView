import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'

const certPath = path.resolve('certs/lan.crt')
const keyPath = path.resolve('certs/lan.key')
const useHttps = process.env.VITE_DEV_HTTPS === 'true'
const hmrHost = process.env.VITE_HMR_HOST
const hmrProtocol = process.env.VITE_HMR_PROTOCOL
const hmrClientPort = process.env.VITE_HMR_CLIENT_PORT
const hmrPort = process.env.VITE_HMR_PORT

const httpsConfig =
  useHttps && fs.existsSync(certPath) && fs.existsSync(keyPath)
    ? {
        cert: fs.readFileSync(certPath),
        key: fs.readFileSync(keyPath),
      }
    : undefined

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    https: httpsConfig,
    /**
     * Browser on Quest/phone hits `https://<LAN>:5173`; `fetch('http://localhost:8787')` targets the device,
     * not your PC. Proxy keeps save-visit + same-origin during dev.
     */
    proxy: {
      '/api/gateway': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/gateway/, ''),
      },
      '/api/gateway-ws': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
        ws: true,
        rewrite: (p) => p.replace(/^\/api\/gateway-ws/, ''),
      },
    },
    hmr: hmrHost
      ? {
          host: hmrHost,
          protocol: hmrProtocol || 'wss',
          clientPort: hmrClientPort ? Number(hmrClientPort) : 443,
          port: hmrPort ? Number(hmrPort) : 5173,
        }
      : undefined,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    https: httpsConfig,
    proxy: {
      '/api/gateway': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/gateway/, ''),
      },
      '/api/gateway-ws': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
        ws: true,
        rewrite: (p) => p.replace(/^\/api\/gateway-ws/, ''),
      },
    },
  },
})

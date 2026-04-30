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
  },
})

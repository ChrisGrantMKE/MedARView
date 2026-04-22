import { useEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { ARButton, XR, createXRStore } from '@react-three/xr'
import HUD from './HUD'
import './App.css'

const xrStore = createXRStore({
  customSessionInit: {
    requiredFeatures: ['local-floor'],
    optionalFeatures: ['hand-tracking', 'layers', 'dom-overlay'],
  },
})

const patientRecord = {
  id: 'PT-44812',
  name: 'R. Hernandez',
  age: 63,
  history:
    'Type II diabetes, HTN, prior NSTEMI (2021), admitted for dyspnea and edema.',
  aiAbstract:
    'Likely acute decompensated heart failure with elevated cardiopulmonary stress. Continue diuresis protocol, monitor oxygen trend, and reassess BNP/troponin in 6 hours.',
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

function App() {
  const [vitals, setVitals] = useState({
    systolic: 120,
    diastolic: 80,
    spo2: 98,
  })
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('Tap the mic to begin dictation.')
  const [speechSupported, setSpeechSupported] = useState(true)
  const recognitionRef = useRef(null)

  useEffect(() => {
    const interval = setInterval(() => {
      setVitals((prev) => {
        const nextSystolic = clamp(prev.systolic + (Math.random() > 0.5 ? 1 : -1) * (1 + Math.floor(Math.random() * 3)), 108, 132)
        const nextDiastolic = clamp(prev.diastolic + (Math.random() > 0.5 ? 1 : -1) * (1 + Math.floor(Math.random() * 2)), 70, 90)
        const nextSpO2 = clamp(prev.spo2 + (Math.random() > 0.6 ? 1 : -1), 94, 100)

        return {
          systolic: nextSystolic,
          diastolic: nextDiastolic,
          spo2: nextSpO2,
        }
      })
    }, 2000)

    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition

    if (!SpeechRecognition) {
      setSpeechSupported(false)
      setTranscript('Speech recognition is not available in this browser build.')
      return
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onresult = (event) => {
      let combined = ''

      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        combined += `${event.results[i][0].transcript} `
      }

      if (combined.trim()) {
        setTranscript(combined.trim())
      }
    }

    recognition.onerror = (event) => {
      setTranscript(`Dictation error: ${event.error}`)
      setIsListening(false)
    }

    recognition.onend = () => {
      setIsListening(false)
    }

    recognitionRef.current = recognition

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
      recognitionRef.current = null
    }
  }, [])

  const handleToggleListening = () => {
    if (!speechSupported || !recognitionRef.current) {
      return
    }

    if (isListening) {
      recognitionRef.current.stop()
      return
    }

    setTranscript('Listening...')
    recognitionRef.current.start()
    setIsListening(true)
  }

  return (
    <main className="app-shell">
      <div className="ar-controls">
        <ARButton className="ar-toggle" store={xrStore}>
          {(status) => {
            if (status === 'unsupported') return 'AR Unsupported'
            if (status === 'entered') return 'Exit AR'
            return 'Enter Medical AR HUD'
          }}
        </ARButton>
      </div>

      <Canvas camera={{ position: [0, 1.6, 0], fov: 60 }}>
        <XR store={xrStore}>
          <HUD
            vitals={vitals}
            isListening={isListening}
            transcript={transcript}
            speechSupported={speechSupported}
            onToggleListening={handleToggleListening}
            patient={patientRecord}
          />
        </XR>
      </Canvas>
    </main>
  )
}

export default App

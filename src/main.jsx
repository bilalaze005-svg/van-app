import React from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App.jsx'

// يسجّل Service Worker ويحدّثه تلقائياً بصمت عند توفر نسخة جديدة
registerSW({ immediate: true })

createRoot(document.getElementById('root')).render(<App />)

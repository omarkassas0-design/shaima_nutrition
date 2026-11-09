import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import { ThemeProvider } from 'next-themes'
import { setupPWA } from '@/lib/pwaSetup'

// Register service worker + fix manifest/theme-color (platform overrides HTML head)
setupPWA();

ReactDOM.createRoot(document.getElementById('root')).render(
  <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
    <App />
  </ThemeProvider>
)
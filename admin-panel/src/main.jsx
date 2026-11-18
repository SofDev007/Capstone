import React from 'react'
import ReactDOM from 'react-dom/client'
import { Toaster } from 'sonner'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
    <Toaster
      position="top-right"
      offset={{ top: 56, right: 20 }}
      closeButton
      theme="dark"
      toastOptions={{
        classNames: {
          toast: 'glass !bg-glass !border !border-glass-border !rounded-[18px] !shadow-lifted !font-sans !text-ink',
          error: '!bg-[rgba(60,10,22,.75)] !border-signal/60 [&_[data-title]]:!text-signal',
          warning: '!border-buff-ink/50 [&_[data-title]]:!text-buff-ink',
          description: '!text-[13.5px] !text-ink-soft',
          actionButton: '!bg-accent !text-deep !font-semibold !rounded-[10px]',
          closeButton: '!bg-raised !border-glass-border !text-ink'
        }
      }}
    />
  </React.StrictMode>,
)

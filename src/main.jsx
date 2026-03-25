import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Nuclear Error Handler: Catches errors that happen before React mounts
window.onerror = function (message, source, lineno, colno, error) {
  const errorDiv = document.createElement('div');
  errorDiv.style.color = 'red';
  errorDiv.style.padding = '20px';
  errorDiv.style.background = 'white';
  errorDiv.style.fontSize = '20px';
  errorDiv.style.zIndex = '9999';
  errorDiv.style.position = 'fixed';
  errorDiv.style.top = '0';
  errorDiv.style.left = '0';
  errorDiv.style.width = '100%';
  errorDiv.style.height = '100%';
  errorDiv.style.overflow = 'auto';
  errorDiv.innerHTML = `
    <h1>Startup Error</h1>
    <pre>${message}\nat ${source}:${lineno}:${colno}</pre>
    <div style="margin-top: 20px; padding: 20px; border: 1px solid #ccc; border-radius: 8px;">
        <h3>Emergency Recovery</h3>
        <p>If this error persists, try resetting the local data.</p>
        <button onclick="localStorage.clear(); window.location.reload();" style="padding: 10px 20px; background: red; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 16px;">
            ⚠️ Reset System & Reload
        </button>
    </div>
  `;
  document.body.appendChild(errorDiv);
};

try {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
} catch (e) {
  console.error("Mount Error:", e);
  document.body.innerHTML = `<div style="color:red;padding:20px;font-size:24px;"><h1>Mount Error</h1><pre>${e.toString()}</pre></div>`;
}

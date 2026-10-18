import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { initializeRealDataOnly } from './utils/forceRealDataConfig';
import logger from './utils/logger';

// Run DB validation silently in the background — does NOT block rendering
initializeRealDataOnly()
  .then(() => logger.log('✅ Background DB validation complete'))
  .catch(err => logger.warn('⚠️ Background DB validation warning:', err.message));

// Drop JSON-LD baked in by scripts/prerender.js; each page re-injects its own on mount.
document.querySelectorAll('[data-prerendered]').forEach(el => el.remove());

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

reportWebVitals();

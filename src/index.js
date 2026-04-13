import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { initializeRealDataOnly } from './utils/forceRealDataConfig';

// Run DB validation silently in the background — does NOT block rendering
initializeRealDataOnly()
  .then(() => console.log('✅ Background DB validation complete'))
  .catch(err => console.warn('⚠️ Background DB validation warning:', err.message));

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

reportWebVitals();

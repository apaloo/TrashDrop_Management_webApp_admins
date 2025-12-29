import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { initializeRealDataOnly, REQUIRED_TABLES, REQUIRED_FUNCTIONS } from './utils/forceRealDataConfig';
import { supabase } from './utils/supabase';
import DatabaseErrorDisplay from './components/DatabaseErrorDisplay';

// Application startup banner
console.log('🔒 STRICT DATABASE MODE ENABLED');
console.log('🚫 MOCK DATA DISABLED: Application will only use real Supabase data');
console.log('💾 Required database tables:', REQUIRED_TABLES.join(', '));
console.log('🎟 Required RPC functions:', REQUIRED_FUNCTIONS.join(', '));

/**
 * Initialize the application with strict database validation
 * Application will only start if ALL required database elements exist
 */
function ApplicationInitializer() {
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  const [schemaValidation, setSchemaValidation] = useState(null);

  useEffect(() => {
    async function startApplication() {
      try {
        console.log('🚀 Starting application with strict database validation...');
        
        // Initialize real data only mode - this will verify the database connection and schema
        const validationResult = await initializeRealDataOnly();
        setSchemaValidation(validationResult);
        
        console.log('✅ Database validation successful. Starting application with real data only.');
        setStatus('success');
      } catch (err) {
        console.error('❌ CRITICAL DATABASE ERROR:', err.message);
        setError(err);
        setStatus('error');
      }
    }

    startApplication();
  }, []);

  const handleRetry = () => {
    setStatus('loading');
    setError(null);
    window.location.reload();
  };

  // Show loading state
  if (status === 'loading') {
    return (
      <div className="loading-container" style={{
        padding: '20px',
        fontFamily: 'Arial, sans-serif',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh'
      }}>
        <h1>TrashDrop Admin Portal</h1>
        <p>Verifying database connection and schema...</p>
        <div className="loading-spinner" style={{
          width: '50px',
          height: '50px',
          border: '5px solid #f3f3f3',
          borderTop: '5px solid #3498db',
          borderRadius: '50%',
          margin: '20px auto',
          animation: 'spin 1s linear infinite'
        }}></div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // Show error state
  if (status === 'error') {
    return (
      <DatabaseErrorDisplay
        error={error}
        requiredTables={REQUIRED_TABLES}
        requiredFunctions={REQUIRED_FUNCTIONS}
        onRetry={handleRetry}
      />
    );
  }

  // Show the app when validation is successful
  return <App />;
}

async function initializeApplication() {
  const root = ReactDOM.createRoot(document.getElementById('root'));
  root.render(
    <React.StrictMode>
      <ApplicationInitializer />
    </React.StrictMode>
  );
}

// Start the application initialization process with React component-based error handling
initializeApplication();

// Report web vitals for performance monitoring
reportWebVitals();

import React from 'react';

/**
 * Component for displaying database validation errors
 * Shows detailed information about missing tables and functions
 */
const DatabaseErrorDisplay = ({ 
  error, 
  requiredTables = [], 
  requiredFunctions = [], 
  onRetry 
}) => {
  // Extract error details
  const errorMessage = error?.message || 'Unknown database connection error';
  const isConnectionError = errorMessage.includes('Failed to fetch') || 
                            errorMessage.includes('network') ||
                            errorMessage.includes('ERR_INTERNET_DISCONNECTED');
  
  const isMissingTableError = errorMessage.includes('table') && errorMessage.includes('not found');
  const isMissingFunctionError = errorMessage.includes('function') && errorMessage.includes('not found');
  
  return (
    <div className="database-error-container">
      <div className="error-card">
        <div className="error-header">
          <h1>
            <span className="error-icon">⚠️</span> 
            Database Connection Error
          </h1>
        </div>
        
        <div className="error-body">
          <div className="error-message">
            <h2>Critical Error:</h2>
            <p>{errorMessage}</p>
            
            {isConnectionError && (
              <div className="connection-help">
                <h3>Connection Issues</h3>
                <p>The application cannot connect to the Supabase database. Please check:</p>
                <ul>
                  <li>Your internet connection is working</li>
                  <li>The Supabase service is online</li>
                  <li>Environment variables are correctly configured</li>
                </ul>
              </div>
            )}
            
            {(isMissingTableError || isMissingFunctionError) && (
              <div className="schema-help">
                <h3>Missing Database Schema Elements</h3>
                <p>This application requires specific database tables and functions.</p>
              </div>
            )}
          </div>
          
          <div className="required-elements">
            <div className="required-tables">
              <h3>Required Tables</h3>
              {requiredTables.length === 0 ? (
                <p>No table requirements specified.</p>
              ) : (
                <ul>
                  {requiredTables.map(table => (
                    <li key={table}>{table}</li>
                  ))}
                </ul>
              )}
            </div>
            
            <div className="required-functions">
              <h3>Required Functions</h3>
              {requiredFunctions.length === 0 ? (
                <p>No function requirements specified.</p>
              ) : (
                <ul>
                  {requiredFunctions.map(func => (
                    <li key={func}>{func}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          
          <div className="error-footer">
            <p>
              <strong>Note:</strong> The TrashDrop Admin Portal is configured in strict real-data-only mode.
              Mock data fallbacks are completely disabled, and the application requires all database elements to be properly configured.
            </p>
            
            <button className="retry-button" onClick={onRetry}>
              <span className="retry-icon">🔄</span> Try Again
            </button>
          </div>
        </div>
      </div>
      
      <style jsx>{`
        .database-error-container {
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          background-color: #f8f9fa;
          padding: 20px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
        }
        
        .error-card {
          background-color: white;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          max-width: 800px;
          width: 100%;
          overflow: hidden;
        }
        
        .error-header {
          background-color: #e63946;
          color: white;
          padding: 16px 24px;
        }
        
        .error-header h1 {
          margin: 0;
          font-size: 24px;
          display: flex;
          align-items: center;
        }
        
        .error-icon {
          margin-right: 12px;
          font-size: 28px;
        }
        
        .error-body {
          padding: 24px;
        }
        
        .error-message {
          margin-bottom: 24px;
          padding-bottom: 24px;
          border-bottom: 1px solid #e9ecef;
        }
        
        .error-message h2 {
          color: #e63946;
          margin-top: 0;
          font-size: 20px;
        }
        
        .error-message p {
          color: #343a40;
          font-size: 16px;
          line-height: 1.5;
          margin-bottom: 16px;
        }
        
        .required-elements {
          display: flex;
          gap: 24px;
          margin-bottom: 24px;
        }
        
        .required-tables,
        .required-functions {
          flex: 1;
        }
        
        .required-elements h3 {
          color: #343a40;
          font-size: 18px;
          margin-top: 0;
        }
        
        .required-elements ul {
          background-color: #f8f9fa;
          border-radius: 4px;
          padding: 16px 16px 16px 36px;
          margin: 0;
        }
        
        .required-elements li {
          margin-bottom: 8px;
          font-family: monospace;
          font-size: 14px;
        }
        
        .error-footer {
          margin-top: 24px;
          padding-top: 24px;
          border-top: 1px solid #e9ecef;
          text-align: center;
        }
        
        .retry-button {
          background-color: #1e88e5;
          color: white;
          border: none;
          border-radius: 4px;
          padding: 12px 24px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          margin-top: 16px;
          display: inline-flex;
          align-items: center;
          transition: background-color 0.2s;
        }
        
        .retry-button:hover {
          background-color: #1565c0;
        }
        
        .retry-icon {
          margin-right: 8px;
          font-size: 18px;
        }
        
        @media (max-width: 768px) {
          .required-elements {
            flex-direction: column;
          }
        }
      `}</style>
    </div>
  );
};

export default DatabaseErrorDisplay;

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { resetPassword } from '../utils/auth';
import AuthShell, { AUTH } from '../components/auth/AuthShell';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);
    
    try {
      const { error } = await resetPassword(email);
      if (error) throw error;
      setSuccess(true);
    } catch (err) {
      setError(err.message || 'Failed to send password reset email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Reset your password" subtitle="Enter your email and we'll send you a reset link">
      {error && (
        <div role="alert" className={`${AUTH.alertError} flex`}>
          <i className="fas fa-exclamation-circle mt-0.5" aria-hidden="true"></i>
          <p className="ml-3">{error}</p>
        </div>
      )}

      {success ? (
        <>
          <div role="status" className={`${AUTH.alertSuccess} flex`}>
            <i className="fas fa-check-circle mt-0.5" aria-hidden="true"></i>
            <p className="ml-3">Password reset email sent! Check your inbox for instructions.</p>
          </div>
          <p className="text-center text-sm">
            <Link to="/login" className={AUTH.link}>Back to login</Link>
          </p>
        </>
      ) : (
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="email-address" className={AUTH.label}>Email address</label>
            <div className="relative">
              <div className={AUTH.inputIcon}>
                <i className="fas fa-envelope" aria-hidden="true"></i>
              </div>
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={AUTH.input(false)}
                placeholder="you@example.com"
              />
            </div>
          </div>

          <button type="submit" disabled={loading} className={`${AUTH.primary} w-full`}>
            <i className={`fas ${loading ? 'fa-circle-notch fa-spin' : 'fa-paper-plane'}`} aria-hidden="true"></i>
            {loading ? 'Sending...' : 'Send reset link'}
          </button>

          <p className="text-center text-sm text-td-sage">
            Remember your password?{' '}
            <Link to="/login" className={AUTH.link}>Back to login</Link>
          </p>
        </form>
      )}
    </AuthShell>
  );
};

export default ForgotPassword;

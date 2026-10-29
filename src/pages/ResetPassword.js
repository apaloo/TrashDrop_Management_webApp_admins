import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { updatePassword } from '../utils/auth';
import { useAuth } from '../context/AuthContext';
import AuthShell, { AUTH } from '../components/auth/AuthShell';

const ResetPassword = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { clearForceResetMode } = useAuth();

  // Parse hash from URL to get the access token
  useEffect(() => {
    // The hash fragment will be available in location.hash
    // If there's no hash, that means the user didn't arrive here from a reset email link
    if (!location.hash && !window.location.hash) {
      setError('Invalid password reset link. Please request a new one.');
    }

    return () => {
      clearForceResetMode();
    };
  }, [location]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Basic validation
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      // The hash contains the access token needed for the password update
      const { error } = await updatePassword(password);
      if (error) throw error;
      setSuccess(true);
      clearForceResetMode();
      
      // Redirect to login after some delay
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (err) {
      setError(err.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  const field = (id, label, value, setValue, placeholder) => (
    <div>
      <label htmlFor={id} className={AUTH.label}>{label}</label>
      <div className="relative">
        <div className={AUTH.inputIcon}>
          <i className="fas fa-lock" aria-hidden="true"></i>
        </div>
        <input
          id={id}
          name={id}
          type="password"
          autoComplete="new-password"
          required
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className={AUTH.input(false)}
          placeholder={placeholder}
        />
      </div>
    </div>
  );

  return (
    <AuthShell title="Reset your password" subtitle="Enter your new password below">
      {error && (
        <div role="alert" className={`${AUTH.alertError} flex`}>
          <i className="fas fa-exclamation-circle mt-0.5" aria-hidden="true"></i>
          <p className="ml-3">{error}</p>
        </div>
      )}

      {success ? (
        <div role="status" className={`${AUTH.alertSuccess} flex`}>
          <i className="fas fa-check-circle mt-0.5" aria-hidden="true"></i>
          <p className="ml-3">Password reset successful! You'll be redirected to the login page shortly.</p>
        </div>
      ) : (
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            {field('password', 'New password', password, setPassword, 'At least 8 characters')}
            {field('confirm-password', 'Confirm password', confirmPassword, setConfirmPassword, 'Type it again')}
          </div>

          <button
            type="submit"
            disabled={loading || error === 'Invalid password reset link. Please request a new one.'}
            className={`${AUTH.primary} w-full`}
          >
            <i className={`fas ${loading ? 'fa-circle-notch fa-spin' : 'fa-lock'}`} aria-hidden="true"></i>
            {loading ? 'Resetting...' : 'Reset password'}
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

export default ResetPassword;

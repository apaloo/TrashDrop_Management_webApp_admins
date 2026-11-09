import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { updatePassword, signOut } from '../utils/auth';
import { useAuth } from '../context/AuthContext';
import AuthShell, { AUTH } from '../components/auth/AuthShell';

const INVALID_LINK = 'This reset link is invalid or has expired. Please request a new one and open it in the browser you requested it from.';

const ResetPassword = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();
  const { clearForceResetMode, isAuthenticated, forceResetMode } = useAuth();
  const linkIsValid = isAuthenticated && forceResetMode;

  // A working link has signed the person in for this reset. Without that
  // session (expired link, or opened in another browser) no password can be set.
  useEffect(() => {
    if (!linkIsValid && !success) setError(INVALID_LINK);
  }, [linkIsValid, success]);

  // Leaving without a new password ends the sign-in the link created
  const handleBackToLogin = () => {
    if (isAuthenticated) signOut();
  };

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
      const { error } = await updatePassword(password);
      if (error) throw error;
      setSuccess(true);

      // Sign out so the next step is a login with the new password
      const { error: signOutError } = await signOut();
      if (signOutError) clearForceResetMode();

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
            disabled={loading || !linkIsValid}
            className={`${AUTH.primary} w-full`}
          >
            <i className={`fas ${loading ? 'fa-circle-notch fa-spin' : 'fa-lock'}`} aria-hidden="true"></i>
            {loading ? 'Resetting...' : 'Reset password'}
          </button>

          <p className="text-center text-sm text-td-sage">
            Remember your password?{' '}
            <Link to="/login" onClick={handleBackToLogin} className={AUTH.link}>Back to login</Link>
          </p>
        </form>
      )}
    </AuthShell>
  );
};

export default ResetPassword;

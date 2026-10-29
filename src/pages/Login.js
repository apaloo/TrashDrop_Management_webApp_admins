import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signIn } from '../utils/auth';
import { useAuth } from '../context/AuthContext';
import logger from '../utils/logger';
import AuthShell, { AUTH, AuthDivider } from '../components/auth/AuthShell';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [validationErrors, setValidationErrors] = useState({});
  const navigate = useNavigate();
  const { refreshAuthState } = useAuth();
  
  useEffect(() => {
    // Check if user has saved email in localStorage
    const savedEmail = localStorage.getItem('trashdrop_remembered_email');
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  const validateForm = () => {
    const errors = {};
    
    if (!email) {
      errors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      errors.email = 'Email is invalid';
    }
    
    if (!password) {
      errors.password = 'Password is required';
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    
    // Client-side validation
    if (!validateForm()) return;
    
    setLoading(true);
    
    try {
      logger.log('Attempting to sign in');
      const { data, error } = await signIn({ email, password });
      
      if (error) {
        console.error('Login error:', error);
        throw error;
      }
      
      logger.log('Sign in successful:', data ? 'User authenticated' : 'No data returned');
      
      // Handle remember me functionality
      if (rememberMe) {
        localStorage.setItem('trashdrop_remembered_email', email);
      } else {
        localStorage.removeItem('trashdrop_remembered_email');
      }
      
      // Store session token and auth flags in localStorage
      const session = data?.session;
      if (session?.access_token) {
        localStorage.setItem('trashdrop_authenticated', 'true');
        localStorage.setItem('trashdrop_session_active', 'true');
        
        // Also check and set onboarding status
        const onboardingCompleted = data.user?.user_metadata?.onboardingCompleted || false;
        localStorage.setItem('trashdrop_onboarding_completed', onboardingCompleted.toString());
        
        logger.log('Authentication data stored');
        
        // Explicitly refresh the auth context state
        await refreshAuthState();
        
        logger.log('Auth state refreshed, redirecting to dashboard...');
        // Use a slightly longer timeout to ensure state updates are processed
        // and context values have propagated to components
        setTimeout(() => {
          navigate('/dashboard');
        }, 300);
      } else {
        // If no session token but auth succeeded, still try to redirect
        logger.log('No session token found, but auth succeeded. Redirecting anyway.');
        navigate('/dashboard');
      }
      
    } catch (err) {
      console.error('Login error details:', err);
      if (err.message && err.message.includes('Email not confirmed')) {
        setError('⚠️ Email Verification Required: Please check your email inbox and click the verification link we sent you. If you cannot find it, check your spam folder or contact support.');
      } else if (err.message && err.message.includes('credentials')) {
        setError('❌ Login Failed: Invalid email or password. If you just signed up, please verify your email first by clicking the link sent to your inbox.');
      } else if (err.message && err.message.includes('Invalid login')) {
        setError('❌ Login Failed: Invalid credentials. If you recently created an account, please verify your email address first by clicking the verification link sent to your inbox.');
      } else {
        setError(err.message || 'Failed to sign in. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to manage your waste collection operations">
      {error && (
        <div role="alert" className={`${AUTH.alertError} flex`}>
          <i className="fas fa-exclamation-circle mt-0.5" aria-hidden="true"></i>
          <p className="ml-3">{error}</p>
        </div>
      )}

      <form className="space-y-5" onSubmit={handleSubmit}>
        <div className="space-y-4">
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
                className={AUTH.input(validationErrors.email)}
                placeholder="you@example.com"
              />
            </div>
            {validationErrors.email && (
              <p className={AUTH.fieldError}>{validationErrors.email}</p>
            )}
          </div>
          <div>
            <label htmlFor="password" className={AUTH.label}>Password</label>
            <div className="relative">
              <div className={AUTH.inputIcon}>
                <i className="fas fa-lock" aria-hidden="true"></i>
              </div>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={AUTH.input(validationErrors.password)}
                placeholder="Enter your password"
              />
            </div>
            {validationErrors.password && (
              <p className={AUTH.fieldError}>{validationErrors.password}</p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 text-sm">
          <div className="flex items-center">
            <input
              id="remember-me"
              name="remember-me"
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className={AUTH.checkbox}
            />
            <label htmlFor="remember-me" className="ml-2 block text-td-sage">
              Remember me
            </label>
          </div>
          <Link to="/forgot-password" className={AUTH.link}>
            Forgot password?
          </Link>
        </div>

        <button type="submit" disabled={loading} className={`${AUTH.primary} w-full`}>
          <i className={`fas ${loading ? 'fa-circle-notch fa-spin' : 'fa-arrow-right-to-bracket'}`} aria-hidden="true"></i>
          {loading ? 'Signing in...' : 'Sign in'}
        </button>

        <AuthDivider>or</AuthDivider>

        <p className="text-center text-sm text-td-sage">
          Don't have an account?{' '}
          <Link to="/signup" className={AUTH.link}>
            Create account
          </Link>
        </p>
      </form>
    </AuthShell>
  );
};

export default Login;

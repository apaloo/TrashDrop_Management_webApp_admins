import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signIn } from '../utils/auth';
import { useAuth } from '../context/AuthContext';

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
      console.log('Attempting to sign in with:', { email });
      const { data, error } = await signIn({ email, password });
      
      if (error) {
        console.error('Login error:', error);
        throw error;
      }
      
      console.log('Sign in successful:', data ? 'User authenticated' : 'No data returned');
      
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
        
        console.log('Authentication data stored');
        
        // Explicitly refresh the auth context state
        await refreshAuthState();
        
        console.log('Auth state refreshed, redirecting to dashboard...');
        // Use a slightly longer timeout to ensure state updates are processed
        // and context values have propagated to components
        setTimeout(() => {
          navigate('/dashboard');
        }, 300);
      } else {
        // If no session token but auth succeeded, still try to redirect
        console.log('No session token found, but auth succeeded. Redirecting anyway.');
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
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      {/* Full-bleed background image */}
      <div className="absolute inset-0">
        <img src="/images/auth-bg.jpg" alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-br from-black/70 via-green-900/60 to-black/70"></div>
      </div>
      {/* Subtle pattern overlay */}
      <div className="absolute inset-0 opacity-5" style={{
        backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.4) 1px, transparent 0)',
        backgroundSize: '32px 32px',
      }}></div>

      {/* Top bar */}
      <div className="relative z-10 w-full px-4 sm:px-8 pt-6">
        <Link to="/" className="inline-flex items-center text-white/70 hover:text-white transition-colors text-sm font-medium group">
          <i className="fas fa-arrow-left mr-2 group-hover:-translate-x-1 transition-transform"></i>
          Back to Home
        </Link>
      </div>

      {/* Card */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-md w-full bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 p-8 sm:p-10">
          {/* Logo & heading */}
          <div className="text-center mb-8">
            <Link to="/" className="inline-flex items-center justify-center group">
              <img src="/logo.svg" alt="TrashDrop Logo" className="h-16 w-16 transition-transform group-hover:scale-105" />
            </Link>
            <h2 className="mt-5 text-2xl font-bold text-gray-900">
              Welcome back
            </h2>
            <p className="mt-1.5 text-sm text-gray-500">
              Sign in to manage your waste collection operations
            </p>
          </div>
          
          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded-r-lg">
              <div className="flex">
                <div className="flex-shrink-0">
                  <i className="fas fa-exclamation-circle text-red-500"></i>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
            </div>
          )}
          
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <label htmlFor="email-address" className="block text-sm font-medium text-gray-700 mb-1.5">Email address</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <i className="fas fa-envelope text-gray-400 text-sm"></i>
                  </div>
                  <input
                    id="email-address"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={`block w-full pl-10 pr-3 py-2.5 border ${
                      validationErrors.email ? 'border-red-500 ring-1 ring-red-500' : 'border-gray-300'
                    } rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 sm:text-sm transition-colors`}
                    placeholder="you@example.com"
                  />
                </div>
                {validationErrors.email && (
                  <p className="text-red-500 text-xs mt-1.5">{validationErrors.email}</p>
                )}
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <i className="fas fa-lock text-gray-400 text-sm"></i>
                  </div>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`block w-full pl-10 pr-3 py-2.5 border ${
                      validationErrors.password ? 'border-red-500 ring-1 ring-red-500' : 'border-gray-300'
                    } rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 sm:text-sm transition-colors`}
                    placeholder="Enter your password"
                  />
                </div>
                {validationErrors.password && (
                  <p className="text-red-500 text-xs mt-1.5">{validationErrors.password}</p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-600">
                  Remember me
                </label>
              </div>

              <div className="text-sm">
                <Link to="/forgot-password" className="font-medium text-green-600 hover:text-green-500 transition-colors">
                  Forgot password?
                </Link>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-semibold rounded-xl text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-green-600/25 hover:shadow-green-600/40"
              >
                {loading ? (
                  <i className="fas fa-circle-notch fa-spin mr-2"></i>
                ) : (
                  <i className="fas fa-arrow-right-to-bracket mr-2"></i>
                )}
                {loading ? 'Signing in...' : 'Sign in'}
              </button>
            </div>
            
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200"></div>
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-3 bg-white text-gray-400">or</span>
              </div>
            </div>
            
            <div className="text-center">
              <p className="text-sm text-gray-500">
                Don't have an account?{' '}
                <Link to="/signup" className="font-semibold text-green-600 hover:text-green-500 transition-colors">
                  Create account
                </Link>
              </p>
            </div>
          </form>
        </div>
      </div>

      {/* Bottom brand line */}
      <div className="relative z-10 text-center pb-6">
        <p className="text-xs text-white/30">
          Trash<span className="text-green-400/50">Drop</span> &mdash; Real-time environmental intelligence
        </p>
      </div>
    </div>
  );
};

export default Login;

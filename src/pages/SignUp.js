import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signUp } from '../utils/auth';

const SignUp = () => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [companyType, setCompanyType] = useState('');
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [validationErrors, setValidationErrors] = useState({});
  const [passwordStrength, setPasswordStrength] = useState(0); // 0-4 scale
  const navigate = useNavigate();
  
  // Password strength criteria
  const strengthLabels = ['Very Weak', 'Weak', 'Medium', 'Strong', 'Very Strong'];
  const strengthColors = ['red', 'orange', 'yellow', 'light-green', 'green'];

  useEffect(() => {
    // Check password strength whenever password changes
    checkPasswordStrength(password);
  }, [password]);

  const checkPasswordStrength = (pass) => {
    let score = 0;
    
    // Length check
    if (pass.length >= 8) score += 1;
    
    // Contains uppercase
    if (/[A-Z]/.test(pass)) score += 1;
    
    // Contains number
    if (/[0-9]/.test(pass)) score += 1;
    
    // Contains special character
    if (/[^A-Za-z0-9]/.test(pass)) score += 1;
    
    setPasswordStrength(score);
  };

  const validateForm = () => {
    const errors = {};
    
    if (!firstName.trim()) errors.firstName = 'First name is required';
    if (!lastName.trim()) errors.lastName = 'Last name is required';
    
    if (!email) {
      errors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      errors.email = 'Email is invalid';
    }
    
    if (!password) {
      errors.password = 'Password is required';
    } else if (password.length < 8) {
      errors.password = 'Password must be at least 8 characters';
    } else if (passwordStrength < 2) {
      errors.password = 'Password is too weak';
    }
    
    if (!confirmPassword) {
      errors.confirmPassword = 'Please confirm your password';
    } else if (password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }
    
    if (!companyName.trim()) errors.companyName = 'Company name is required';
    if (!companyType) errors.companyType = 'Company type is required';
    if (!agreeToTerms) errors.agreeToTerms = 'You must agree to the terms of service';
    
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
      const { data, error } = await signUp({ 
        email, 
        password,
        name: `${firstName} ${lastName}`,
        role: 'user', // Default role
        metadata: {
          firstName,
          lastName,
          companyName,
          companyType,
          onboardingCompleted: false // Will be set to true after onboarding
        }
      });
      
      if (error) throw error;
      
      // Store user info for onboarding in localStorage
      localStorage.setItem('trashdrop_onboarding_user', JSON.stringify({
        email,
        firstName,
        lastName,
        companyName,
        companyType
      }));
      
      // Navigate to onboarding
      navigate('/onboarding');
    } catch (err) {
      if (err.message.includes('email')) {
        setError('An account with this email already exists');
      } else {
        setError(err.message || 'Failed to sign up');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-tr from-green-50 to-emerald-100 px-4 sm:px-6 lg:px-8 py-10">
      <div className="max-w-2xl w-full space-y-6 bg-white p-10 rounded-xl shadow-xl border border-gray-100">
        <div>
          <div className="flex justify-center">
            <img src="/logo.svg" alt="TrashDrop Logo" className="h-24 w-24" />
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Create your account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Join TrashDrop Management Portal to streamline your waste management operations
          </p>
        </div>
        
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4">
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
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="first-name" className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                <input
                  id="first-name"
                  name="first-name"
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className={`appearance-none block w-full px-3 py-2 border ${validationErrors.firstName ? 'border-red-500' : 'border-gray-300'} rounded-md focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm`}
                  placeholder="First Name"
                />
                {validationErrors.firstName && (
                  <p className="text-red-500 text-xs mt-1">{validationErrors.firstName}</p>
                )}
              </div>
              <div>
                <label htmlFor="last-name" className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                <input
                  id="last-name"
                  name="last-name"
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className={`appearance-none block w-full px-3 py-2 border ${validationErrors.lastName ? 'border-red-500' : 'border-gray-300'} rounded-md focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm`}
                  placeholder="Last Name"
                />
                {validationErrors.lastName && (
                  <p className="text-red-500 text-xs mt-1">{validationErrors.lastName}</p>
                )}
              </div>
            </div>
            
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email address</label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`appearance-none block w-full px-3 py-2 border ${validationErrors.email ? 'border-red-500' : 'border-gray-300'} rounded-md focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm`}
                placeholder="Email address"
              />
              {validationErrors.email && (
                <p className="text-red-500 text-xs mt-1">{validationErrors.email}</p>
              )}
            </div>
            
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`appearance-none block w-full px-3 py-2 border ${validationErrors.password ? 'border-red-500' : 'border-gray-300'} rounded-md focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm`}
                placeholder="Password"
              />
              {password && (
                <div className="mt-1">
                  <div className="flex space-x-1 h-1 mt-1">
                    {[0, 1, 2, 3].map((index) => (
                      <div 
                        key={index}
                        className={`h-full w-1/4 rounded-sm ${index < passwordStrength ? `bg-${strengthColors[passwordStrength]}-500` : 'bg-gray-200'}`}
                      />
                    ))}
                  </div>
                  <p className={`text-xs mt-1 text-${strengthColors[passwordStrength]}-500`}>
                    {strengthLabels[passwordStrength]}
                  </p>
                </div>
              )}
              {validationErrors.password && (
                <p className="text-red-500 text-xs mt-1">{validationErrors.password}</p>
              )}
            </div>
            
            <div>
              <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
              <input
                id="confirm-password"
                name="confirm-password"
                type="password"
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={`appearance-none block w-full px-3 py-2 border ${validationErrors.confirmPassword ? 'border-red-500' : 'border-gray-300'} rounded-md focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm`}
                placeholder="Confirm Password"
              />
              {validationErrors.confirmPassword && (
                <p className="text-red-500 text-xs mt-1">{validationErrors.confirmPassword}</p>
              )}
            </div>

            <div className="border-t border-gray-200 pt-4">
              <h3 className="text-md font-medium text-gray-700">Company Information</h3>
              
              <div className="mt-3">
                <label htmlFor="company-name" className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
                <input
                  id="company-name"
                  name="company-name"
                  type="text"
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className={`appearance-none block w-full px-3 py-2 border ${validationErrors.companyName ? 'border-red-500' : 'border-gray-300'} rounded-md focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm`}
                  placeholder="Company Name"
                />
                {validationErrors.companyName && (
                  <p className="text-red-500 text-xs mt-1">{validationErrors.companyName}</p>
                )}
              </div>
              
              <div className="mt-3">
                <label htmlFor="company-type" className="block text-sm font-medium text-gray-700 mb-1">Company Type</label>
                <select
                  id="company-type"
                  name="company-type"
                  required
                  value={companyType}
                  onChange={(e) => setCompanyType(e.target.value)}
                  className={`block w-full px-3 py-2 border ${validationErrors.companyType ? 'border-red-500' : 'border-gray-300'} rounded-md focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm`}
                >
                  <option value="">Select Company Type</option>
                  <option value="waste_management">Waste Management</option>
                  <option value="recycling">Recycling</option>
                  <option value="municipality">Municipality</option>
                  <option value="nonprofit">Non-Profit Organization</option>
                  <option value="other">Other</option>
                </select>
                {validationErrors.companyType && (
                  <p className="text-red-500 text-xs mt-1">{validationErrors.companyType}</p>
                )}
              </div>
            </div>
            
            <div className="flex items-start mt-4">
              <div className="flex items-center h-5">
                <input
                  id="agree-terms"
                  name="agree-terms"
                  type="checkbox"
                  checked={agreeToTerms}
                  onChange={(e) => setAgreeToTerms(e.target.checked)}
                  className={`h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded ${validationErrors.agreeToTerms ? 'border-red-500' : ''}`}
                />
              </div>
              <div className="ml-3 text-sm">
                <label htmlFor="agree-terms" className="font-medium text-gray-700">
                  I agree to the <a href="/terms" className="text-green-600 hover:text-green-500">Terms of Service</a> and <a href="/privacy" className="text-green-600 hover:text-green-500">Privacy Policy</a>
                </label>
                {validationErrors.agreeToTerms && (
                  <p className="text-red-500 text-xs mt-1">{validationErrors.agreeToTerms}</p>
                )}
              </div>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="absolute left-0 inset-y-0 flex items-center pl-3">
                  <i className="fas fa-circle-notch fa-spin"></i>
                </span>
              ) : (
                <span className="absolute left-0 inset-y-0 flex items-center pl-3">
                  <i className="fas fa-user-plus"></i>
                </span>
              )}
              {loading ? 'Creating account...' : 'Sign up'}
            </button>
          </div>
          
          <div className="text-center">
            <p className="text-sm text-gray-600">
              Already have an account?{' '}
              <Link to="/login" className="font-medium text-green-600 hover:text-green-500">
                Sign in
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SignUp;

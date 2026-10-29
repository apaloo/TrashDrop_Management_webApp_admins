import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { signUp } from '../utils/auth';
import { deriveRoleForUser, COMPANY_TYPES, ROLES } from '../constants/accessControl';
import { validateAccountDetails } from '../constants/accountTypeFields';
import AccountDetailsFields from '../components/AccountDetailsFields';
import { getInviteInfo } from '../services/teamService';
import { isInviteToken, rememberInvite, forgetInvite, INVITE_PROBLEMS } from '../utils/teamInvite';
import { Fragment } from 'react';

// Only a real duplicate says "account exists"; other problems say what happened
export const signUpProblem = (err) => {
  const message = err?.message || '';
  const code = err?.code || '';
  if (code === 'user_already_exists' || code === 'email_exists' || /already (been )?registered|already exists/i.test(message)) {
    return { duplicate: true, text: '❌ An account with this email already exists. Please try logging in or reset your password.' };
  }
  if (code === 'over_email_send_rate_limit' || err?.status === 429 || /rate limit/i.test(message)) {
    return { text: '❌ Too many sign-up emails have been sent in a short time. Please wait a while (up to an hour) and try again.' };
  }
  if (code === 'email_address_invalid' || /invalid format|email address .* is invalid/i.test(message)) {
    return { text: '❌ That email address can’t be used. Check it for typos, or use another address.' };
  }
  if (/sending confirmation email/i.test(message)) {
    return { text: '❌ We couldn’t send the confirmation email right now. Please try again in a few minutes.' };
  }
  if (code === 'weak_password' || message.includes('Password')) return { text: `❌ ${message}` };
  return { text: `❌ Failed to sign up: ${message || 'Unknown error. Please try again.'}` };
};

const SignUp = () => {
  // /signup?type=volunteer_group (links on /volunteers/, /media/) picks the account type
  const [searchParams] = useSearchParams();
  const typeFromLink = searchParams.get('type');
  // /signup?invite=TOKEN (from a volunteer group's invite link): the group
  // already has the organisation and area details, so ask only for the person's own
  const inviteToken = isInviteToken(searchParams.get('invite')) ? searchParams.get('invite') : null;
  const [invite, setInvite] = useState(null);
  const joining = Boolean(inviteToken) && invite?.valid !== false;
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [companyType, setCompanyType] = useState(() => (COMPANY_TYPES.some(t => t.value === typeFromLink) ? typeFromLink : ''));
  const [accountDetails, setAccountDetails] = useState({ region: '', district: '', details: {} });
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const [passwordStrength, setPasswordStrength] = useState(0); // 0-4 scale
  const navigate = useNavigate();
  
  // Password strength criteria
  const strengthLabels = ['Very Weak', 'Weak', 'Medium', 'Strong', 'Very Strong'];
  const strengthColors = ['red', 'orange', 'yellow', 'light-green', 'green'];

  useEffect(() => {
    if (!inviteToken) return undefined;
    let live = true;
    rememberInvite(inviteToken);
    getInviteInfo(inviteToken)
      .then(info => { if (live) setInvite(info); })
      .catch(() => { if (live) setInvite({ valid: null }); }); // still sign up; the link is checked again on joining
    return () => { live = false; };
  }, [inviteToken]);

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
    
    if (!joining) {
      if (!companyName.trim()) errors.companyName = 'Organisation or group name is required';
      if (!companyType) errors.companyType = 'Company type is required';
      if (companyType) Object.assign(errors, validateAccountDetails(companyType, accountDetails).errors);
    }
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
      if (joining) {
        // A member's own account: they work under the group's account once
        // they join, so there is nothing more to set up. The invite rides in
        // the account so joining happens on first sign-in, on any device.
        const { error } = await signUp({
          email,
          password,
          name: `${firstName} ${lastName}`,
          role: ROLES.USER,
          metadata: {
            firstName,
            lastName,
            companyType: 'other',
            role: ROLES.USER,
            inviteToken,
            onboardingCompleted: true,
          },
        });
        if (error) throw error;
        setSuccess(`✅ Account created! Check your email inbox and click the verification link, then sign in to join ${invite?.group_name || 'the group'}. Check your spam folder if you don't see it.`);
        setTimeout(() => navigate('/login'), 5000);
        return;
      }

      const derivedRole = deriveRoleForUser({ email, companyType });
      
      const { data, error } = await signUp({ 
        email, 
        password,
        name: `${firstName} ${lastName}`,
        role: derivedRole,
        metadata: {
          firstName,
          lastName,
          companyName,
          companyType,
          // Kept with the access request (account_roles) for the admin who approves it
          region: accountDetails.region || null,
          district: accountDetails.district || null,
          accessDetails: validateAccountDetails(companyType, accountDetails).details,
          role: derivedRole,
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
      
      // Show success message about email verification
      setError(null);
      setSuccess('✅ Account created successfully! Please check your email inbox and click the verification link before logging in. Check your spam folder if you don\'t see it.');
      
      // Wait 5 seconds then redirect to login
      setTimeout(() => {
        navigate('/login');
      }, 5000);
    } catch (err) {
      setSuccess(null);
      const problem = signUpProblem(err);
      setError(problem.text);
      if (problem.duplicate) setShowDuplicateModal(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      {/* Duplicate Email Modal Overlay */}
      {showDuplicateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6 transform transition-all">
            <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full mb-4">
              <i className="fas fa-exclamation-triangle text-red-600 text-xl"></i>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 text-center mb-2">Account Already Exists</h3>
            <p className="text-sm text-gray-600 text-center mb-6">
              {joining
                ? `You already have a TrashDrop account with this email. Sign in with it and you'll join ${invite?.group_name || 'the group'} straight away; there's no need for a new account.`
                : 'An account with this email already exists. Please try logging in or reset your password if you can\'t access your account.'}
            </p>
            <div className="flex gap-3">
              <Link
                to="/login"
                className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors text-center"
                onClick={() => setShowDuplicateModal(false)}
              >
                {joining ? 'Sign in to join' : 'Go to Login'}
              </Link>
              <Link
                to="/forgot-password"
                className="flex-1 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors text-center"
                onClick={() => setShowDuplicateModal(false)}
              >
                Reset Password
              </Link>
            </div>
            <button
              type="button"
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
              onClick={() => setShowDuplicateModal(false)}
            >
              <i className="fas fa-times text-lg"></i>
            </button>
          </div>
        </div>
      )}

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
        <div className="max-w-2xl w-full bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 p-8 sm:p-10">
          {/* Logo & heading */}
          <div className="text-center mb-8">
            <Link to="/" className="inline-flex items-center justify-center group">
              <img src="/logo.svg" alt="TrashDrop Logo" className="h-16 w-16 transition-transform group-hover:scale-105" />
            </Link>
            <h2 className="mt-5 text-2xl font-bold text-gray-900">
              {joining ? `Join ${invite?.group_name || 'your volunteer group'}` : 'Create your account'}
            </h2>
            <p className="mt-1.5 text-sm text-gray-500" data-testid="signup-subtitle">
              {joining
                ? 'Just your name, email and a password. You’ll work under the group’s account, so there’s nothing else to fill in.'
                : 'Join TrashDrop to streamline your waste management operations'}
            </p>
          </div>

          {inviteToken && invite && invite.valid === false && (
            <div role="alert" className="bg-amber-50 border-l-4 border-amber-500 p-4 mb-6 rounded-r-lg text-sm text-amber-800">
              {INVITE_PROBLEMS[invite.reason] || INVITE_PROBLEMS.not_found} You can still create your own account below.
            </div>
          )}
          
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
          
          {success && (
            <div className="bg-green-50 border-l-4 border-green-500 p-4 mb-6 rounded-r-lg">
              <div className="flex">
                <div className="flex-shrink-0">
                  <i className="fas fa-check-circle text-green-500"></i>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-green-700 font-medium">{success}</p>
                  <p className="text-xs text-green-600 mt-1">Redirecting to login page in 5 seconds...</p>
                </div>
              </div>
            </div>
          )}
          
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="first-name" className="block text-sm font-medium text-gray-700 mb-1.5">First Name</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <i className="fas fa-user text-gray-400 text-sm"></i>
                    </div>
                    <input
                      id="first-name"
                      name="first-name"
                      type="text"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className={`block w-full pl-10 pr-3 py-2.5 border ${validationErrors.firstName ? 'border-red-500 ring-1 ring-red-500' : 'border-gray-300'} rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 sm:text-sm transition-colors`}
                      placeholder="First Name"
                    />
                  </div>
                  {validationErrors.firstName && (
                    <p className="text-red-500 text-xs mt-1.5">{validationErrors.firstName}</p>
                  )}
                </div>
                <div>
                  <label htmlFor="last-name" className="block text-sm font-medium text-gray-700 mb-1.5">Last Name</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <i className="fas fa-user text-gray-400 text-sm"></i>
                    </div>
                    <input
                      id="last-name"
                      name="last-name"
                      type="text"
                      required
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className={`block w-full pl-10 pr-3 py-2.5 border ${validationErrors.lastName ? 'border-red-500 ring-1 ring-red-500' : 'border-gray-300'} rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 sm:text-sm transition-colors`}
                      placeholder="Last Name"
                    />
                  </div>
                  {validationErrors.lastName && (
                    <p className="text-red-500 text-xs mt-1.5">{validationErrors.lastName}</p>
                  )}
                </div>
              </div>
              
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">Email address</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <i className="fas fa-envelope text-gray-400 text-sm"></i>
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={`block w-full pl-10 pr-3 py-2.5 border ${validationErrors.email ? 'border-red-500 ring-1 ring-red-500' : 'border-gray-300'} rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 sm:text-sm transition-colors`}
                    placeholder="you@example.com"
                  />
                </div>
                {validationErrors.email && (
                  <p className="text-red-500 text-xs mt-1.5">{validationErrors.email}</p>
                )}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                      autoComplete="new-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={`block w-full pl-10 pr-3 py-2.5 border ${validationErrors.password ? 'border-red-500 ring-1 ring-red-500' : 'border-gray-300'} rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 sm:text-sm transition-colors`}
                      placeholder="Create password"
                    />
                  </div>
                  {password && (
                    <div className="mt-2">
                      <div className="flex space-x-1 h-1.5">
                        {[0, 1, 2, 3].map((index) => (
                          <div 
                            key={index}
                            className={`h-full w-1/4 rounded-full transition-colors ${index < passwordStrength ? `bg-${strengthColors[passwordStrength]}-500` : 'bg-gray-200'}`}
                          />
                        ))}
                      </div>
                      <p className={`text-xs mt-1 text-${strengthColors[passwordStrength]}-500`}>
                        {strengthLabels[passwordStrength]}
                      </p>
                    </div>
                  )}
                  {validationErrors.password && (
                    <p className="text-red-500 text-xs mt-1.5">{validationErrors.password}</p>
                  )}
                </div>
                
                <div>
                  <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 mb-1.5">Confirm Password</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <i className="fas fa-lock text-gray-400 text-sm"></i>
                    </div>
                    <input
                      id="confirm-password"
                      name="confirm-password"
                      type="password"
                      autoComplete="new-password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={`block w-full pl-10 pr-3 py-2.5 border ${validationErrors.confirmPassword ? 'border-red-500 ring-1 ring-red-500' : 'border-gray-300'} rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 sm:text-sm transition-colors`}
                      placeholder="Confirm password"
                    />
                  </div>
                  {validationErrors.confirmPassword && (
                    <p className="text-red-500 text-xs mt-1.5">{validationErrors.confirmPassword}</p>
                  )}
                </div>
              </div>

              {!joining && (<>
              {/* Divider */}
              <div className="relative pt-2">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200"></div>
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-3 bg-white text-gray-400">Organization details</span>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="company-name" className="block text-sm font-medium text-gray-700 mb-1.5">Organisation / Group Name</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <i className="fas fa-building text-gray-400 text-sm"></i>
                    </div>
                    <input
                      id="company-name"
                      name="company-name"
                      type="text"
                      required
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className={`block w-full pl-10 pr-3 py-2.5 border ${validationErrors.companyName ? 'border-red-500 ring-1 ring-red-500' : 'border-gray-300'} rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 sm:text-sm transition-colors`}
                      placeholder="e.g. Bus Stop Boys, Accra Metro, Citi FM"
                    />
                  </div>
                  {validationErrors.companyName && (
                    <p className="text-red-500 text-xs mt-1.5">{validationErrors.companyName}</p>
                  )}
                </div>
                
                <div>
                  <label htmlFor="company-type" className="block text-sm font-medium text-gray-700 mb-1.5">Account Type</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <i className="fas fa-briefcase text-gray-400 text-sm"></i>
                    </div>
                    <select
                      id="company-type"
                      name="company-type"
                      required
                      value={companyType}
                      onChange={(e) => setCompanyType(e.target.value)}
                      className={`block w-full pl-10 pr-3 py-2.5 border ${validationErrors.companyType ? 'border-red-500 ring-1 ring-red-500' : 'border-gray-300'} rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 sm:text-sm transition-colors`}
                    >
                      <option value="">Select account type</option>
                      {COMPANY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  {validationErrors.companyType && (
                    <p className="text-red-500 text-xs mt-1.5">{validationErrors.companyType}</p>
                  )}
                  {companyType && COMPANY_TYPES.find(t => t.value === companyType)?.role !== ROLES.USER && (
                    <p className="text-gray-500 text-xs mt-1.5" data-testid="approval-note">
                      This account type needs approval by the TrashDrop team. You can use basic features while you wait.
                    </p>
                  )}
                </div>
              </div>
              <AccountDetailsFields companyType={companyType} value={accountDetails} onChange={setAccountDetails} errors={validationErrors} />
              </>)}

              <div className="flex items-start mt-2">
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
                  <label htmlFor="agree-terms" className="text-gray-600">
                    I agree to the <a href="/terms" className="font-medium text-green-600 hover:text-green-500 transition-colors">Terms of Service</a> and <a href="/privacy" className="font-medium text-green-600 hover:text-green-500 transition-colors">Privacy Policy</a>
                  </label>
                  {validationErrors.agreeToTerms && (
                    <p className="text-red-500 text-xs mt-1.5">{validationErrors.agreeToTerms}</p>
                  )}
                </div>
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
                  <i className="fas fa-user-plus mr-2"></i>
                )}
                {loading ? 'Creating account...' : 'Create account'}
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
                Already have an account?{' '}
                <Link to="/login" className="font-semibold text-green-600 hover:text-green-500 transition-colors">
                  Sign in
                </Link>
                {joining && ' — you’ll join the group after signing in.'}
              </p>
              {joining && (
                <p className="text-xs text-gray-500 mt-2">
                  Not joining a group?{' '}
                  <Link to="/signup" onClick={forgetInvite} className="font-medium text-green-600 hover:text-green-500">Create a full account instead</Link>
                </p>
              )}
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

export default SignUp;

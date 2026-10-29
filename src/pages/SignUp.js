import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { signUp } from '../utils/auth';
import { deriveRoleForUser, COMPANY_TYPES, ROLES } from '../constants/accessControl';
import { validateAccountDetails } from '../constants/accountTypeFields';
import AccountDetailsFields from '../components/AccountDetailsFields';
import AuthShell, { AUTH, AuthDivider } from '../components/auth/AuthShell';
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
    <>
      {/* Duplicate Email Modal Overlay */}
      {showDuplicateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" aria-labelledby="duplicate-title" className="relative bg-white rounded-[20px] shadow-2xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full mb-4">
              <i className="fas fa-exclamation-triangle text-red-600 text-xl"></i>
            </div>
            <h2 id="duplicate-title" className="text-xl font-semibold text-td-ink text-center mb-2">Account already exists</h2>
            <p className="text-sm text-td-sage text-center mb-6">
              {joining
                ? `You already have a TrashDrop account with this email. Sign in with it and you'll join ${invite?.group_name || 'the group'} straight away; there's no need for a new account.`
                : 'An account with this email already exists. Please try logging in or reset your password if you can\'t access your account.'}
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                to="/login"
                className={`${AUTH.primary} flex-1`}
                onClick={() => setShowDuplicateModal(false)}
              >
                {joining ? 'Sign in to join' : 'Go to login'}
              </Link>
              <Link
                to="/forgot-password"
                className={`${AUTH.secondary} flex-1`}
                onClick={() => setShowDuplicateModal(false)}
              >
                Reset password
              </Link>
            </div>
            <button
              type="button"
              className="absolute top-4 right-4 text-td-sage hover:text-td-ink transition-colors"
              onClick={() => setShowDuplicateModal(false)}
              aria-label="Close"
            >
              <i className="fas fa-times text-lg" aria-hidden="true"></i>
            </button>
          </div>
        </div>
      )}

      <AuthShell
        wide
        title={joining ? `Join ${invite?.group_name || 'your volunteer group'}` : 'Create your account'}
        subtitleTestId="signup-subtitle"
        subtitle={joining
          ? 'Just your name, email and a password. You’ll work under the group’s account, so there’s nothing else to fill in.'
          : 'Join TrashDrop to streamline your waste management operations'}
      >
          {inviteToken && invite && invite.valid === false && (
            <div role="alert" className={AUTH.alertWarning}>
              {INVITE_PROBLEMS[invite.reason] || INVITE_PROBLEMS.not_found} You can still create your own account below.
            </div>
          )}
          
          {error && (
            <div role="alert" className={`${AUTH.alertError} flex`}>
              <i className="fas fa-exclamation-circle mt-0.5" aria-hidden="true"></i>
              <p className="ml-3">{error}</p>
            </div>
          )}
          
          {success && (
            <div role="status" className={`${AUTH.alertSuccess} flex`}>
              <i className="fas fa-check-circle mt-0.5" aria-hidden="true"></i>
              <div className="ml-3">
                <p className="font-medium">{success}</p>
                <p className="mt-1">Redirecting to login page in 5 seconds...</p>
              </div>
            </div>
          )}
          
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="first-name" className={AUTH.label}>First name</label>
                  <div className="relative">
                    <div className={AUTH.inputIcon}>
                      <i className="fas fa-user" aria-hidden="true"></i>
                    </div>
                    <input
                      id="first-name"
                      name="first-name"
                      type="text"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className={AUTH.input(validationErrors.firstName)}
                      placeholder="First name"
                    />
                  </div>
                  {validationErrors.firstName && (
                    <p className={AUTH.fieldError}>{validationErrors.firstName}</p>
                  )}
                </div>
                <div>
                  <label htmlFor="last-name" className={AUTH.label}>Last name</label>
                  <div className="relative">
                    <div className={AUTH.inputIcon}>
                      <i className="fas fa-user" aria-hidden="true"></i>
                    </div>
                    <input
                      id="last-name"
                      name="last-name"
                      type="text"
                      required
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className={AUTH.input(validationErrors.lastName)}
                      placeholder="Last name"
                    />
                  </div>
                  {validationErrors.lastName && (
                    <p className={AUTH.fieldError}>{validationErrors.lastName}</p>
                  )}
                </div>
              </div>
              
              <div>
                <label htmlFor="email" className={AUTH.label}>Email address</label>
                <div className="relative">
                  <div className={AUTH.inputIcon}>
                      <i className="fas fa-envelope" aria-hidden="true"></i>
                  </div>
                  <input
                    id="email"
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
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                      autoComplete="new-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={AUTH.input(validationErrors.password)}
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
                      <p className="text-[13px] mt-1 text-td-sage">
                        {strengthLabels[passwordStrength]}
                      </p>
                    </div>
                  )}
                  {validationErrors.password && (
                    <p className={AUTH.fieldError}>{validationErrors.password}</p>
                  )}
                </div>
                
                <div>
                  <label htmlFor="confirm-password" className={AUTH.label}>Confirm password</label>
                  <div className="relative">
                    <div className={AUTH.inputIcon}>
                      <i className="fas fa-lock" aria-hidden="true"></i>
                    </div>
                    <input
                      id="confirm-password"
                      name="confirm-password"
                      type="password"
                      autoComplete="new-password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={AUTH.input(validationErrors.confirmPassword)}
                      placeholder="Confirm password"
                    />
                  </div>
                  {validationErrors.confirmPassword && (
                    <p className={AUTH.fieldError}>{validationErrors.confirmPassword}</p>
                  )}
                </div>
              </div>

              {!joining && (<>
              {/* Divider */}
              <AuthDivider>Organization details</AuthDivider>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="company-name" className={AUTH.label}>Organisation or group name</label>
                  <div className="relative">
                    <div className={AUTH.inputIcon}>
                      <i className="fas fa-building" aria-hidden="true"></i>
                    </div>
                    <input
                      id="company-name"
                      name="company-name"
                      type="text"
                      required
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className={AUTH.input(validationErrors.companyName)}
                      placeholder="e.g. Bus Stop Boys, Accra Metro, Citi FM"
                    />
                  </div>
                  {validationErrors.companyName && (
                    <p className={AUTH.fieldError}>{validationErrors.companyName}</p>
                  )}
                </div>
                
                <div>
                  <label htmlFor="company-type" className={AUTH.label}>Account type</label>
                  <div className="relative">
                    <div className={AUTH.inputIcon}>
                      <i className="fas fa-briefcase" aria-hidden="true"></i>
                    </div>
                    <select
                      id="company-type"
                      name="company-type"
                      required
                      value={companyType}
                      onChange={(e) => setCompanyType(e.target.value)}
                      className={AUTH.input(validationErrors.companyType)}
                    >
                      <option value="">Select account type</option>
                      {COMPANY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  {validationErrors.companyType && (
                    <p className={AUTH.fieldError}>{validationErrors.companyType}</p>
                  )}
                  {companyType && COMPANY_TYPES.find(t => t.value === companyType)?.role !== ROLES.USER && (
                    <p className={AUTH.hint} data-testid="approval-note">
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
                    className={`${AUTH.checkbox} ${validationErrors.agreeToTerms ? 'border-td-error' : ''}`}
                  />
                </div>
                <div className="ml-3 text-sm">
                  <label htmlFor="agree-terms" className="text-td-sage">
                    I agree to the <a href="/terms" className={AUTH.link}>Terms of Service</a> and <a href="/privacy" className={AUTH.link}>Privacy Policy</a>
                  </label>
                  {validationErrors.agreeToTerms && (
                    <p className={AUTH.fieldError}>{validationErrors.agreeToTerms}</p>
                  )}
                </div>
              </div>
            </div>

            <div>
              <button type="submit" disabled={loading} className={`${AUTH.primary} w-full`}>
                <i className={`fas ${loading ? 'fa-circle-notch fa-spin' : 'fa-user-plus'}`} aria-hidden="true"></i>
                {loading ? 'Creating account...' : 'Create account'}
              </button>
            </div>
            
            <AuthDivider>or</AuthDivider>
            
            <div className="text-center">
              <p className="text-sm text-td-sage">
                Already have an account?{' '}
                <Link to="/login" className={AUTH.link}>
                  Sign in
                </Link>
                {joining && ' — you’ll join the group after signing in.'}
              </p>
              {joining && (
                <p className="text-[13px] text-td-sage mt-2">
                  Not joining a group?{' '}
                  <Link to="/signup" onClick={forgetInvite} className={AUTH.link}>Create a full account instead</Link>
                </p>
              )}
            </div>
          </form>
      </AuthShell>
    </>
  );
};

export default SignUp;

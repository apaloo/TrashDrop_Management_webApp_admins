import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { updateUserMetadata } from '../utils/auth';
import CompanyInfoStep from '../components/onboarding/CompanyInfoStep';
import UserPreferencesStep from '../components/onboarding/UserPreferencesStep';
import CompletionStep from '../components/onboarding/CompletionStep';

const Onboarding = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    // Company Information
    companyName: '',
    companyType: '',
    operatingArea: '',
    
    // User Preferences
    notificationPreferences: {
      email: true,
      push: false,
      sms: false
    },
    dashboardPreferences: {
      showKpis: true,
      showRecentActivity: true,
      defaultView: 'map'
    }
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  
  // Load any existing data from signup
  useEffect(() => {
    const savedUser = localStorage.getItem('trashdrop_onboarding_user');
    if (savedUser) {
      try {
        const userData = JSON.parse(savedUser);
        setFormData(prevData => ({
          ...prevData,
          companyName: userData.companyName || prevData.companyName,
          companyType: userData.companyType || prevData.companyType
        }));
      } catch (err) {
        console.error('Error parsing saved user data:', err);
      }
    }
  }, []);
  
  const totalSteps = 3;

  const updateFormData = (stepData) => {
    setFormData(prevData => ({
      ...prevData,
      ...stepData
    }));
  };

  const handleNext = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
      window.scrollTo(0, 0);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      window.scrollTo(0, 0);
    }
  };

  const handleComplete = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Save onboarding data to Supabase user metadata
      const { data, error: updateError } = await updateUserMetadata({
        // Company information
        companyName: formData.companyName,
        companyType: formData.companyType,
        operatingArea: formData.operatingArea,
        
        // User preferences
        notificationPreferences: formData.notificationPreferences,
        dashboardPreferences: formData.dashboardPreferences,
        
        // Mark onboarding as completed
        onboardingCompleted: true
      });
      
      if (updateError) throw updateError;
      
      // Also save preferences to localStorage for faster access
      localStorage.setItem('trashdrop_user_preferences', JSON.stringify({
        notifications: formData.notificationPreferences,
        dashboard: formData.dashboardPreferences
      }));
      
      // Remove the temporary onboarding user data
      localStorage.removeItem('trashdrop_onboarding_user');
      
      // Navigate to dashboard
      navigate('/dashboard');
    } catch (err) {
      setError('Failed to complete onboarding. Please try again.');
      console.error('Onboarding error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Render the current step
  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <CompanyInfoStep 
            formData={formData} 
            updateFormData={updateFormData}
            onNext={handleNext}
          />
        );
      case 2:
        return (
          <UserPreferencesStep 
            formData={formData} 
            updateFormData={updateFormData}
            onNext={handleNext}
            onPrevious={handlePrevious}
          />
        );
      case 3:
        return (
          <CompletionStep 
            formData={formData}
            onComplete={handleComplete}
            onPrevious={handlePrevious}
            isLoading={isLoading}
            error={error}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-tr from-green-50 to-emerald-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-xl overflow-hidden border border-gray-100">
        <div className="bg-gradient-to-r from-green-600 to-green-700 px-8 py-6">
          <div className="flex items-center mb-4">
            <img src="/logo.svg" alt="TrashDrop Logo" className="h-12 w-12" />
            <div className="ml-4">
              <h2 className="text-2xl font-bold text-white">Welcome to TrashDrop</h2>
              <p className="text-green-100">Let's get your account set up</p>
            </div>
          </div>
          
          {/* Progress steps */}
          <div className="mt-6">
            <ol className="flex items-center w-full">
              {[1, 2, 3].map((step) => (
                <li key={step} className="flex w-full items-center">
                  <div className={`flex items-center justify-center w-10 h-10 rounded-full ${currentStep >= step ? 'bg-white text-green-700' : 'bg-green-200 bg-opacity-50 text-green-300'}`}>
                    {currentStep > step ? (
                      <svg className="w-5 h-5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <span className="text-sm font-bold">{step}</span>
                    )}
                  </div>
                  
                  {step < 3 && (
                    <div className="flex-1 h-0.5 mx-2 bg-green-200 bg-opacity-50">
                      <div className={`h-0.5 ${currentStep > step ? 'bg-white' : 'bg-transparent'}`} style={{ width: '100%' }}></div>
                    </div>
                  )}
                </li>
              ))}
            </ol>
              
            <div className="flex justify-between mt-2 text-xs text-white font-medium">
              <span className="pl-2">Company Info</span>
              <span>Preferences</span>
              <span className="pr-2">Complete</span>
            </div>
          </div>
        </div>

        <div className="p-6">
          {renderStep()}
        </div>
      </div>
    </div>
  );
};

export default Onboarding;

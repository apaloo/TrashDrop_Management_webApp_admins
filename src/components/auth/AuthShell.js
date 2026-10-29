import React from 'react';
import { Link } from 'react-router-dom';

// Class names shared by the sign-in, sign-up and password pages, so the
// forms read the same (docs/DESIGN_SYSTEM.md).
export const AUTH = {
  title: 'text-[28px] leading-tight font-bold tracking-tight text-td-ink',
  label: 'block text-sm font-medium text-td-ink mb-1.5',
  // Inputs with a leading icon; 16px text keeps phones from zooming in
  input: (hasError) => `block w-full h-12 pl-10 pr-3 rounded-lg border bg-white text-base text-td-ink placeholder-gray-500 transition-colors focus:border-td-forest ${hasError ? 'border-td-error ring-1 ring-td-error' : 'border-td-border-strong'}`,
  inputIcon: 'absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500 text-sm',
  fieldError: 'text-[13px] text-td-error mt-1.5',
  hint: 'text-[13px] text-td-sage mt-1.5',
  // 48px pills; add w-full or flex-1 where the button should stretch
  primary: 'inline-flex items-center justify-center gap-2 h-12 px-6 rounded-full text-base font-semibold text-white bg-td-forest hover:bg-td-forest-dk disabled:opacity-50 disabled:cursor-not-allowed transition-colors',
  secondary: 'inline-flex items-center justify-center gap-2 h-12 px-6 rounded-full text-base font-semibold text-td-forest bg-td-tonal hover:bg-[#d5eadb] transition-colors',
  link: 'font-semibold text-td-forest hover:underline underline-offset-2',
  alertError: 'bg-red-50 border-l-4 border-td-error p-4 mb-6 rounded-r-lg text-sm text-red-800',
  alertSuccess: 'bg-td-tonal border-l-4 border-td-forest p-4 mb-6 rounded-r-lg text-sm text-td-forest',
  alertWarning: 'bg-amber-50 border-l-4 border-amber-600 p-4 mb-6 rounded-r-lg text-sm text-amber-900',
  divider: 'px-3 bg-white text-[13px] text-td-sage',
  checkbox: 'h-4 w-4 rounded border-td-border-strong text-td-forest',
};

// A labelled divider line ("or", "Organization details")
export const AuthDivider = ({ children }) => (
  <div className="relative my-4">
    <div className="absolute inset-0 flex items-center" aria-hidden="true">
      <div className="w-full border-t border-td-border"></div>
    </div>
    <div className="relative flex justify-center">
      <span className={AUTH.divider}>{children}</span>
    </div>
  </div>
);

/**
 * The frame around every sign-in form: a dark page (the hero surface) with
 * a white card. `wide` fits the two-column sign-up form. Without a `title`
 * the page puts its own heading in the card.
 */
const AuthShell = ({ title, subtitle, subtitleTestId, wide, children }) => (
  <div className="min-h-screen flex flex-col relative overflow-hidden bg-td-ink">
    <div className="absolute inset-0" aria-hidden="true">
      <img src="/images/how-it-works/pickup-at-gate.jpg" alt="" className="w-full h-full object-cover opacity-40" />
      <div className="absolute inset-0" style={{ background: 'linear-gradient(160deg, rgba(21,90,43,0.85) 0%, rgba(10,15,10,0.9) 60%)' }}></div>
    </div>

    <div data-surface="dark" className="relative z-10 w-full px-4 sm:px-8 pt-6">
      <Link to="/" className="inline-flex items-center text-td-sage-dark hover:text-white transition-colors text-[15px] font-medium">
        <i className="fas fa-arrow-left mr-2" aria-hidden="true"></i>
        Back to home
      </Link>
    </div>

    <main className="relative z-10 flex-1 flex items-center justify-center px-4 sm:px-6 py-8">
      <div className={`${wide ? 'max-w-2xl' : 'max-w-md'} w-full bg-white rounded-[20px] shadow-2xl p-6 sm:p-10`}>
        <div className={`text-center ${title ? 'mb-8' : 'mb-5'}`}>
          <Link to="/" className="inline-flex items-center justify-center" aria-label="TrashDrop home">
            <img src="/logo.svg" alt="" className="h-14 w-14" />
          </Link>
          {title && <h1 className={`mt-5 ${AUTH.title}`}>{title}</h1>}
          {subtitle && <p className="mt-2 text-base text-td-sage" data-testid={subtitleTestId}>{subtitle}</p>}
        </div>
        {children}
      </div>
    </main>

    <div data-surface="dark" className="relative z-10 text-center pb-6">
      <p className="text-[13px] text-td-sage-dark">
        TrashDrop &mdash; Real-time environmental intelligence
      </p>
    </div>
  </div>
);

export default AuthShell;

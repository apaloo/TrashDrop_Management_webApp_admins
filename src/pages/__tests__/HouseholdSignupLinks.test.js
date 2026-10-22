import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import FAQPage from '../FAQPage';
import UsersPage from '../UsersPage';
import AboutPage from '../AboutPage';
import WastePickupPage from '../WastePickupPage';
import { HOUSEHOLD_APP_URL } from '../../config/homepage';

jest.mock('../../utils/supabase', () => ({ supabase: {} }));
jest.mock('../../context/AuthContext', () => ({ useAuth: () => ({ isAuthenticated: false }) }));

describe('household sign-up buttons open the household app', () => {
  it.each([
    ['FAQ', FAQPage, 'Create Free Account'],
    ['Users', UsersPage, 'Create Free Account'],
    ['Users', UsersPage, 'Get Started Free'],
    ['About', AboutPage, 'Get Started Free'],
    ['Waste pickup', WastePickupPage, 'Request a waste pickup'],
  ])('%s: "%s"', (_page, Page, label) => {
    render(<MemoryRouter><Page /></MemoryRouter>);
    const links = screen.getAllByRole('link', { name: label });
    expect(links.length).toBeGreaterThan(0);
    links.forEach(l => expect(l).toHaveAttribute('href', HOUSEHOLD_APP_URL));
  });
});

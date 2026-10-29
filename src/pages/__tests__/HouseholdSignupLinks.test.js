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
    ['FAQ', FAQPage, 'Create free account'],
    ['Users', UsersPage, 'Create free account'],
    ['Users', UsersPage, 'Get started free'],
    ['About', AboutPage, 'Get started free'],
    ['Waste pickup', WastePickupPage, 'Request a waste pickup'],
  ])('%s: "%s"', (_page, Page, label) => {
    render(<MemoryRouter><Page /></MemoryRouter>);
    const links = screen.getAllByRole('link', { name: label });
    expect(links.length).toBeGreaterThan(0);
    links.forEach(l => expect(l).toHaveAttribute('href', HOUSEHOLD_APP_URL));
  });
});

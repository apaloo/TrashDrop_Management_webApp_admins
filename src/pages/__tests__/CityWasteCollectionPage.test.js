import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CityWasteCollectionPage from '../CityWasteCollectionPage';
import { HOUSEHOLD_APP_URL } from '../../config/homepage';

jest.mock('../../utils/supabase', () => ({ supabase: {} }));
jest.mock('../../context/AuthContext', () => ({ useAuth: () => ({ isAuthenticated: false }) }));

describe('city page booking buttons', () => {
  it.each([['accra', 'Accra'], ['kumasi', 'Kumasi'], ['takoradi', 'Takoradi'], ['tamale', 'Tamale']])(
    '"Sign up to book in %s" opens the household app', (slug, name) => {
      render(<MemoryRouter><CityWasteCollectionPage slug={slug} /></MemoryRouter>);
      const buttons = screen.getAllByRole('link', { name: `Sign up to book in ${name}` });
      expect(buttons.length).toBeGreaterThan(0);
      buttons.forEach(b => expect(b).toHaveAttribute('href', HOUSEHOLD_APP_URL));
      expect(HOUSEHOLD_APP_URL).toMatch(/^https:\/\/app\.trashdrops\.com/);
    });
});

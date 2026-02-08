import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import LiveMap from '../pages/LiveMap';
import '@testing-library/jest-dom';

// Mock the required modules
jest.mock('../utils/collectorService');
jest.mock('../utils/pickupService');

describe('LiveMap Component', () => {
  beforeEach(() => {
    // Mock console.error to track errors
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    // Clear all mocks after each test
    jest.clearAllMocks();
  });

  it('renders without crashing', async () => {
    render(<LiveMap />);
    
    // Check if loading state is shown initially
    expect(screen.getByText(/loading map data/i)).toBeInTheDocument();
    
    // Wait for the component to finish loading
    await waitFor(() => {
      expect(screen.queryByText(/loading map data/i)).not.toBeInTheDocument();
    });
    
    // Verify no errors were logged
    expect(console.error).not.toHaveBeenCalled();
  });

  it('displays error message when data loading fails', async () => {
    // Mock the API to reject
    const { fetchCollectors } = require('../utils/collectorService');
    fetchCollectors.mockRejectedValue(new Error('API Error'));

    render(<LiveMap />);
    
    // Should show error state after loading fails
    await waitFor(() => {
      expect(screen.getByText(/failed to load data/i)).toBeInTheDocument();
    });
  });
});

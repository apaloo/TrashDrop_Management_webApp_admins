import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { QrScanScreen, BookScreen, TrackScreen, ReportScreen, ReportFlowScreen } from '../AppScreens';

const setReducedMotion = (reduce) => {
  window.matchMedia = jest.fn().mockImplementation(query => ({
    matches: reduce && query.includes('reduce'), media: query, addListener: jest.fn(), removeListener: jest.fn(),
  }));
};

describe('app screens', () => {
  it.each([
    ['QR scan', QrScanScreen, /scanning the QR code/],
    ['booking', BookScreen, /booking a Digital Bin pickup/],
    ['tracking', TrackScreen, /following the collector/],
    ['report', ReportScreen, /reporting illegal dumping/],
  ])('%s is one described picture to screen readers', (_name, Screen, label) => {
    render(<Screen />);
    expect(screen.getByRole('img', { name: label })).toBeInTheDocument();
  });

  it('shows no price figure on the booking screen', () => {
    render(<BookScreen />);
    const phone = screen.getByRole('img', { name: /booking a Digital Bin pickup/ });
    expect(phone.textContent).toMatch(/Request Bin Pickup/);
    expect(phone.textContent).not.toMatch(/₵|GHS|\d+\.\d{2}/);
  });

  describe('report flow', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('steps through photos, location and submit', () => {
      setReducedMotion(false);
      const { container } = render(<ReportFlowScreen />);
      expect(container.textContent).toMatch(/Step 1 of 3/);
      act(() => { jest.advanceTimersByTime(2500); });
      expect(container.textContent).toMatch(/Step 2 of 3 · Confirm the location/);
      act(() => { jest.advanceTimersByTime(2500); });
      expect(container.textContent).toMatch(/Submit Report/);
      act(() => { jest.advanceTimersByTime(2500); });
      expect(container.textContent).toMatch(/Step 1 of 3/);
    });

    it('stays still when the device asks for reduced motion', () => {
      setReducedMotion(true);
      const { container } = render(<ReportFlowScreen />);
      act(() => { jest.advanceTimersByTime(10000); });
      expect(container.textContent).toMatch(/Step 1 of 3/);
    });
  });
});

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider, useTheme, THEME_KEY } from '../ThemeContext';

const Probe = () => {
  const { theme, isDark, toggleTheme } = useTheme();
  return <button type="button" onClick={toggleTheme} data-dark={String(isDark)}>{theme}</button>;
};

describe('ThemeContext', () => {
  beforeEach(() => localStorage.clear());

  it('starts light when nothing is stored', () => {
    render(<ThemeProvider><Probe /></ThemeProvider>);
    expect(screen.getByRole('button')).toHaveTextContent('light');
  });

  it('switches to dark, remembers it, and switches back', () => {
    const { unmount } = render(<ThemeProvider><Probe /></ThemeProvider>);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('button')).toHaveTextContent('dark');
    expect(localStorage.getItem(THEME_KEY)).toBe('dark');
    unmount();

    render(<ThemeProvider><Probe /></ThemeProvider>);
    expect(screen.getByRole('button')).toHaveTextContent('dark');
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('button')).toHaveTextContent('light');
    expect(localStorage.getItem(THEME_KEY)).toBeNull();
  });

  it('ignores an unknown stored value', () => {
    localStorage.setItem(THEME_KEY, 'purple');
    render(<ThemeProvider><Probe /></ThemeProvider>);
    expect(screen.getByRole('button')).toHaveTextContent('light');
  });

  it('is light outside a provider', () => {
    render(<Probe />);
    expect(screen.getByRole('button')).toHaveAttribute('data-dark', 'false');
  });
});

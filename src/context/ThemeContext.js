import React, { createContext, useContext, useEffect } from 'react';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within a ThemeProvider');
  return context;
};

// The dashboard has one light theme for now: dark mode left parts of pages
// unreadable, so it was removed until every page supports it.
const LIGHT = { theme: 'light', toggleTheme: () => {}, isDark: false };

export const ThemeProvider = ({ children }) => {
  useEffect(() => {
    localStorage.removeItem('trashdrop_theme');
    document.documentElement.setAttribute('data-theme', 'light');
  }, []);

  return (
    <ThemeContext.Provider value={LIGHT}>
      {children}
    </ThemeContext.Provider>
  );
};

export default ThemeContext;

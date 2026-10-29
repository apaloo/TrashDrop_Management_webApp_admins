import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext();

// Outside a ThemeProvider (tests, a component drawn on its own) it is light
const LIGHT = { theme: 'light', toggleTheme: () => {}, isDark: false };
export const useTheme = () => useContext(ThemeContext) || LIGHT;

// The dashboard is light unless the person switches dark mode on; the choice
// is kept per browser. Only the dashboard shell (Layout) reads it: public
// pages and sign-in stay light.
export const THEME_KEY = 'trashdrop_theme';

const readStored = () => {
  try {
    return localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
};

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(readStored);

  useEffect(() => {
    try {
      if (theme === 'dark') localStorage.setItem(THEME_KEY, 'dark');
      else localStorage.removeItem(THEME_KEY);
    } catch {
      // Private browsing: the choice lasts for this visit only
    }
  }, [theme]);

  const toggleTheme = useCallback(() => setTheme(t => (t === 'dark' ? 'light' : 'dark')), []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, isDark: theme === 'dark' }}>
      {children}
    </ThemeContext.Provider>
  );
};

export default ThemeContext;

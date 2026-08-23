import React, { createContext, useContext, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark' | 'system';
export type Accent = 'blue' | 'violet' | 'green' | 'orange';

interface ThemeContextType {
  theme: Theme;
  accent: Accent;
  setTheme: (theme: Theme) => void;
  setAccent: (accent: Accent) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const accentColors: Record<Accent, { primary: string; hover: string; ring: string }> = {
  blue: {
    primary: '37 99 235', // blue-600
    hover: '29 78 216', // blue-700
    ring: '59 130 246 / 0.3'
  },
  violet: {
    primary: '124 58 237', // violet-600
    hover: '109 40 217', // violet-700
    ring: '139 92 246 / 0.3'
  },
  green: {
    primary: '5 150 105', // emerald-600
    hover: '4 120 87', // emerald-700
    ring: '16 185 129 / 0.3'
  },
  orange: {
    primary: '234 88 12', // orange-600
    hover: '194 65 12', // orange-700
    ring: '249 115 22 / 0.3'
  }
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(() => {
    return (localStorage.getItem('flowforge-theme') as Theme) || 'system';
  });

  const [accent, setAccentState] = useState<Accent>(() => {
    return (localStorage.getItem('flowforge-accent') as Accent) || 'blue';
  });

  const setTheme = (newTheme: Theme) => {
    localStorage.setItem('flowforge-theme', newTheme);
    setThemeState(newTheme);
  };

  const setAccent = (newAccent: Accent) => {
    localStorage.setItem('flowforge-accent', newAccent);
    setAccentState(newAccent);
  };

  // Effect to apply theme class
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');

    const applyTheme = (resolvedTheme: 'light' | 'dark') => {
      root.classList.add(resolvedTheme);
      root.style.colorScheme = resolvedTheme;
    };

    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      applyTheme(systemTheme);

      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = (e: MediaQueryListEvent) => {
        root.classList.remove('light', 'dark');
        applyTheme(e.matches ? 'dark' : 'light');
      };

      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    } else {
      applyTheme(theme);
    }
  }, [theme]);

  // Effect to apply accent colors
  useEffect(() => {
    const root = window.document.documentElement;
    const colors = accentColors[accent];
    
    root.style.setProperty('--color-primary', colors.primary);
    root.style.setProperty('--color-primary-hover', colors.hover);
    root.style.setProperty('--color-primary-ring', colors.ring);
  }, [accent]);

  return (
    <ThemeContext.Provider value={{ theme, accent, setTheme, setAccent }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

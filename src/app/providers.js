'use client';

/**
 * src/app/providers.js
 * Wires MUI theme, theme-mode context, and the notification scheduler bootstrapper.
 */
import { useEffect, useMemo, useState, createContext, useContext } from 'react';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { buildTheme } from '@/lib/theme';
import { bootstrapNotifications } from '@/lib/notifications';

const ThemeModeContext = createContext({ mode: 'light', toggle: () => {} });

export function useThemeMode() {
  return useContext(ThemeModeContext);
}

export default function Providers({ children }) {
  const [mode, setMode] = useState('light');
  const [mounted, setMounted] = useState(false);

  // Load saved theme on first render (client-only).
  useEffect(() => {
    try {
      const saved = localStorage.getItem('tt-theme');
      if (saved === 'dark' || saved === 'light') {
        setMode(saved);
      } else if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
        setMode('dark');
      }
    } catch {
      /* ignore */
    }
    setMounted(true);
  }, []);

  // Persist theme changes.
  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem('tt-theme', mode);
    } catch {
      /* ignore */
    }
  }, [mode, mounted]);

  // Bootstrap the SW + notification rescheduler once on mount.
  useEffect(() => {
    bootstrapNotifications().catch(() => {});
  }, []);

  const theme = useMemo(() => buildTheme(mode), [mode]);
  const ctx = useMemo(
    () => ({
      mode,
      toggle: () => setMode((m) => (m === 'light' ? 'dark' : 'light')),
    }),
    [mode]
  );

  return (
    <ThemeModeContext.Provider value={ctx}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ThemeModeContext.Provider>
  );
}

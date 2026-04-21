/**
 * src/lib/theme.js
 * The TauntTable design system: calm, premium, Apple-Notes-meets-Notion.
 *
 * RADIUS is a single, unified value applied across every surface so the UI
 * never looks like a patchwork of different corner styles.
 */
import { createTheme } from '@mui/material/styles';

const R = 12;

const lightPalette = {
  mode: 'light',
  primary: { main: '#0f766e', light: '#2dd4bf', dark: '#115e59', contrastText: '#ffffff' },
  secondary: { main: '#7c6fb1', light: '#a78bfa', dark: '#5b4f8a', contrastText: '#ffffff' },
  success: { main: '#16a34a', light: '#86efac', dark: '#166534' },
  warning: { main: '#d97706', light: '#fcd34d', dark: '#92400e' },
  info: { main: '#0284c7', light: '#7dd3fc', dark: '#075985' },
  error: { main: '#b45309', light: '#fde68a', dark: '#78350f' },
  background: { default: '#fafaf7', paper: '#ffffff' },
  text: { primary: '#1f2933', secondary: '#52606d', disabled: '#9aa5b1' },
  divider: 'rgba(15, 23, 42, 0.08)',
};

const darkPalette = {
  mode: 'dark',
  primary: { main: '#2dd4bf', light: '#5eead4', dark: '#14b8a6', contrastText: '#0f172a' },
  secondary: { main: '#a78bfa', light: '#c4b5fd', dark: '#7c3aed', contrastText: '#0f172a' },
  success: { main: '#34d399', light: '#86efac', dark: '#059669' },
  warning: { main: '#fbbf24', light: '#fde68a', dark: '#b45309' },
  info: { main: '#38bdf8', light: '#7dd3fc', dark: '#0369a1' },
  error: { main: '#fbbf24', light: '#fde68a', dark: '#b45309' },
  background: { default: '#0b1220', paper: '#111827' },
  text: { primary: '#f1f5f9', secondary: '#94a3b8', disabled: '#475569' },
  divider: 'rgba(255, 255, 255, 0.08)',
};

export function buildTheme(mode = 'light') {
  const palette = mode === 'dark' ? darkPalette : lightPalette;

  return createTheme({
    palette,
    shape: { borderRadius: R },
    typography: {
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
      h1: { fontWeight: 700, letterSpacing: '-0.02em' },
      h2: { fontWeight: 700, letterSpacing: '-0.02em' },
      h3: { fontWeight: 700, letterSpacing: '-0.015em' },
      h4: { fontWeight: 700, letterSpacing: '-0.01em' },
      h5: { fontWeight: 600, letterSpacing: '-0.005em' },
      h6: { fontWeight: 600 },
      subtitle1: { fontWeight: 500 },
      subtitle2: { fontWeight: 500 },
      button: { textTransform: 'none', fontWeight: 600, letterSpacing: 0 },
    },
    transitions: {
      create: () => 'none',
      duration: {
        shortest: 0, shorter: 0, short: 0, standard: 0, complex: 0,
        enteringScreen: 0, leavingScreen: 0,
      },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: { backgroundColor: palette.background.default, color: palette.text.primary },
        },
      },
      MuiPaper: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: ({ theme }) => ({
            backgroundImage: 'none',
            borderRadius: R,
            border: `1px solid ${theme.palette.divider}`,
          }),
        },
      },
      MuiCard: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: ({ theme }) => ({
            borderRadius: R,
            border: `1px solid ${theme.palette.divider}`,
            backgroundColor: theme.palette.background.paper,
            backgroundImage: 'none',
          }),
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true, disableRipple: true },
        styleOverrides: {
          root: { borderRadius: R, paddingInline: 16, paddingBlock: 8 },
          containedPrimary: ({ theme }) => ({
            boxShadow: 'none',
            '&:hover': { boxShadow: 'none', backgroundColor: theme.palette.primary.dark },
          }),
        },
      },
      MuiIconButton: {
        defaultProps: { disableRipple: true },
        styleOverrides: { root: { borderRadius: R } },
      },
      MuiChip: {
        styleOverrides: {
          root: ({ theme }) => ({
            borderRadius: R,
            fontWeight: 500,
            border: `1px solid ${theme.palette.divider}`,
            backgroundColor:
              theme.palette.mode === 'dark'
                ? 'rgba(255,255,255,0.04)'
                : 'rgba(15,23,42,0.03)',
          }),
          colorPrimary: ({ theme }) => ({
            backgroundColor:
              theme.palette.mode === 'dark'
                ? 'rgba(45, 212, 191, 0.16)'
                : 'rgba(15, 118, 110, 0.10)',
            color: theme.palette.primary.main,
            borderColor: 'transparent',
          }),
        },
      },
      MuiTextField: { defaultProps: { variant: 'outlined', fullWidth: true } },
      MuiOutlinedInput: { styleOverrides: { root: { borderRadius: R } } },
      MuiDialog: { styleOverrides: { paper: { borderRadius: R } } },
      MuiAlert: { styleOverrides: { root: { borderRadius: R } } },
      MuiAppBar: {
        defaultProps: { elevation: 0, color: 'transparent' },
        styleOverrides: {
          root: ({ theme }) => ({
            backdropFilter: 'saturate(180%) blur(12px)',
            backgroundColor:
              theme.palette.mode === 'dark'
                ? 'rgba(11, 18, 32, 0.72)'
                : 'rgba(250, 250, 247, 0.72)',
            borderBottom: `1px solid ${theme.palette.divider}`,
          }),
        },
      },
      MuiBottomNavigation: {
        styleOverrides: { root: { borderRadius: 0 } },
      },
      MuiCheckbox: { defaultProps: { disableRipple: true } },
      MuiTooltip: {
        styleOverrides: {
          tooltip: ({ theme }) => ({
            backgroundColor: theme.palette.text.primary,
            color: theme.palette.background.paper,
            borderRadius: R,
            fontWeight: 500,
          }),
        },
      },
    },
  });
}

export const RADIUS = R;
export const RADII = { sm: R, md: R, lg: R, xl: R };

/**
 * src/lib/theme.js
 * Minimal stub theme — full premium theme arrives in a later commit.
 */
import { createTheme } from '@mui/material/styles';

export function buildTheme(mode = 'light') {
  return createTheme({ palette: { mode } });
}

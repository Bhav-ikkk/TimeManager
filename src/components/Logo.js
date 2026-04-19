'use client';

/**
 * src/components/Logo.js
 * Inline SVG logo so it inherits theme color and stays crisp on every screen.
 */
import { useTheme } from '@mui/material/styles';

export default function Logo({ size = 28 }) {
  const theme = useTheme();
  const stroke = theme.palette.primary.contrastText;
  const tile = theme.palette.primary.main;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      role="img"
      aria-label="TauntTable logo"
    >
      <rect x="0" y="0" width="512" height="512" rx="112" ry="112" fill={tile} />
      <g
        transform="translate(128 96)"
        fill="none"
        stroke={stroke}
        strokeWidth="18"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M0 0 H256" />
        <path d="M0 320 H256" />
        <path d="M16 0 C16 96, 240 96, 240 0" />
        <path d="M16 320 C16 224, 240 224, 240 320" />
      </g>
      <rect x="252" y="170" width="8" height="160" rx="3" fill="#fcd34d" />
    </svg>
  );
}

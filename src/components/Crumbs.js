'use client';

/**
 * src/components/Crumbs.js
 * Soft, rounded breadcrumbs in the calm Apple-style.
 */
import { Breadcrumbs, Typography } from '@mui/material';
import { IconChevronRight } from '@tabler/icons-react';
import Link from 'next/link';

export default function Crumbs({ items }) {
  return (
    <Breadcrumbs
      separator={<IconChevronRight size={14} />}
      sx={(t) => ({
        '& .MuiBreadcrumbs-separator': { color: t.palette.text.disabled, mx: 0.5 },
      })}
    >
      {items.map((it, i) => {
        const last = i === items.length - 1;
        if (last || !it.href) {
          return (
            <Typography
              key={i}
              variant="caption"
              sx={(t) => ({
                px: 1,
                py: 0.25,
                borderRadius: 999,
                bgcolor:
                  t.palette.mode === 'dark'
                    ? 'rgba(255,255,255,0.05)'
                    : 'rgba(15,23,42,0.04)',
                color: 'text.primary',
                fontWeight: 500,
              })}
            >
              {it.label}
            </Typography>
          );
        }
        return (
          <Link key={i} href={it.href} style={{ textDecoration: 'none' }}>
            <Typography
              variant="caption"
              sx={{ color: 'text.secondary', fontWeight: 500, '&:hover': { color: 'primary.main' } }}
            >
              {it.label}
            </Typography>
          </Link>
        );
      })}
    </Breadcrumbs>
  );
}

'use client';

/**
 * src/components/HeroCover.js
 * Premium cover header for the Today screen.
 *
 * Renders a soft gradient card with a time-aware greeting, the day, the
 * completion progress, and a quiet quote of the day. No animation per the
 * design brief — visual weight comes from typography and tone, not motion.
 */
import { useEffect, useState } from 'react';
import { Box, Stack, Typography, Chip, LinearProgress } from '@mui/material';
import { format } from 'date-fns';
import { pickQuoteAsync, pickQuote } from '@/lib/quotes';

function greet(date) {
  const h = date.getHours();
  if (h < 5) return 'Still up?';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 22) return 'Good evening';
  return 'Late night';
}

export default function HeroCover({ name = 'you', total = 0, done = 0, date = new Date() }) {
  const [quote, setQuote] = useState(() => pickQuote(date.getDate()));

  useEffect(() => {
    let cancelled = false;
    pickQuoteAsync(date.getDate())
      .then((q) => {
        if (!cancelled) setQuote(q);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // Depend on the day-of-month, not the Date object itself, so we don't
    // re-fetch the quote every render when the parent passes `new Date()`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date.getFullYear(), date.getMonth(), date.getDate()]);

  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const allDone = total > 0 && done === total;

  return (
    <Box
      sx={(t) => ({
        position: 'relative',
        overflow: 'hidden',
        borderRadius: `${t.shape.borderRadius}px`,
        border: `1px solid ${t.palette.divider}`,
        p: { xs: 2.25, sm: 3 },
        background:
          t.palette.mode === 'dark'
            ? 'radial-gradient(120% 140% at 0% 0%, rgba(45,212,191,0.20) 0%, rgba(167,139,250,0.10) 38%, rgba(11,18,32,0) 70%), linear-gradient(180deg, #0f172a 0%, #111827 100%)'
            : 'radial-gradient(120% 140% at 0% 0%, rgba(15,118,110,0.14) 0%, rgba(124,111,177,0.10) 38%, rgba(250,250,247,0) 70%), linear-gradient(180deg, #ffffff 0%, #f7f7f3 100%)',
      })}
    >
      {/* decorative blob */}
      <Box
        aria-hidden
        sx={(t) => ({
          position: 'absolute',
          right: -40,
          top: -40,
          width: 180,
          height: 180,
          borderRadius: '50%',
          filter: 'blur(40px)',
          opacity: 0.55,
          background:
            t.palette.mode === 'dark'
              ? 'radial-gradient(circle, rgba(45,212,191,0.45), transparent 60%)'
              : 'radial-gradient(circle, rgba(15,118,110,0.30), transparent 60%)',
          pointerEvents: 'none',
        })}
      />
      <Stack spacing={1.5} sx={{ position: 'relative' }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
          <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 1.2 }}>
            {format(date, 'EEEE · d MMMM')}
          </Typography>
          <Box sx={{ flex: 1 }} />
          <Chip
            size="small"
            color={allDone ? 'primary' : 'default'}
            label={total === 0 ? 'No tasks yet' : allDone ? 'Day cleared' : `${done}/${total} done`}
          />
        </Stack>

        <Box>
          <Typography
            variant="h4"
            sx={{ fontWeight: 700, letterSpacing: '-0.015em', lineHeight: 1.15 }}
          >
            {greet(date)}, {name}.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, maxWidth: 520 }}>
            {total === 0
              ? 'Plan one thing for now. The rest will follow.'
              : allDone
                ? 'Every scheduled task is done. Quiet beast mode.'
                : 'Pick the next task and give it your full attention.'}
          </Typography>
        </Box>

        {total > 0 ? (
          <Box sx={{ mt: 0.5 }}>
            <LinearProgress
              variant="determinate"
              value={pct}
              sx={(t) => ({
                height: 6,
                borderRadius: 999,
                bgcolor:
                  t.palette.mode === 'dark'
                    ? 'rgba(255,255,255,0.08)'
                    : 'rgba(15,23,42,0.06)',
                '& .MuiLinearProgress-bar': { borderRadius: 999 },
              })}
            />
            <Stack direction="row" sx={{ justifyContent: 'space-between', mt: 0.5 }}>
              <Typography variant="caption" color="text.secondary">
                {pct}% complete
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {total - done} remaining
              </Typography>
            </Stack>
          </Box>
        ) : null}

        <Box
          sx={(t) => ({
            mt: 1,
            pt: 1.25,
            borderTop: `1px dashed ${t.palette.divider}`,
          })}
        >
          <Typography
            variant="body2"
            sx={{ fontStyle: 'italic', color: 'text.secondary', lineHeight: 1.55 }}
          >
            “{quote}”
          </Typography>
        </Box>
      </Stack>
    </Box>
  );
}

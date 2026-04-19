'use client';

/**
 * src/components/EmptyState.js
 * Calm, friendly empty placeholder used on Today and Journal screens.
 */
import { Box, Stack, Typography } from '@mui/material';

export default function EmptyState({ icon, title, body, action }) {
  return (
    <Box
      sx={(t) => ({
        textAlign: 'center',
        py: 6,
        px: 3,
        border: `1px dashed ${t.palette.divider}`,
        borderRadius: 3,
      })}
    >
      <Stack spacing={1.5} alignItems="center">
        {icon ? <Box sx={{ color: 'text.secondary' }}>{icon}</Box> : null}
        <Typography variant="h6">{title}</Typography>
        {body ? (
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 320 }}>
            {body}
          </Typography>
        ) : null}
        {action}
      </Stack>
    </Box>
  );
}

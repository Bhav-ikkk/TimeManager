'use client';

/**
 * Today screen — placeholder while we wire up DB and tasks in upcoming commits.
 */
import { Stack, Typography } from '@mui/material';
import AppShell from '@/components/AppShell';

export default function HomePage() {
  return (
    <AppShell initial="B">
      <Stack spacing={1}>
        <Typography variant="h4">Today</Typography>
        <Typography variant="body2" color="text.secondary">
          Your day, planned. Tasks come online in the next commit.
        </Typography>
      </Stack>
    </AppShell>
  );
}

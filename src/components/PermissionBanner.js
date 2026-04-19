'use client';

/**
 * src/components/PermissionBanner.js
 * Small inline card prompting the user to enable browser notifications.
 * Hidden once permission is granted or denied.
 */
import { useEffect, useState } from 'react';
import { Stack, Typography, Button, Box } from '@mui/material';
import { IconBell } from '@tabler/icons-react';
import {
  notificationStatus,
  notificationsSupported,
  requestNotificationPermission,
  rescheduleAll,
} from '@/lib/notifications';

export default function PermissionBanner() {
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    if (!notificationsSupported()) {
      setStatus('unsupported');
      return;
    }
    setStatus(notificationStatus());
  }, []);

  if (status !== 'default') return null;

  async function enable() {
    const next = await requestNotificationPermission();
    setStatus(next);
    if (next === 'granted') await rescheduleAll();
  }

  return (
    <Stack
      direction="row"
      spacing={1.5}
      sx={(t) => ({
        alignItems: 'center',
        p: 1.5,
        border: `1px solid ${t.palette.divider}`,
        borderRadius: 1,
        bgcolor:
          t.palette.mode === 'dark'
            ? 'rgba(45, 212, 191, 0.06)'
            : 'rgba(15, 118, 110, 0.04)',
      })}
    >
      <Box sx={{ color: 'primary.main', display: 'flex' }}>
        <IconBell size={22} />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="subtitle2">Turn on reminders</Typography>
        <Typography variant="caption" color="text.secondary">
          We&apos;ll quietly nudge you at each task time. All on-device, free.
        </Typography>
      </Box>
      <Button size="small" variant="contained" onClick={enable}>
        Enable
      </Button>
    </Stack>
  );
}

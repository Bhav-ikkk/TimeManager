'use client';

/**
 * src/components/SettingsDialog.js
 * Tiny settings sheet — morning alarm time + notification status.
 */
import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  Button,
  Typography,
  Box,
  IconButton,
  Chip,
} from '@mui/material';
import { IconX } from '@tabler/icons-react';
import TimeField from './TimeField';
import {
  getMorningAlarm,
  setMorningAlarm,
  notificationStatus,
  requestNotificationPermission,
  rescheduleAll,
} from '@/lib/notifications';

export default function SettingsDialog({ open, onClose }) {
  const [time, setTime] = useState('07:00');
  const [perm, setPerm] = useState('default');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    getMorningAlarm().then(setTime).catch(() => {});
    setPerm(notificationStatus());
  }, [open]);

  async function handleSave() {
    setBusy(true);
    try {
      if (/^\d{2}:\d{2}$/.test(time)) {
        await setMorningAlarm(time);
      }
      await rescheduleAll();
      onClose?.();
    } finally {
      setBusy(false);
    }
  }

  async function enableNotifications() {
    const next = await requestNotificationPermission();
    setPerm(next);
    if (next === 'granted') await rescheduleAll();
  }

  const permLabel =
    perm === 'granted'
      ? 'Notifications on'
      : perm === 'denied'
        ? 'Blocked in browser'
        : perm === 'unsupported'
          ? 'Not supported here'
          : 'Not enabled yet';
  const permColor = perm === 'granted' ? 'primary' : 'default';

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box sx={{ flex: 1 }}>Settings</Box>
        <IconButton size="small" onClick={onClose} aria-label="Close">
          <IconX size={18} />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ borderColor: 'divider' }}>
        <Stack spacing={3}>
          <Stack spacing={1}>
            <Typography variant="subtitle2">Notifications</Typography>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <Chip size="small" color={permColor} label={permLabel} />
              {perm === 'default' ? (
                <Button size="small" variant="outlined" onClick={enableNotifications}>
                  Enable
                </Button>
              ) : null}
            </Stack>
            <Typography variant="caption" color="text.secondary">
              Reminders run on-device. No accounts, no cloud, no cost.
            </Typography>
          </Stack>

          <Stack spacing={1}>
            <Typography variant="subtitle2">Morning alarm</Typography>
            <TimeField label="Alarm time" value={time} onChange={setTime} />
            <Typography variant="caption" color="text.secondary">
              A friendly nudge to start the day, sent at this time.
            </Typography>
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button variant="contained" onClick={handleSave} disabled={busy}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}

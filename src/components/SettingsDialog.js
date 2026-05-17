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
  Switch,
  Alert,
  Divider,
} from '@mui/material';
import { IconX, IconBell, IconQuote, IconApple, IconBrandGithub } from '@tabler/icons-react';
import Link from 'next/link';
import AIProviderSettings from './AIProviderSettings';
import TimeField from './TimeField';
import { GITHUB_STAR_URL, getDietFeatureEnabled, setDietFeatureEnabled } from '@/lib/features';
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
  const [dietEnabled, setDietEnabled] = useState(false);
  const [dietWasEnabled, setDietWasEnabled] = useState(false);
  const [showDietSteps, setShowDietSteps] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    getMorningAlarm().then(setTime).catch(() => {});
    getDietFeatureEnabled()
      .then((enabled) => {
        setDietEnabled(enabled);
        setDietWasEnabled(enabled);
        setShowDietSteps(false);
      })
      .catch(() => {});
    setPerm(notificationStatus());
  }, [open]);

  async function handleSave() {
    setBusy(true);
    try {
      if (/^\d{2}:\d{2}$/.test(time)) {
        await setMorningAlarm(time);
      }
      await setDietFeatureEnabled(dietEnabled);
      setDietWasEnabled(dietEnabled);
      await rescheduleAll();
      onClose?.();
    } finally {
      setBusy(false);
    }
  }

  function handleDietToggle(event) {
    const next = event.target.checked;
    setDietEnabled(next);
    if (next && !dietWasEnabled) setShowDietSteps(true);
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
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
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

          <Divider />

          <AIProviderSettings />

          <Divider />

          <Stack spacing={1}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <IconApple size={18} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="subtitle2">Diet tracker</Typography>
                <Typography variant="caption" color="text.secondary">
                  Hidden from navigation until you activate it.
                </Typography>
              </Box>
              <Switch checked={dietEnabled} onChange={handleDietToggle} slotProps={{ input: { 'aria-label': 'Activate diet tracker' } }} />
            </Stack>
            {showDietSteps ? (
              <Alert severity="info" sx={{ alignItems: 'flex-start' }}>
                <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                  After saving
                </Typography>
                <Box component="ol" sx={{ m: 0, pl: 2.25 }}>
                  <Typography component="li" variant="caption">Open Calories from the top bar or bottom nav.</Typography>
                  <Typography component="li" variant="caption">Add your profile and optional AI key in Calorie settings.</Typography>
                  <Typography component="li" variant="caption">Log food, then run daily or range analysis when you want a report.</Typography>
                </Box>
              </Alert>
            ) : null}
          </Stack>

          <Stack spacing={1}>
            <Typography variant="subtitle2">More</Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<IconBell size={16} />}
                component={Link}
                href="/notifications"
                onClick={onClose}
              >
                Notification preferences
              </Button>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<IconQuote size={16} />}
                component={Link}
                href="/quotes"
                onClick={onClose}
              >
                Manage quotes
              </Button>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<IconBrandGithub size={16} />}
                component="a"
                href={GITHUB_STAR_URL}
                target="_blank"
                rel="noopener"
              >
                Star repo
              </Button>
            </Stack>
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

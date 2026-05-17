'use client';

import { useEffect, useState } from 'react';
import { Box, Button, IconButton, Stack, Typography } from '@mui/material';
import { IconDeviceMobile, IconDownload, IconX } from '@tabler/icons-react';

const DISMISSED_KEY = 'tt-install-prompt-dismissed';

function isStandaloneDisplay() {
  if (typeof window === 'undefined') return true;
  return Boolean(
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator?.standalone
  );
}

export default function InstallPrompt() {
  const [visible, setVisible] = useState(false);
  const [installEvent, setInstallEvent] = useState(null);

  useEffect(() => {
    if (isStandaloneDisplay()) return;
    try {
      if (localStorage.getItem(DISMISSED_KEY) === '1') return;
    } catch {
      return;
    }

    setVisible(true);

    function handleBeforeInstallPrompt(event) {
      event.preventDefault();
      setInstallEvent(event);
      setVisible(true);
    }

    function handleDisplayModeChange(event) {
      if (event.matches) setVisible(false);
    }

    const media = window.matchMedia?.('(display-mode: standalone)');
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    media?.addEventListener?.('change', handleDisplayModeChange);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      media?.removeEventListener?.('change', handleDisplayModeChange);
    };
  }, []);

  function dismiss() {
    try { localStorage.setItem(DISMISSED_KEY, '1'); } catch {}
    setVisible(false);
  }

  async function install() {
    if (!installEvent) return;
    try {
      await installEvent.prompt();
      const choice = await installEvent.userChoice;
      if (choice?.outcome === 'accepted') dismiss();
      setInstallEvent(null);
    } catch {
      setInstallEvent(null);
    }
  }

  if (!visible) return null;

  return (
    <Stack
      direction="row"
      spacing={1.5}
      sx={(theme) => ({
        alignItems: 'center',
        p: 1.5,
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: 1,
        bgcolor: theme.palette.mode === 'dark'
          ? 'rgba(167, 139, 250, 0.08)'
          : 'rgba(124, 111, 177, 0.06)',
      })}
    >
      <Box sx={{ color: 'secondary.main', display: 'flex' }}>
        <IconDeviceMobile size={22} />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="subtitle2">Install TauntTable</Typography>
        <Typography variant="caption" color="text.secondary">
          Add it to your home screen for the full app view. In Safari, use Share then Add to Home Screen.
        </Typography>
      </Box>
      {installEvent ? (
        <Button size="small" variant="contained" startIcon={<IconDownload size={16} />} onClick={install}>
          Install
        </Button>
      ) : null}
      <IconButton size="small" onClick={dismiss} aria-label="Dismiss install prompt">
        <IconX size={16} />
      </IconButton>
    </Stack>
  );
}
'use client';

import { useState } from 'react';
import { Alert, Box, Button, Card, Stack, Typography } from '@mui/material';
import { IconApple, IconCheck, IconSettings, IconSparkles } from '@tabler/icons-react';
import { setDietFeatureEnabled } from '@/lib/features';

export default function DietActivationPanel() {
  const [busy, setBusy] = useState(false);
  const [activated, setActivated] = useState(false);

  async function activate() {
    setBusy(true);
    try {
      await setDietFeatureEnabled(true);
      setActivated(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card sx={{ p: { xs: 2, sm: 2.5 } }}>
      <Stack spacing={2}>
        <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
          <Box sx={{ color: 'primary.main', display: 'flex' }}>
            <IconApple size={24} />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="h5">Diet tracker is off</Typography>
            <Typography variant="body2" color="text.secondary">
              Turn it on only when you want food logging and AI nutrition reports in the app.
            </Typography>
          </Box>
        </Stack>

        <Alert icon={<IconSettings size={20} />} severity="info">
          Go to Settings, switch on Diet tracker, then save. The Calories tab appears after activation.
        </Alert>

        <Box component="ol" sx={{ m: 0, pl: 2.5 }}>
          <Typography component="li" variant="body2">Open Calories and set your body profile.</Typography>
          <Typography component="li" variant="body2">Paste a Groq, Gemini, or OpenRouter key for AI analysis.</Typography>
          <Typography component="li" variant="body2">Log food by search or text, then run daily or range reports.</Typography>
        </Box>

        {activated ? (
          <Alert icon={<IconCheck size={20} />} severity="success">
            Diet tracker activated. Calories is now available in navigation.
          </Alert>
        ) : null}

        <Button
          variant="contained"
          startIcon={<IconSparkles size={18} />}
          onClick={activate}
          disabled={busy || activated}
        >
          Activate diet tracker
        </Button>
      </Stack>
    </Card>
  );
}
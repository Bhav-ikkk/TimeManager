'use client';

/**
 * src/components/TopBar.js
 * Minimal top bar: logo + title on the left, theme toggle + avatar on the right.
 * Sits sticky at the top with a subtle blur. No animation per the brief.
 */
import { useState } from 'react';
import { AppBar, Toolbar, Box, Typography, IconButton, Avatar, Tooltip } from '@mui/material';
import { IconSun, IconMoon, IconNotebook, IconSettings, IconBell, IconChartBar, IconApple } from '@tabler/icons-react';
import Link from 'next/link';
import { useThemeMode } from '@/app/providers';
import Logo from './Logo';
import SettingsDialog from './SettingsDialog';

export default function TopBar({ initial = 'B' }) {
  const { mode, toggle } = useThemeMode();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const isDark = mode === 'dark';

  return (
    <AppBar position="sticky">
      <Toolbar
        sx={{
          gap: 1,
          minHeight: { xs: 56, sm: 64 },
          paddingTop: 'var(--safe-top)',
        }}
      >
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Logo size={28} />
          <Typography variant="subtitle1" sx={{ fontWeight: 700, letterSpacing: '-0.01em' }}>
            TauntTable
          </Typography>
        </Link>

        <Box sx={{ flex: 1 }} />

        <Tooltip title="Journal">
          <IconButton
            component={Link}
            href="/journal"
            aria-label="Open journal"
            sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
          >
            <IconNotebook size={20} />
          </IconButton>
        </Tooltip>

        <Tooltip title="Calories">
          <IconButton
            component={Link}
            href="/calories"
            aria-label="Open calorie tracker"
            sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
          >
            <IconApple size={20} />
          </IconButton>
        </Tooltip>

        <Tooltip title="Summary">
          <IconButton
            component={Link}
            href="/summary"
            aria-label="Open summary"
            sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
          >
            <IconChartBar size={20} />
          </IconButton>
        </Tooltip>

        <Tooltip title="Notifications">
          <IconButton
            component={Link}
            href="/notifications"
            aria-label="Notification preferences"
          >
            <IconBell size={20} />
          </IconButton>
        </Tooltip>

        <Tooltip title={isDark ? 'Light mode' : 'Dark mode'}>
          <IconButton onClick={toggle} aria-label="Toggle theme">
            {isDark ? <IconSun size={20} /> : <IconMoon size={20} />}
          </IconButton>
        </Tooltip>

        <Tooltip title="Settings">
          <IconButton
            onClick={() => setSettingsOpen(true)}
            aria-label="Open settings"
            sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
          >
            <IconSettings size={20} />
          </IconButton>
        </Tooltip>

        <Avatar
          sx={(t) => ({
            width: 32,
            height: 32,
            ml: 0.5,
            fontSize: 14,
            fontWeight: 600,
            bgcolor:
              t.palette.mode === 'dark'
                ? 'rgba(45, 212, 191, 0.18)'
                : 'rgba(15, 118, 110, 0.10)',
            color: t.palette.primary.main,
          })}
          alt={initial}
        >
          {initial}
        </Avatar>
      </Toolbar>
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </AppBar>
  );
}

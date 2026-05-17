'use client';

/**
 * src/components/BottomNav.js
 * Mobile-only bottom navigation. Hidden on >= sm breakpoints.
 */
import { useState } from 'react';
import { Paper, BottomNavigation, BottomNavigationAction, Box } from '@mui/material';
import { IconHome, IconNotebook, IconQuote, IconChartBar, IconApple } from '@tabler/icons-react';
import { useRouter, usePathname } from 'next/navigation';
import { useDietFeatureEnabled } from '@/hooks/useDietFeatureEnabled';
import SettingsDialog from './SettingsDialog';

export default function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { enabled: dietEnabled } = useDietFeatureEnabled();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const value = pathname?.startsWith('/journal')
    ? 'journal'
    : pathname?.startsWith('/quotes')
      ? 'quotes'
      : pathname?.startsWith('/summary')
        ? 'summary'
        : dietEnabled && pathname?.startsWith('/calories')
          ? 'calories'
          : 'home';

  return (
    <>
      <Box sx={{ display: { xs: 'block', sm: 'none' } }}>
        <Paper
          elevation={0}
          sx={(t) => ({
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: t.zIndex.appBar,
            borderRadius: 0,
            borderTop: `1px solid ${t.palette.divider}`,
            backdropFilter: 'saturate(180%) blur(12px)',
            backgroundColor:
              t.palette.mode === 'dark'
                ? 'rgba(11, 18, 32, 0.85)'
                : 'rgba(250, 250, 247, 0.85)',
            paddingBottom: 'var(--safe-bottom)',
          })}
        >
          <BottomNavigation
            value={value}
            showLabels
            sx={{
              bgcolor: 'transparent',
              height: 60,
              // Five items get squeezed on narrow phones — shrink labels and
              // padding so nothing wraps or clips.
              '& .MuiBottomNavigationAction-root': {
                minWidth: 0,
                padding: '6px 4px',
              },
              '& .MuiBottomNavigationAction-label': {
                fontSize: '0.7rem',
                lineHeight: 1.1,
                marginTop: '2px',
              },
              '& .MuiBottomNavigationAction-label.Mui-selected': {
                fontSize: '0.72rem',
              },
            }}
            onChange={(_, v) => {
              if (v === 'home') router.push('/');
              else if (v === 'journal') router.push('/journal');
              else if (v === 'quotes') router.push('/quotes');
              else if (v === 'summary') router.push('/summary');
              else if (dietEnabled && v === 'calories') router.push('/calories');
            }}
          >
            <BottomNavigationAction value="home" label="Today" icon={<IconHome size={20} />} />
            {dietEnabled ? (
              <BottomNavigationAction value="calories" label="Calories" icon={<IconApple size={20} />} />
            ) : null}
            <BottomNavigationAction value="summary" label="Summary" icon={<IconChartBar size={20} />} />
            <BottomNavigationAction value="journal" label="Journal" icon={<IconNotebook size={20} />} />
            <BottomNavigationAction value="quotes" label="Quotes" icon={<IconQuote size={20} />} />
          </BottomNavigation>
        </Paper>
      </Box>
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}

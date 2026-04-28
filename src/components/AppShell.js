'use client';

/**
 * src/components/AppShell.js
 * Page wrapper that slots a sticky TopBar and a centered main column.
 */
import { Box, Container } from '@mui/material';
import { usePathname } from 'next/navigation';
import TopBar from './TopBar';
import BottomNav from './BottomNav';

export default function AppShell({ children, initial }) {
  const pathname = usePathname();
  // Today page renders a floating FAB — reserve extra room for it. Other
  // routes only need to clear the bottom nav on mobile.
  const isHome = pathname === '/' || pathname === '';
  return (
    <Box sx={{ minHeight: '100dvh', bgcolor: 'background.default' }}>
      <TopBar initial={initial} />
      <Container
        maxWidth="sm"
        component="main"
        sx={{
          pt: { xs: 2, sm: 3 },
          pb: {
            xs: isHome
              ? 'calc(140px + var(--safe-bottom))'
              : 'calc(84px + var(--safe-bottom))',
            sm: 'calc(56px + var(--safe-bottom))',
          },
        }}
      >
        {children}
      </Container>
      <BottomNav />
    </Box>
  );
}

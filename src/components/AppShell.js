'use client';

/**
 * src/components/AppShell.js
 * Page wrapper that slots a sticky TopBar and a centered main column.
 */
import { Box, Container } from '@mui/material';
import TopBar from './TopBar';
import BottomNav from './BottomNav';

export default function AppShell({ children, initial }) {
  return (
    <Box sx={{ minHeight: '100dvh', bgcolor: 'background.default' }}>
      <TopBar initial={initial} />
      <Container
        maxWidth="sm"
        component="main"
        sx={{
          pt: { xs: 2, sm: 3 },
          // Leave room for both the floating FAB and the 60px bottom-nav on mobile.
          pb: { xs: 'calc(140px + var(--safe-bottom))', sm: 'calc(56px + var(--safe-bottom))' },
        }}
      >
        {children}
      </Container>
      <BottomNav />
    </Box>
  );
}

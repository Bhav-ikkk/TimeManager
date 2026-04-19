'use client';

/**
 * src/components/AppShell.js
 * Page wrapper that slots a sticky TopBar and a centered main column.
 */
import { Box, Container } from '@mui/material';
import TopBar from './TopBar';

export default function AppShell({ children, initial }) {
  return (
    <Box sx={{ minHeight: '100dvh', bgcolor: 'background.default' }}>
      <TopBar initial={initial} />
      <Container
        maxWidth="sm"
        component="main"
        sx={{
          pt: { xs: 2, sm: 3 },
          pb: 'calc(96px + var(--safe-bottom))',
        }}
      >
        {children}
      </Container>
    </Box>
  );
}

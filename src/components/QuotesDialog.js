'use client';

/**
 * src/components/QuotesDialog.js
 * Manage user-added motivational quotes that mix into reminders at random.
 */
import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  TextField,
  Button,
  Typography,
  Box,
  IconButton,
  Chip,
} from '@mui/material';
import { IconX, IconPlus, IconTrash } from '@tabler/icons-react';
import { getCustomQuotes, addCustomQuote, removeCustomQuote } from '@/lib/db';
import { QUOTES } from '@/lib/quotes';

const MAX_LEN = 140;

export default function QuotesDialog({ open, onClose }) {
  const [list, setList] = useState([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDraft('');
    getCustomQuotes().then(setList).catch(() => setList([]));
  }, [open]);

  async function handleAdd() {
    const text = draft.trim();
    if (!text) return;
    setBusy(true);
    try {
      await addCustomQuote(text);
      setList(await getCustomQuotes());
      setDraft('');
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(text) {
    setBusy(true);
    try {
      await removeCustomQuote(text);
      setList(await getCustomQuotes());
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box sx={{ flex: 1 }}>Your quotes</Box>
        <IconButton size="small" onClick={onClose} aria-label="Close">
          <IconX size={18} />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ borderColor: 'divider' }}>
        <Stack spacing={2.5}>
          <Stack spacing={1}>
            <Typography variant="subtitle2">Add a new line</Typography>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1}
              sx={{ alignItems: { xs: 'stretch', sm: 'flex-start' } }}
            >
              <TextField
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Write something that fires you up…"
                multiline
                minRows={1}
                maxRows={3}
                slotProps={{ htmlInput: { maxLength: MAX_LEN } }}
              />
              <Button
                variant="contained"
                onClick={handleAdd}
                disabled={busy || !draft.trim()}
                startIcon={<IconPlus size={16} />}
                sx={{ flexShrink: 0, alignSelf: { xs: 'stretch', sm: 'auto' } }}
              >
                Add
              </Button>
            </Stack>
            <Typography variant="caption" color="text.secondary">
              Stored on this device only. Mixed in randomly with the built-in lines.
            </Typography>
          </Stack>

          <Stack spacing={1}>
            <Typography variant="subtitle2">Your lines ({list.length})</Typography>
            {list.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No custom quotes yet.
              </Typography>
            ) : (
              <Stack spacing={0.75}>
                {list.map((q) => (
                  <Stack
                    key={q}
                    direction="row"
                    spacing={1}
                    sx={{
                      alignItems: 'center',
                      p: 1,
                      borderRadius: 1,
                      border: (t) => `1px solid ${t.palette.divider}`,
                    }}
                  >
                    <Typography variant="body2" sx={{ flex: 1, lineHeight: 1.4 }}>
                      {q}
                    </Typography>
                    <IconButton
                      size="small"
                      onClick={() => handleRemove(q)}
                      aria-label={`Remove quote: ${q}`}
                    >
                      <IconTrash size={16} />
                    </IconButton>
                  </Stack>
                ))}
              </Stack>
            )}
          </Stack>

          <Stack spacing={1}>
            <Typography variant="subtitle2">Built-in lines ({QUOTES.length})</Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {QUOTES.slice(0, 6).map((q) => (
                <Chip key={q} size="small" label={q} />
              ))}
              {QUOTES.length > 6 ? (
                <Chip size="small" label={`+${QUOTES.length - 6} more`} />
              ) : null}
            </Box>
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose}>Done</Button>
      </DialogActions>
    </Dialog>
  );
}

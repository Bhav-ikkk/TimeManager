'use client';

/**
 * src/app/quotes/page.js — Quote library.
 *
 * Three sections:
 *   - Add a new line (your own).
 *   - Favourites (built-in or yours, starred). Used more often in nudges.
 *   - All quotes — your custom lines plus the built-ins, each with a star
 *     toggle and (for custom lines) a delete button.
 */
import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  Stack,
  Typography,
  Box,
  Card,
  TextField,
  Button,
  IconButton,
  Chip,
  ToggleButton,
  ToggleButtonGroup,
  Alert,
} from '@mui/material';
import {
  IconPlus,
  IconTrash,
  IconStar,
  IconStarFilled,
  IconQuote,
} from '@tabler/icons-react';
import AppShell from '@/components/AppShell';
import Crumbs from '@/components/Crumbs';
import {
  getCustomQuotes,
  addCustomQuote,
  removeCustomQuote,
  getFavoriteQuotes,
  toggleFavoriteQuote,
} from '@/lib/db';
import { QUOTES } from '@/lib/quotes';

const MAX_LEN = 140;

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'favs', label: 'Favourites' },
  { value: 'mine', label: 'Yours' },
  { value: 'builtin', label: 'Built-in' },
];

export default function QuotesPage() {
  const [custom, setCustom] = useState([]);
  const [favs, setFavs] = useState([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState('all');

  const refresh = useCallback(async () => {
    const [c, f] = await Promise.all([getCustomQuotes(), getFavoriteQuotes()]);
    setCustom(c);
    setFavs(f);
  }, []);

  useEffect(() => {
    refresh().catch(() => {});
  }, [refresh]);

  const favSet = useMemo(() => new Set(favs), [favs]);
  const customSet = useMemo(() => new Set(custom), [custom]);

  const items = useMemo(() => {
    const all = [
      ...custom.map((q) => ({ text: q, source: 'mine' })),
      ...QUOTES.map((q) => ({ text: q, source: 'builtin' })),
    ];
    return all
      .map((it) => ({ ...it, fav: favSet.has(it.text) }))
      .filter((it) => {
        if (filter === 'favs') return it.fav;
        if (filter === 'mine') return it.source === 'mine';
        if (filter === 'builtin') return it.source === 'builtin';
        return true;
      });
  }, [custom, favSet, filter]);

  async function handleAdd() {
    const text = draft.trim();
    if (!text) return;
    setBusy(true);
    try {
      await addCustomQuote(text);
      setDraft('');
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(text) {
    setBusy(true);
    try {
      await removeCustomQuote(text);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleFav(text) {
    await toggleFavoriteQuote(text);
    await refresh();
  }

  return (
    <AppShell initial="B">
      <Stack spacing={3}>
        <Box>
          <Crumbs items={[{ label: 'Today', href: '/' }, { label: 'Quotes' }]} />
          <Typography variant="h4" sx={{ mt: 1 }}>
            Quotes
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Star the lines that hit you the hardest — they will appear more
            often in your daily nudges.
          </Typography>
        </Box>

        <Card sx={{ p: 2 }}>
          <Stack spacing={1.25}>
            <Typography variant="subtitle2">Add your own line</Typography>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1}
              sx={{ alignItems: { xs: 'stretch', sm: 'flex-start' } }}
            >
              <TextField
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Write something that fires you up\u2026"
                multiline
                minRows={1}
                maxRows={3}
                slotProps={{ htmlInput: { maxLength: MAX_LEN } }}
              />
              <Button
                variant="contained"
                startIcon={<IconPlus size={16} />}
                onClick={handleAdd}
                disabled={busy || !draft.trim()}
                sx={{ flexShrink: 0, alignSelf: { xs: 'stretch', sm: 'auto' } }}
              >
                Add
              </Button>
            </Stack>
            <Typography variant="caption" color="text.secondary">
              Lines stay on this device only. {custom.length} custom · {favs.length} favourites.
            </Typography>
          </Stack>
        </Card>

        <ToggleButtonGroup
          value={filter}
          exclusive
          onChange={(_, v) => v && setFilter(v)}
          fullWidth
          size="small"
          sx={{ flexWrap: 'wrap' }}
        >
          {FILTERS.map((f) => (
            <ToggleButton key={f.value} value={f.value} sx={{ flex: 1, minWidth: 80 }}>
              {f.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>

        {items.length === 0 ? (
          <Alert severity="info" icon={<IconQuote size={20} />}>
            Nothing here yet. Try a different filter or add your first line above.
          </Alert>
        ) : (
          <Stack spacing={1}>
            {items.map((it) => (
              <Card key={`${it.source}-${it.text}`} sx={{ p: 1.5 }}>
                <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
                  <IconButton
                    size="small"
                    onClick={() => handleToggleFav(it.text)}
                    aria-label={it.fav ? 'Unstar quote' : 'Star quote'}
                    sx={{ color: it.fav ? 'warning.main' : 'text.disabled' }}
                  >
                    {it.fav ? <IconStarFilled size={18} /> : <IconStar size={18} />}
                  </IconButton>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" sx={{ lineHeight: 1.45 }}>
                      {it.text}
                    </Typography>
                    <Stack direction="row" spacing={0.75} sx={{ mt: 0.5 }}>
                      <Chip
                        size="small"
                        label={it.source === 'mine' ? 'Yours' : 'Built-in'}
                        color={it.source === 'mine' ? 'primary' : 'default'}
                        variant={it.source === 'mine' ? 'filled' : 'outlined'}
                      />
                      {it.fav ? (
                        <Chip size="small" label="Favourite" color="warning" variant="outlined" />
                      ) : null}
                    </Stack>
                  </Box>
                  {customSet.has(it.text) ? (
                    <IconButton
                      size="small"
                      onClick={() => handleRemove(it.text)}
                      aria-label="Delete quote"
                    >
                      <IconTrash size={16} />
                    </IconButton>
                  ) : null}
                </Stack>
              </Card>
            ))}
          </Stack>
        )}
      </Stack>
    </AppShell>
  );
}

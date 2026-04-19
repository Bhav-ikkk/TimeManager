'use client';

/**
 * src/app/journal/page.js — End-of-day journal.
 *
 * The user writes a short note about the day, taps "Save & Review", and we:
 *   - persist the journal entry locally
 *   - compare today's tasks vs completions
 *   - show either a calm praise or a sharp roast
 *   - fire a notification with the verdict so it lands on the lock screen
 */
import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import {
  Stack,
  Typography,
  Box,
  Button,
  TextField,
  Card,
  Chip,
  Alert,
} from '@mui/material';
import { IconMoodSmile, IconFlame } from '@tabler/icons-react';
import AppShell from '@/components/AppShell';
import Crumbs from '@/components/Crumbs';
import SkeletonList from '@/components/SkeletonList';
import { useToday } from '@/hooks/useToday';
import { getJournal, saveJournal, todayKey } from '@/lib/db';
import { verdictFor } from '@/lib/scoring';
import { notificationsSupported, requestNotificationPermission } from '@/lib/notifications';

const MAX_NOTE = 800;

export default function JournalPage() {
  const today = new Date();
  const dateKey = todayKey(today);
  const { loading, tasks, isDone } = useToday(today);
  const [text, setText] = useState('');
  const [verdict, setVerdict] = useState(null);
  const [saving, setSaving] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getJournal(dateKey)
      .then((row) => {
        if (cancelled) return;
        if (row) {
          setText(row.text || '');
          if (row.verdict) {
            setVerdict({
              verdict: row.verdict,
              message: row.message,
              missed: [],
              fromHistory: true,
            });
          }
        }
        setHydrated(true);
      })
      .catch(() => setHydrated(true));
    return () => {
      cancelled = true;
    };
  }, [dateKey]);

  const completedIds = useMemo(
    () => new Set(tasks.filter((t) => isDone(t.id)).map((t) => t.id)),
    [tasks, isDone]
  );

  async function handleSave() {
    setSaving(true);
    try {
      const v = verdictFor({ tasks, completedIds });
      await saveJournal({
        date: dateKey,
        text: text.trim().slice(0, MAX_NOTE),
        verdict: v.verdict,
        message: v.message,
        missedTaskIds: v.missed.map((t) => t.id),
      });
      setVerdict(v);

      // Push the verdict to a notification so it lands on the lock screen.
      if (notificationsSupported() && Notification.permission === 'default') {
        await requestNotificationPermission();
      }
      if (notificationsSupported() && Notification.permission === 'granted') {
        const reg = await navigator.serviceWorker?.ready;
        const title = v.verdict === 'praise' ? 'Earned it.' : v.verdict === 'roast' ? 'About today…' : 'Journal saved';
        if (reg && navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({
            type: 'show-notification',
            title,
            body: v.message,
            tag: `journal-${dateKey}`,
            icon: '/icons/icon-192.png',
            badge: '/icons/favicon-32.png',
          });
        } else if (reg) {
          reg.showNotification(title, { body: v.message, tag: `journal-${dateKey}` });
        }
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell initial="B">
      <Stack spacing={3}>
        <Box>
          <Crumbs
            items={[
              { label: 'Today', href: '/' },
              { label: 'Journal', href: '/journal' },
              { label: format(today, 'd MMM') },
            ]}
          />
          <Typography variant="h4" sx={{ mt: 1 }}>
            How did today go?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Write a short, honest note. We&apos;ll compare it to your timetable
            and either praise you or roast you.
          </Typography>
        </Box>

        {loading || !hydrated ? (
          <SkeletonList count={3} />
        ) : (
          <>
            <Card sx={{ p: 2 }}>
              <TextField
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="I actually did…"
                multiline
                minRows={6}
                maxRows={14}
                inputProps={{ maxLength: MAX_NOTE }}
                variant="standard"
                InputProps={{ disableUnderline: true }}
                sx={{
                  '& textarea': {
                    fontSize: 16,
                    lineHeight: 1.55,
                  },
                }}
              />
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  {text.length}/{MAX_NOTE}
                </Typography>
                <Button variant="contained" onClick={handleSave} disabled={saving}>
                  {verdict ? 'Save & Re-review' : 'Save & Review'}
                </Button>
              </Stack>
            </Card>

            {verdict ? <VerdictCard verdict={verdict} tasks={tasks} completedIds={completedIds} /> : null}

            <TaskSummary tasks={tasks} completedIds={completedIds} />
          </>
        )}
      </Stack>
    </AppShell>
  );
}

function VerdictCard({ verdict }) {
  const isPraise = verdict.verdict === 'praise';
  const isRoast = verdict.verdict === 'roast';
  return (
    <Alert
      icon={isPraise ? <IconMoodSmile size={22} /> : isRoast ? <IconFlame size={22} /> : null}
      severity={isPraise ? 'success' : isRoast ? 'warning' : 'info'}
      sx={(t) => ({
        borderRadius: 3,
        border: `1px solid ${t.palette.divider}`,
        bgcolor: t.palette.background.paper,
        '& .MuiAlert-message': { fontSize: 15, fontWeight: 500 },
      })}
    >
      {verdict.message}
    </Alert>
  );
}

function TaskSummary({ tasks, completedIds }) {
  if (!tasks.length) return null;
  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        Today&apos;s scoreboard
      </Typography>
      <Stack spacing={1}>
        {tasks.map((t) => {
          const done = completedIds.has(t.id);
          return (
            <Card key={t.id} sx={{ p: 1.25, opacity: done ? 0.7 : 1 }}>
              <Stack direction="row" spacing={1.25} alignItems="center">
                <Chip
                  size="small"
                  label={done ? 'Done' : 'Missed'}
                  color={done ? 'primary' : 'warning'}
                  variant="filled"
                />
                <Typography
                  variant="subtitle2"
                  sx={{ color: 'primary.main', fontVariantNumeric: 'tabular-nums' }}
                >
                  {t.time}
                </Typography>
                <Typography
                  variant="body2"
                  noWrap
                  sx={{ flex: 1, textDecoration: done ? 'line-through' : 'none' }}
                >
                  {t.title}
                </Typography>
              </Stack>
            </Card>
          );
        })}
      </Stack>
    </Box>
  );
}

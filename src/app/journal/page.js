'use client';

/**
 * src/app/journal/page.js — End-of-day journal with browseable history.
 *
 * The user writes a short note about the day, taps "Save & Review", and we:
 *   - persist the journal entry locally (one row per date)
 *   - compare today's tasks vs completions for a verdict
 *   - keep all past entries visible in a History list, openable to re-read
 *     or edit the note for that day
 */
import { useEffect, useMemo, useState, useCallback } from 'react';
import { format, parseISO } from 'date-fns';
import {
  Stack,
  Typography,
  Box,
  Button,
  TextField,
  Card,
  Chip,
  Alert,
  IconButton,
  Divider,
  Tooltip,
} from '@mui/material';
import {
  IconMoodSmile,
  IconFlame,
  IconChevronLeft,
  IconChevronRight,
  IconTrash,
  IconHistory,
  IconCalendarPlus,
} from '@tabler/icons-react';
import AppShell from '@/components/AppShell';
import Crumbs from '@/components/Crumbs';
import SkeletonList from '@/components/SkeletonList';
import { useToday } from '@/hooks/useToday';
import {
  getJournal,
  saveJournal,
  listJournals,
  deleteJournal,
  todayKey,
} from '@/lib/db';
import { verdictFor } from '@/lib/scoring';
import {
  notificationsSupported,
  requestNotificationPermission,
} from '@/lib/notifications';

const MAX_NOTE = 800;

function shiftDateKey(dateKey, days) {
  const d = parseISO(dateKey);
  d.setDate(d.getDate() + days);
  return todayKey(d);
}

export default function JournalPage() {
  const today = todayKey(new Date());
  const [viewDate, setViewDate] = useState(today);
  const isToday = viewDate === today;

  const dayDate = useMemo(() => parseISO(viewDate), [viewDate]);
  const { loading, tasks, isDone } = useToday(dayDate);

  const [text, setText] = useState('');
  const [verdict, setVerdict] = useState(null);
  const [saving, setSaving] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [history, setHistory] = useState([]);

  const refreshHistory = useCallback(() => {
    listJournals().then(setHistory).catch(() => setHistory([]));
  }, []);

  // Load the entry for whichever date the user is currently viewing.
  useEffect(() => {
    let cancelled = false;
    setHydrated(false);
    setVerdict(null);
    getJournal(viewDate)
      .then((row) => {
        if (cancelled) return;
        setText(row?.text || '');
        if (row?.verdict) {
          setVerdict({
            verdict: row.verdict,
            message: row.message,
            missed: [],
            fromHistory: true,
          });
        }
        setHydrated(true);
      })
      .catch(() => setHydrated(true));
    return () => {
      cancelled = true;
    };
  }, [viewDate]);

  useEffect(() => {
    refreshHistory();
  }, [refreshHistory]);

  const completedIds = useMemo(
    () => new Set(tasks.filter((t) => isDone(t.id)).map((t) => t.id)),
    [tasks, isDone]
  );

  async function handleSave() {
    setSaving(true);
    try {
      const v = verdictFor({ tasks, completedIds });
      await saveJournal({
        date: viewDate,
        text: text.trim().slice(0, MAX_NOTE),
        verdict: v.verdict,
        message: v.message,
        missedTaskIds: v.missed.map((t) => t.id),
      });
      setVerdict(v);
      refreshHistory();

      if (
        isToday &&
        notificationsSupported() &&
        Notification.permission === 'default'
      ) {
        await requestNotificationPermission();
      }
      if (
        isToday &&
        notificationsSupported() &&
        Notification.permission === 'granted'
      ) {
        const reg = await navigator.serviceWorker?.ready;
        const title =
          v.verdict === 'praise'
            ? 'Earned it.'
            : v.verdict === 'roast'
              ? 'About today…'
              : 'Journal saved';
        if (reg && navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({
            type: 'show-notification',
            title,
            body: v.message,
            tag: `journal-${viewDate}`,
            icon: '/icons/icon-192.png',
            badge: '/icons/favicon-32.png',
          });
        } else if (reg) {
          reg.showNotification(title, {
            body: v.message,
            tag: `journal-${viewDate}`,
          });
        }
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(date) {
    await deleteJournal(date);
    if (date === viewDate) {
      setText('');
      setVerdict(null);
    }
    refreshHistory();
  }

  return (
    <AppShell initial="B">
      <Stack spacing={3}>
        <Box>
          <Crumbs
            items={[
              { label: 'Today', href: '/' },
              { label: 'Journal', href: '/journal' },
              { label: format(dayDate, 'd MMM') },
            ]}
          />
          <Typography variant="h4" sx={{ mt: 1 }}>
            {isToday ? 'How did today go?' : `Journal · ${format(dayDate, 'EEEE, d MMM')}`}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {isToday
              ? 'Write a short, honest note. We\u2019ll compare it to your timetable and either praise you or roast you.'
              : 'Reading a past day. Edit the note and re-save anytime.'}
          </Typography>
        </Box>

        <DateNav viewDate={viewDate} setViewDate={setViewDate} today={today} />

        {loading || !hydrated ? (
          <SkeletonList count={3} />
        ) : (
          <>
            <Card sx={{ p: 2 }}>
              <TextField
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={isToday ? 'I actually did\u2026' : 'Looking back\u2026'}
                multiline
                minRows={6}
                maxRows={14}
                variant="standard"
                slotProps={{
                  htmlInput: { maxLength: MAX_NOTE },
                  input: { disableUnderline: true },
                }}
                sx={{ '& textarea': { fontSize: 16, lineHeight: 1.55 } }}
              />
              <Stack
                direction="row"
                sx={{ mt: 1, justifyContent: 'space-between', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}
              >
                <Typography variant="caption" color="text.secondary">
                  {text.length}/{MAX_NOTE}
                </Typography>
                <Stack direction="row" spacing={1}>
                  <Button variant="contained" onClick={handleSave} disabled={saving}>
                    {verdict ? 'Save & Re-review' : 'Save & Review'}
                  </Button>
                </Stack>
              </Stack>
            </Card>

            {verdict ? (
              <VerdictCard verdict={verdict} />
            ) : null}

            <TaskSummary tasks={tasks} completedIds={completedIds} />
          </>
        )}

        <HistoryList
          history={history}
          activeDate={viewDate}
          onOpen={setViewDate}
          onDelete={handleDelete}
        />
      </Stack>
    </AppShell>
  );
}

function DateNav({ viewDate, setViewDate, today }) {
  const isToday = viewDate === today;
  return (
    <Card sx={{ p: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
      <Tooltip title="Previous day">
        <IconButton
          size="small"
          onClick={() => setViewDate((d) => shiftDateKey(d, -1))}
          aria-label="Previous day"
        >
          <IconChevronLeft size={18} />
        </IconButton>
      </Tooltip>
      <Box sx={{ flex: 1, textAlign: 'center', minWidth: 0 }}>
        <Typography variant="subtitle2" noWrap>
          {format(parseISO(viewDate), 'EEE, d MMM yyyy')}
        </Typography>
      </Box>
      <Tooltip title="Next day">
        <span>
          <IconButton
            size="small"
            onClick={() => setViewDate((d) => shiftDateKey(d, 1))}
            aria-label="Next day"
            disabled={isToday}
          >
            <IconChevronRight size={18} />
          </IconButton>
        </span>
      </Tooltip>
      {!isToday ? (
        <Button
          size="small"
          variant="text"
          startIcon={<IconCalendarPlus size={16} />}
          onClick={() => setViewDate(today)}
        >
          Today
        </Button>
      ) : null}
    </Card>
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
        Scoreboard
      </Typography>
      <Stack spacing={1}>
        {tasks.map((t) => {
          const done = completedIds.has(t.id);
          return (
            <Card key={t.id} sx={{ p: 1.25, opacity: done ? 0.7 : 1 }}>
              <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
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

function HistoryList({ history, activeDate, onOpen, onDelete }) {
  return (
    <Box>
      <Stack
        direction="row"
        spacing={1}
        sx={{ alignItems: 'center', mb: 1 }}
      >
        <IconHistory size={18} />
        <Typography variant="subtitle2">History ({history.length})</Typography>
      </Stack>
      {history.length === 0 ? (
        <Card sx={{ p: 2 }}>
          <Typography variant="body2" color="text.secondary">
            No saved entries yet. Once you save a journal it will live here so
            you can revisit it any time.
          </Typography>
        </Card>
      ) : (
        <Stack spacing={1}>
          {history.map((row) => {
            const isActive = row.date === activeDate;
            const verdict = row.verdict;
            const verdictColor =
              verdict === 'praise' ? 'primary' : verdict === 'roast' ? 'warning' : 'default';
            const verdictLabel =
              verdict === 'praise' ? 'Praise' : verdict === 'roast' ? 'Roast' : 'Saved';
            return (
              <Card
                key={row.date}
                sx={(t) => ({
                  p: 1.5,
                  cursor: 'pointer',
                  borderColor: isActive ? t.palette.primary.main : t.palette.divider,
                })}
                onClick={() => onOpen(row.date)}
              >
                <Stack
                  direction="row"
                  spacing={1.25}
                  sx={{ alignItems: 'center' }}
                >
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Stack
                      direction="row"
                      spacing={1}
                      sx={{ alignItems: 'center', mb: 0.25, flexWrap: 'wrap', rowGap: 0.25 }}
                    >
                      <Typography
                        variant="subtitle2"
                        sx={{ fontVariantNumeric: 'tabular-nums' }}
                      >
                        {format(parseISO(row.date), 'EEE, d MMM yyyy')}
                      </Typography>
                      <Chip size="small" label={verdictLabel} color={verdictColor} />
                    </Stack>
                    {row.text ? (
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {row.text}
                      </Typography>
                    ) : (
                      <Typography variant="caption" color="text.disabled">
                        (no note written)
                      </Typography>
                    )}
                  </Box>
                  <Tooltip title="Delete entry">
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(row.date);
                      }}
                      aria-label={`Delete journal for ${row.date}`}
                    >
                      <IconTrash size={16} />
                    </IconButton>
                  </Tooltip>
                </Stack>
              </Card>
            );
          })}
        </Stack>
      )}
      <Divider sx={{ my: 2, opacity: 0 }} />
    </Box>
  );
}

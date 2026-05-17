'use client';

/**
 * src/app/summary/page.js — Range-based progress report.
 *
 * Lets the user pick a range (Week / Month / Year / Custom) and shows:
 *   - KPI cards (scheduled, completed, missed, completion rate, streak,
 *     best day, busiest day)
 *   - A month-grid calendar heatmap, navigable by month
 *   - A scrollable per-day breakdown listing skipped + completed tasks
 */
import { useEffect, useMemo, useState } from 'react';
import {
  format,
  parseISO,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  startOfDay,
  endOfDay,
  addDays,
  subDays,
  addMonths,
  isSameMonth,
  isSameDay,
  differenceInCalendarDays,
  isAfter,
  isBefore,
} from 'date-fns';
import {
  Stack,
  Typography,
  Box,
  Card,
  Chip,
  ToggleButton,
  ToggleButtonGroup,
  IconButton,
  Tooltip,
  LinearProgress,
  Divider,
  Button,
} from '@mui/material';
import {
  IconChartBar,
  IconChevronLeft,
  IconChevronRight,
  IconCircleCheck,
  IconCircleX,
  IconFlame,
  IconCalendarStats,
  IconCalendar,
  IconTrophy,
  IconTarget,
  IconClock,
} from '@tabler/icons-react';
import AppShell from '@/components/AppShell';
import Crumbs from '@/components/Crumbs';
import SkeletonList from '@/components/SkeletonList';
import { getRangeStats, todayKey } from '@/lib/db';

const RANGE_OPTIONS = [
  { value: 'week',   label: 'Week'   },
  { value: 'month',  label: 'Month'  },
  { value: 'year',   label: 'Year'   },
  { value: 'custom', label: 'Custom' },
];

function rangeBounds(kind, anchor = new Date()) {
  if (kind === 'week') {
    return {
      start: startOfWeek(anchor, { weekStartsOn: 1 }),
      end: endOfWeek(anchor, { weekStartsOn: 1 }),
    };
  }
  if (kind === 'month') {
    return { start: startOfMonth(anchor), end: endOfMonth(anchor) };
  }
  if (kind === 'year') {
    return { start: startOfYear(anchor), end: endOfYear(anchor) };
  }
  // custom defaults to last 30 days
  return { start: startOfDay(subDays(anchor, 29)), end: endOfDay(anchor) };
}

function shiftAnchor(kind, anchor, dir) {
  if (kind === 'week') return addDays(anchor, 7 * dir);
  if (kind === 'month') return addMonths(anchor, dir);
  if (kind === 'year') return addMonths(anchor, 12 * dir);
  return addDays(anchor, 30 * dir);
}

function formatRangeLabel(kind, start, end) {
  if (kind === 'week') {
    return `${format(start, 'd MMM')} – ${format(end, 'd MMM yyyy')}`;
  }
  if (kind === 'month') return format(start, 'MMMM yyyy');
  if (kind === 'year') return format(start, 'yyyy');
  return `${format(start, 'd MMM')} – ${format(end, 'd MMM yyyy')}`;
}

function computeStreak(days) {
  // longest streak of "all scheduled tasks done on a day that had at least one task"
  let best = 0;
  let cur = 0;
  for (const d of days) {
    if (d.scheduled === 0) {
      // empty days don't reset, don't extend
      continue;
    }
    if (d.completed === d.scheduled) {
      cur += 1;
      if (cur > best) best = cur;
    } else {
      cur = 0;
    }
  }
  return best;
}

function computeCurrentStreak(days) {
  // walk from today backwards while perfect (skipping no-task days)
  let s = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    const d = days[i];
    if (d.scheduled === 0) continue;
    if (d.completed === d.scheduled) s += 1;
    else break;
  }
  return s;
}

export default function SummaryPage() {
  const [kind, setKind] = useState('month');
  const [anchor, setAnchor] = useState(() => new Date());
  const [selectedDateKey, setSelectedDateKey] = useState(() => todayKey(new Date()));
  const [days, setDays] = useState(null);

  const { start, end } = useMemo(() => rangeBounds(kind, anchor), [kind, anchor]);

  useEffect(() => {
    let cancelled = false;
    setDays(null);
    getRangeStats(start, end)
      .then((r) => { if (!cancelled) setDays(r); })
      .catch(() => { if (!cancelled) setDays([]); });
    return () => { cancelled = true; };
  }, [start, end]);

  const totals = useMemo(() => {
    if (!days) return null;
    let scheduled = 0;
    let completed = 0;
    let activeDays = 0;
    let perfectDays = 0;
    let zeroDays = 0;
    let bestDay = null;
    let worstDay = null;
    for (const d of days) {
      scheduled += d.scheduled;
      completed += d.completed;
      if (d.scheduled > 0) {
        activeDays += 1;
        if (d.completed === d.scheduled) perfectDays += 1;
        if (d.completed === 0) zeroDays += 1;
        const rate = d.completed / d.scheduled;
        if (!bestDay || rate > bestDay.rate || (rate === bestDay.rate && d.completed > bestDay.day.completed)) {
          bestDay = { day: d, rate };
        }
        if (!worstDay || rate < worstDay.rate) {
          worstDay = { day: d, rate };
        }
      }
    }
    const missed = scheduled - completed;
    const rate = scheduled ? Math.round((completed / scheduled) * 100) : 0;
    return {
      scheduled,
      completed,
      missed,
      rate,
      activeDays,
      perfectDays,
      zeroDays,
      bestDay,
      worstDay,
      bestStreak: computeStreak(days),
      currentStreak: computeCurrentStreak(days),
    };
  }, [days]);

  useEffect(() => {
    if (!days || days.length === 0) return;
    if (days.some((d) => d.dateKey === selectedDateKey)) return;
    const today = startOfDay(new Date());
    const fallback = days
      .slice()
      .reverse()
      .find((d) => !isAfter(startOfDay(d.date), today) && d.scheduled > 0)
      || days.find((d) => !isAfter(startOfDay(d.date), today))
      || days[0];
    setSelectedDateKey(fallback.dateKey);
  }, [days, selectedDateKey]);

  const selectedDay = useMemo(
    () => days?.find((d) => d.dateKey === selectedDateKey) || null,
    [days, selectedDateKey]
  );

  const loading = days === null;

  return (
    <AppShell initial="B">
      <Stack spacing={3}>
        <Box>
          <Crumbs items={[{ label: 'Today', href: '/' }, { label: 'Summary' }]} />
          <Typography variant="h4" sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconChartBar size={26} /> Summary
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Your discipline over time. Pick a range and see exactly what you
            shipped, what you skipped, and where the streaks live.
          </Typography>
        </Box>

        <RangePicker
          kind={kind} setKind={setKind}
          anchor={anchor} setAnchor={setAnchor}
          start={start} end={end}
        />

        {loading ? (
          <SkeletonList count={4} />
        ) : (
          <>
            <KpiGrid totals={totals} />

            <CalendarHeatmap
              days={days}
              monthAnchor={kind === 'month' ? anchor : new Date()}
              kind={kind}
              setAnchor={setAnchor}
              selectedDateKey={selectedDateKey}
              onSelectDate={setSelectedDateKey}
            />

            <SelectedDaySummary day={selectedDay} />

            <DayBreakdown days={days} />
          </>
        )}
      </Stack>
    </AppShell>
  );
}

/* ------------------------------------------------------------------ */
/* Range picker                                                        */
/* ------------------------------------------------------------------ */

function RangePicker({ kind, setKind, anchor, setAnchor, start, end }) {
  const isCustom = kind === 'custom';
  return (
    <Card sx={{ p: { xs: 1.5, sm: 2 } }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1.5}
        sx={{ alignItems: { xs: 'stretch', sm: 'center' } }}
      >
        <ToggleButtonGroup
          exclusive
          size="small"
          value={kind}
          onChange={(_, v) => {
            if (!v) return;
            setKind(v);
            setAnchor(new Date());
          }}
          sx={{
            flexWrap: 'wrap',
            '& .MuiToggleButton-root': {
              border: 'none',
              borderRadius: 999,
              px: 1.75,
              py: 0.5,
              textTransform: 'none',
              fontWeight: 600,
              color: 'text.secondary',
            },
            '& .Mui-selected': (t) => ({
              bgcolor: t.palette.mode === 'dark'
                ? 'rgba(45, 212, 191, 0.18)'
                : 'rgba(15, 118, 110, 0.10)',
              color: t.palette.primary.main,
              '&:hover': {
                bgcolor: t.palette.mode === 'dark'
                  ? 'rgba(45, 212, 191, 0.24)'
                  : 'rgba(15, 118, 110, 0.16)',
              },
            }),
          }}
        >
          {RANGE_OPTIONS.map((o) => (
            <ToggleButton key={o.value} value={o.value} aria-label={o.label}>
              {o.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>

        <Box sx={{ flex: 1 }} />

        <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
          <Tooltip title="Previous">
            <IconButton
              size="small"
              onClick={() => setAnchor((a) => shiftAnchor(kind, a, -1))}
              disabled={isCustom}
              aria-label="Previous range"
            >
              <IconChevronLeft size={18} />
            </IconButton>
          </Tooltip>
          <Box sx={{ minWidth: 160, textAlign: 'center' }}>
            <Typography variant="subtitle2" noWrap>
              {formatRangeLabel(kind, start, end)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {differenceInCalendarDays(end, start) + 1} days
            </Typography>
          </Box>
          <Tooltip title="Next">
            <span>
              <IconButton
                size="small"
                onClick={() => setAnchor((a) => shiftAnchor(kind, a, 1))}
                disabled={isCustom || !isBefore(end, startOfDay(new Date()))}
                aria-label="Next range"
              >
                <IconChevronRight size={18} />
              </IconButton>
            </span>
          </Tooltip>
          <Button
            size="small"
            variant="text"
            onClick={() => setAnchor(new Date())}
            sx={{ ml: 0.5 }}
          >
            Now
          </Button>
        </Stack>
      </Stack>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* KPI cards                                                           */
/* ------------------------------------------------------------------ */

function KpiGrid({ totals }) {
  if (!totals) return null;
  const items = [
    {
      icon: <IconTarget size={18} />,
      label: 'Completion',
      value: `${totals.rate}%`,
      hint: `${totals.completed}/${totals.scheduled} done`,
      progress: totals.rate,
      tone: totals.rate >= 80 ? 'success' : totals.rate >= 50 ? 'primary' : 'warning',
    },
    {
      icon: <IconCircleCheck size={18} />,
      label: 'Completed',
      value: totals.completed,
      hint: `${totals.perfectDays} perfect day${totals.perfectDays === 1 ? '' : 's'}`,
      tone: 'success',
    },
    {
      icon: <IconCircleX size={18} />,
      label: 'Skipped',
      value: totals.missed,
      hint: `${totals.zeroDays} zero day${totals.zeroDays === 1 ? '' : 's'}`,
      tone: 'warning',
    },
    {
      icon: <IconFlame size={18} />,
      label: 'Best streak',
      value: `${totals.bestStreak}d`,
      hint: `Now: ${totals.currentStreak}d`,
      tone: 'primary',
    },
    {
      icon: <IconCalendarStats size={18} />,
      label: 'Active days',
      value: totals.activeDays,
      hint: 'with at least 1 task',
      tone: 'default',
    },
    {
      icon: <IconTrophy size={18} />,
      label: 'Best day',
      value: totals.bestDay ? format(totals.bestDay.day.date, 'd MMM') : '—',
      hint: totals.bestDay
        ? `${totals.bestDay.day.completed}/${totals.bestDay.day.scheduled} done`
        : 'No data yet',
      tone: 'success',
    },
  ];

  return (
    <Box
      sx={{
        display: 'grid',
        gap: 1.25,
        gridTemplateColumns: {
          xs: 'repeat(2, minmax(0, 1fr))',
          sm: 'repeat(3, minmax(0, 1fr))',
        },
      }}
    >
      {items.map((it) => (
        <KpiCard key={it.label} {...it} />
      ))}
    </Box>
  );
}

function KpiCard({ icon, label, value, hint, progress, tone = 'default' }) {
  const toneSx = (t) => {
    const map = {
      success: { color: t.palette.success.main, bg: t.palette.mode === 'dark' ? 'rgba(52, 211, 153, 0.10)' : 'rgba(22, 163, 74, 0.08)' },
      warning: { color: t.palette.warning.main, bg: t.palette.mode === 'dark' ? 'rgba(251, 191, 36, 0.10)' : 'rgba(217, 119, 6, 0.08)' },
      primary: { color: t.palette.primary.main, bg: t.palette.mode === 'dark' ? 'rgba(45, 212, 191, 0.12)' : 'rgba(15, 118, 110, 0.08)' },
      default: { color: t.palette.text.secondary, bg: t.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.04)' },
    };
    return map[tone] || map.default;
  };

  return (
    <Card sx={{ p: 1.5 }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.5 }}>
        <Box
          sx={(t) => ({
            width: 28,
            height: 28,
            borderRadius: 999,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: toneSx(t).bg,
            color: toneSx(t).color,
          })}
        >
          {icon}
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>
          {label}
        </Typography>
      </Stack>
      <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1.1 }}>
        {value}
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
        {hint}
      </Typography>
      {typeof progress === 'number' ? (
        <LinearProgress
          variant="determinate"
          value={Math.max(0, Math.min(100, progress))}
          sx={(t) => ({
            mt: 1,
            height: 4,
            borderRadius: 2,
            bgcolor: t.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)',
            '& .MuiLinearProgress-bar': {
              backgroundColor:
                progress >= 80 ? t.palette.success.main
                : progress >= 50 ? t.palette.primary.main
                : t.palette.warning.main,
            },
          })}
        />
      ) : null}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Calendar heatmap                                                    */
/* ------------------------------------------------------------------ */

function CalendarHeatmap({ days, monthAnchor, kind, setAnchor, selectedDateKey, onSelectDate }) {
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(monthAnchor));

  useEffect(() => {
    setViewMonth(startOfMonth(monthAnchor));
  }, [monthAnchor]);

  const monthStart = viewMonth;
  const monthEnd = endOfMonth(viewMonth);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const byKey = useMemo(() => {
    const m = new Map();
    for (const d of days) m.set(d.dateKey, d);
    return m;
  }, [days]);

  const cells = [];
  for (let d = new Date(gridStart); d <= gridEnd; d = addDays(d, 1)) {
    cells.push(new Date(d));
  }
  const today = todayKey(new Date());

  function moveMonth(dir) {
    const next = addMonths(viewMonth, dir);
    if (kind === 'month') setAnchor(next);
    setViewMonth(next);
  }

  return (
    <Card sx={{ p: { xs: 1.5, sm: 2 } }}>
      <Stack direction="row" sx={{ alignItems: 'center', mb: 1.5 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flex: 1, minWidth: 0 }}>
          <IconCalendar size={18} />
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            {format(viewMonth, 'MMMM yyyy')}
          </Typography>
        </Stack>
        <IconButton size="small" onClick={() => moveMonth(-1)} aria-label="Previous month">
          <IconChevronLeft size={18} />
        </IconButton>
        <IconButton
          size="small"
          onClick={() => moveMonth(1)}
          aria-label="Next month"
          disabled={isSameMonth(viewMonth, new Date())}
        >
          <IconChevronRight size={18} />
        </IconButton>
      </Stack>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
          gap: 0.5,
        }}
      >
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <Typography
            key={d}
            variant="caption"
            color="text.secondary"
            sx={{ textAlign: 'center', fontWeight: 600, mb: 0.5 }}
          >
            {d}
          </Typography>
        ))}

        {cells.map((d, idx) => {
          const key = todayKey(d);
          const stat = byKey.get(key);
          const inMonth = isSameMonth(d, viewMonth);
          const isToday = key === today;
          const selected = key === selectedDateKey;
          const future = isAfter(startOfDay(d), startOfDay(new Date()));
          return (
            <HeatCell
              key={idx}
              day={d}
              stat={stat}
              inMonth={inMonth}
              isToday={isToday}
              selected={selected}
              future={future}
              onClick={() => {
                if (future) return;
                onSelectDate?.(key);
                if (kind === 'month' && !isSameMonth(d, monthAnchor)) setAnchor(d);
              }}
            />
          );
        })}
      </Box>

      <Stack direction="row" spacing={1.5} sx={{ mt: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
        <Typography variant="caption" color="text.secondary">Legend</Typography>
        <LegendSwatch level={0} label="None" />
        <LegendSwatch level={1} label="Some" />
        <LegendSwatch level={2} label="Most" />
        <LegendSwatch level={3} label="All" />
      </Stack>
    </Card>
  );
}

function levelFor(stat) {
  if (!stat || stat.scheduled === 0) return -1;
  const r = stat.completed / stat.scheduled;
  if (r === 0) return 0;
  if (r < 0.5) return 1;
  if (r < 1) return 2;
  return 3;
}

function HeatCell({ day, stat, inMonth, isToday, selected, future, onClick }) {
  const level = levelFor(stat);
  const tooltip = !stat
    ? `${format(day, 'EEE, d MMM')} — no data`
    : stat.scheduled === 0
      ? `${format(day, 'EEE, d MMM')} — no tasks`
      : `${format(day, 'EEE, d MMM')} — ${stat.completed}/${stat.scheduled} done`;
  return (
    <Tooltip title={tooltip} arrow disableInteractive>
      <Box
        component={!future ? 'button' : 'div'}
        onClick={onClick}
        sx={(t) => ({
          aspectRatio: '1 / 1',
          minHeight: 32,
          border: `1px solid ${t.palette.divider}`,
          borderRadius: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 0.25,
          cursor: !future ? 'pointer' : 'default',
          opacity: inMonth ? 1 : 0.4,
          background: 'transparent',
          color: 'inherit',
          font: 'inherit',
          padding: 0,
          position: 'relative',
          ...heatStyle(t, level, isToday, selected, future),
        })}
        aria-label={tooltip}
      >
        <Typography variant="caption" sx={{ fontWeight: isToday ? 700 : 500, lineHeight: 1 }}>
          {format(day, 'd')}
        </Typography>
        {stat && stat.scheduled > 0 ? (
          <Typography variant="caption" sx={{ fontSize: 10, opacity: 0.85, lineHeight: 1 }}>
            {stat.completed}/{stat.scheduled}
          </Typography>
        ) : null}
      </Box>
    </Tooltip>
  );
}

function heatStyle(t, level, isToday, selected, future) {
  const dark = t.palette.mode === 'dark';
  const palettes = {
    [-1]: dark ? 'rgba(255,255,255,0.02)' : 'rgba(15,23,42,0.02)',
    [0]: dark ? 'rgba(251, 191, 36, 0.18)' : 'rgba(217, 119, 6, 0.10)',
    [1]: dark ? 'rgba(45, 212, 191, 0.18)' : 'rgba(15, 118, 110, 0.12)',
    [2]: dark ? 'rgba(45, 212, 191, 0.34)' : 'rgba(15, 118, 110, 0.28)',
    [3]: dark ? 'rgba(45, 212, 191, 0.55)' : 'rgba(15, 118, 110, 0.55)',
  };
  return {
    bgcolor: palettes[level],
    color: level === 3 ? (dark ? '#0f172a' : '#ffffff') : 'inherit',
    outline: selected
      ? `2px solid ${t.palette.secondary.main}`
      : isToday
        ? `2px solid ${t.palette.primary.main}`
        : 'none',
    outlineOffset: selected || isToday ? -2 : 0,
    filter: future ? 'grayscale(0.5)' : 'none',
  };
}

function LegendSwatch({ level, label }) {
  return (
    <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
      <Box
        sx={(t) => ({
          width: 12,
          height: 12,
          borderRadius: 0.5,
          ...heatStyle(t, level, false, false),
        })}
      />
      <Typography variant="caption" color="text.secondary">{label}</Typography>
    </Stack>
  );
}

function SelectedDaySummary({ day }) {
  if (!day) return null;
  const skipped = day.tasks.filter((t) => !t.completed);
  const completed = day.tasks.filter((t) => t.completed);
  const rate = day.scheduled ? Math.round((day.completed / day.scheduled) * 100) : 0;

  return (
    <Card sx={{ p: { xs: 1.5, sm: 2 } }}>
      <Stack spacing={1.25}>
        <Stack direction="row" sx={{ alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            {format(day.date, 'EEEE, d MMM yyyy')}
          </Typography>
          <Box sx={{ flex: 1 }} />
          <Chip size="small" label={`${day.completed}/${day.scheduled} done`} color={day.completed === day.scheduled && day.scheduled > 0 ? 'success' : 'default'} />
          <Chip size="small" label={`${rate}%`} variant="outlined" />
        </Stack>

        {day.scheduled === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No tasks were scheduled for this date.
          </Typography>
        ) : (
          <Stack spacing={1.25}>
            <LinearProgress
              variant="determinate"
              value={rate}
              sx={(t) => ({
                height: 4,
                borderRadius: 2,
                bgcolor: t.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)',
              })}
            />
            {skipped.length > 0 ? (
              <Box>
                <Typography variant="caption" color="warning.main" sx={{ fontWeight: 700 }}>
                  Skipped · {skipped.length}
                </Typography>
                <Stack sx={{ mt: 0.5 }} spacing={0.35}>
                  {skipped.map((task) => <TaskLine key={task.id} task={task} skipped />)}
                </Stack>
              </Box>
            ) : null}
            {completed.length > 0 ? (
              <Box>
                <Typography variant="caption" color="success.main" sx={{ fontWeight: 700 }}>
                  Completed · {completed.length}
                </Typography>
                <Stack sx={{ mt: 0.5 }} spacing={0.35}>
                  {completed.map((task) => <TaskLine key={task.id} task={task} />)}
                </Stack>
              </Box>
            ) : null}
          </Stack>
        )}
      </Stack>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Day breakdown list                                                  */
/* ------------------------------------------------------------------ */

function DayBreakdown({ days }) {
  const filtered = useMemo(
    () => days.filter((d) => d.scheduled > 0).slice().reverse(),
    [days]
  );

  if (filtered.length === 0) {
    return (
      <Card sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="subtitle1">No tasks in this range</Typography>
        <Typography variant="caption" color="text.secondary">
          Add tasks on the Today screen and check back here.
        </Typography>
      </Card>
    );
  }

  return (
    <Card sx={{ p: 0, overflow: 'hidden' }}>
      <Box sx={{ p: 2, pb: 1.5 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          Day-by-day
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Newest first. Skipped tasks are highlighted.
        </Typography>
      </Box>
      <Divider />
      <Stack divider={<Divider />}>
        {filtered.map((d) => (
          <DayRow key={d.dateKey} day={d} />
        ))}
      </Stack>
    </Card>
  );
}

function DayRow({ day }) {
  const rate = day.scheduled ? Math.round((day.completed / day.scheduled) * 100) : 0;
  const allDone = day.scheduled > 0 && day.completed === day.scheduled;
  const skipped = day.tasks.filter((t) => !t.completed);
  const completed = day.tasks.filter((t) => t.completed);
  const isToday = day.dateKey === todayKey(new Date());

  return (
    <Box sx={{ p: 2 }}>
      <Stack direction="row" sx={{ alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
          {format(day.date, 'EEE, d MMM yyyy')}
          {isToday ? ' · Today' : ''}
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Chip
          size="small"
          label={`${day.completed}/${day.scheduled}`}
          color={allDone ? 'success' : day.completed === 0 ? 'warning' : 'default'}
          variant={allDone ? 'filled' : 'outlined'}
        />
        <Chip size="small" label={`${rate}%`} variant="outlined" />
      </Stack>

      <LinearProgress
        variant="determinate"
        value={rate}
        sx={(t) => ({
          height: 4,
          borderRadius: 2,
          mb: 1.25,
          bgcolor: t.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)',
          '& .MuiLinearProgress-bar': {
            backgroundColor:
              rate >= 80 ? t.palette.success.main
              : rate >= 50 ? t.palette.primary.main
              : t.palette.warning.main,
          },
        })}
      />

      {skipped.length > 0 ? (
        <Box sx={{ mb: completed.length ? 1 : 0 }}>
          <Typography variant="caption" color="warning.main" sx={{ fontWeight: 600 }}>
            Skipped · {skipped.length}
          </Typography>
          <Stack sx={{ mt: 0.5 }} spacing={0.25}>
            {skipped.map((t) => (
              <TaskLine key={t.id} task={t} skipped />
            ))}
          </Stack>
        </Box>
      ) : null}

      {completed.length > 0 ? (
        <Box>
          <Typography variant="caption" color="success.main" sx={{ fontWeight: 600 }}>
            Completed · {completed.length}
          </Typography>
          <Stack sx={{ mt: 0.5 }} spacing={0.25}>
            {completed.map((t) => (
              <TaskLine key={t.id} task={t} />
            ))}
          </Stack>
        </Box>
      ) : null}
    </Box>
  );
}

function TaskLine({ task, skipped }) {
  return (
    <Stack
      direction="row"
      spacing={1}
      sx={{ alignItems: 'center', minWidth: 0 }}
    >
      <Box
        sx={(t) => ({
          width: 6,
          height: 6,
          borderRadius: '50%',
          flexShrink: 0,
          bgcolor: skipped ? t.palette.warning.main : t.palette.success.main,
        })}
      />
      <Typography
        variant="body2"
        sx={{
          flex: 1,
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          textDecoration: skipped ? 'none' : 'none',
          color: skipped ? 'text.primary' : 'text.secondary',
        }}
      >
        {task.title}
      </Typography>
      <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', color: 'text.disabled' }}>
        <IconClock size={12} />
        <Typography variant="caption" color="text.secondary">{task.time}</Typography>
      </Stack>
    </Stack>
  );
}

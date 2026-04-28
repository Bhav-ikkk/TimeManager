'use client';

/**
 * src/app/calories/reports/page.js — Weekly / monthly Gemini reports.
 *
 * Picks a window (this week / last week / this month / last month / custom),
 * shows whatever cached report exists for it, and lets the user (re)run the
 * Gemini analysis for the period. Reads existing daily reports from IndexedDB
 * so the prompt is grounded in real per-day output, not just raw entries.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Stack,
  Box,
  Card,
  Typography,
  Button,
  Chip,
  ToggleButtonGroup,
  ToggleButton,
  IconButton,
  Alert,
  Divider,
  LinearProgress,
} from '@mui/material';
import {
  IconArrowLeft,
  IconChartPie,
  IconSparkles,
  IconChevronLeft,
  IconChevronRight,
  IconRefresh,
  IconAlertTriangle,
  IconCalendar,
} from '@tabler/icons-react';
import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  addMonths,
  addWeeks,
  isAfter,
} from 'date-fns';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import Crumbs from '@/components/Crumbs';
import {
  todayKey,
  getFoodReport,
  listFoodEntriesBetween,
} from '@/lib/db';
import {
  analyseRange,
  getGeminiKey,
  weekReportId,
  monthReportId,
} from '@/lib/calories';

export default function CalorieReportsPage() {
  const [kind, setKind] = useState('week');
  const [anchor, setAnchor] = useState(() => new Date());
  const [report, setReport] = useState(null);
  const [entryCount, setEntryCount] = useState(0);
  const [analysing, setAnalysing] = useState(false);
  const [hasKey, setHasKey] = useState(false);
  const [error, setError] = useState('');

  const { startKey, endKey, label } = useMemo(() => deriveRange(kind, anchor), [kind, anchor]);

  useEffect(() => {
    getGeminiKey().then((k) => setHasKey(Boolean(k)));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setError('');
    setReport(null);
    const id = kind === 'week' ? weekReportId(startKey, endKey) : monthReportId(startKey);
    Promise.all([
      getFoodReport(id),
      listFoodEntriesBetween(startKey, endKey),
    ]).then(([rep, entries]) => {
      if (cancelled) return;
      setReport(rep || null);
      setEntryCount(entries.length);
    });
    return () => { cancelled = true; };
  }, [kind, startKey, endKey]);

  async function run() {
    setError('');
    if (!hasKey) {
      setError('Add your Gemini API key in Calorie settings first.');
      return;
    }
    if (entryCount === 0) {
      setError('No food entries in this range yet.');
      return;
    }
    setAnalysing(true);
    try {
      const r = await analyseRange(kind, startKey, endKey);
      setReport(r);
    } catch (e) {
      setError(e?.message || 'Analysis failed.');
    } finally {
      setAnalysing(false);
    }
  }

  const future = isAfter(new Date(startKey), new Date(todayKey()));
  const data = report?.json || null;

  return (
    <AppShell initial="B">
      <Stack spacing={3}>
        <Box>
          <Crumbs
            items={[
              { label: 'Today', href: '/' },
              { label: 'Calories', href: '/calories' },
              { label: 'Reports' },
            ]}
          />
          <Stack direction="row" sx={{ alignItems: 'center', mt: 1 }}>
            <IconButton component={Link} href="/calories" aria-label="Back" sx={{ mr: 0.5 }}>
              <IconArrowLeft size={20} />
            </IconButton>
            <Typography variant="h4">Reports</Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Weekly and monthly summaries grounded in your saved daily reports.
          </Typography>
        </Box>

        <Card sx={{ p: 1.5 }}>
          <Stack spacing={1}>
            <ToggleButtonGroup
              size="small"
              value={kind}
              exclusive
              onChange={(_, v) => v && (setKind(v), setAnchor(new Date()))}
              sx={{ alignSelf: 'center' }}
            >
              <ToggleButton value="week">Week</ToggleButton>
              <ToggleButton value="month">Month</ToggleButton>
            </ToggleButtonGroup>
            <Stack direction="row" sx={{ alignItems: 'center' }}>
              <IconButton size="small" onClick={() => setAnchor((a) => kind === 'week' ? addWeeks(a, -1) : addMonths(a, -1))} aria-label="Previous">
                <IconChevronLeft size={18} />
              </IconButton>
              <Box sx={{ flex: 1, textAlign: 'center' }}>
                <Typography variant="subtitle2">{label}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {entryCount} food entries logged
                </Typography>
              </Box>
              <IconButton
                size="small"
                onClick={() => setAnchor((a) => kind === 'week' ? addWeeks(a, 1) : addMonths(a, 1))}
                aria-label="Next"
                disabled={future}
              >
                <IconChevronRight size={18} />
              </IconButton>
            </Stack>
          </Stack>
        </Card>

        {!hasKey ? (
          <Alert
            severity="info"
            action={
              <Button component={Link} href="/calories/settings" size="small" color="inherit">
                Add key
              </Button>
            }
          >
            Add your Gemini API key in Calorie settings to generate reports.
          </Alert>
        ) : null}

        <Card sx={{ p: 2 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} sx={{ alignItems: { sm: 'center' } }}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle2">
                {report ? 'Cached report available' : 'No report yet for this period'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {report
                  ? `Generated ${format(new Date(report.savedAt), 'd MMM, HH:mm')}. Re-run to refresh.`
                  : 'Click below to generate one. Costs ~1 Gemini call.'}
              </Typography>
            </Box>
            <Button
              variant="contained"
              startIcon={analysing ? <IconRefresh size={16} /> : <IconSparkles size={16} />}
              onClick={run}
              disabled={analysing || !hasKey || entryCount === 0 || future}
            >
              {analysing ? 'Analysing…' : report ? 'Re-analyse' : 'Run analysis'}
            </Button>
          </Stack>
          {error ? (
            <Alert severity="warning" sx={{ mt: 1.5 }} icon={<IconAlertTriangle size={18} />}>
              {error}
            </Alert>
          ) : null}
        </Card>

        {data ? <RangeReport data={data} /> : null}
      </Stack>
    </AppShell>
  );
}

function deriveRange(kind, anchor) {
  if (kind === 'week') {
    const start = startOfWeek(anchor, { weekStartsOn: 1 });
    const end = endOfWeek(anchor, { weekStartsOn: 1 });
    return {
      startKey: todayKey(start),
      endKey: todayKey(end),
      label: `${format(start, 'd MMM')} – ${format(end, 'd MMM yyyy')}`,
    };
  }
  const start = startOfMonth(anchor);
  const end = endOfMonth(anchor);
  return {
    startKey: todayKey(start),
    endKey: todayKey(end),
    label: format(start, 'MMMM yyyy'),
  };
}

function RangeReport({ data }) {
  const progress = data.goalProgress || 'on-track';
  const color = progress === 'on-track'
    ? 'success'
    : progress === 'slow'
      ? 'info'
      : progress === 'off-track'
        ? 'warning'
        : 'error';
  return (
    <Card sx={{ p: 2.5 }}>
      <Stack spacing={2}>
        <Stack direction="row" sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 0.75 }}>
          <Typography variant="h5" sx={{ flex: 1 }}>
            {data.kind === 'week' ? 'Weekly report' : 'Monthly report'}
          </Typography>
          <Chip size="small" color={color} label={progress.replace('-', ' ')} />
        </Stack>

        <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap', gap: 0.75 }}>
          <Chip size="small" variant="outlined" label={`${data.daysLogged}/${data.daysCovered} days logged`} />
          <Chip size="small" variant="outlined" label={`avg ${Math.round(data.avgCaloriesPerLoggedDay || 0)} kcal/day`} />
          <Chip
            size="small"
            color={data.estimatedWeightChangeKg < 0 ? 'primary' : 'warning'}
            label={`${data.estimatedWeightChangeKg > 0 ? '+' : ''}${(data.estimatedWeightChangeKg ?? 0).toFixed(2)} kg est.`}
          />
        </Stack>

        <Box>
          <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Verdict</Typography>
          <Typography variant="body2">{data.verdict}</Typography>
        </Box>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          {data.bestDay ? (
            <Box sx={{ flex: 1 }}>
              <Typography variant="caption" color="text.secondary">Best day</Typography>
              <Typography variant="body2"><strong>{data.bestDay.date}</strong> — {data.bestDay.reason}</Typography>
            </Box>
          ) : null}
          {data.worstDay ? (
            <Box sx={{ flex: 1 }}>
              <Typography variant="caption" color="text.secondary">Worst day</Typography>
              <Typography variant="body2"><strong>{data.worstDay.date}</strong> — {data.worstDay.reason}</Typography>
            </Box>
          ) : null}
        </Stack>

        {Array.isArray(data.patterns) && data.patterns.length ? (
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Patterns spotted</Typography>
            <Stack component="ul" sx={{ pl: 2.5, m: 0 }} spacing={0.5}>
              {data.patterns.map((p, i) => (
                <Typography component="li" variant="body2" key={i}>{p}</Typography>
              ))}
            </Stack>
          </Box>
        ) : null}

        {Array.isArray(data.nextWeekPlan) && data.nextWeekPlan.length ? (
          <Box>
            <Divider sx={{ mb: 1 }} />
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Plan for the next period</Typography>
            <Stack component="ul" sx={{ pl: 2.5, m: 0 }} spacing={0.5}>
              {data.nextWeekPlan.map((p, i) => (
                <Typography component="li" variant="body2" key={i}>{p}</Typography>
              ))}
            </Stack>
          </Box>
        ) : null}
      </Stack>
    </Card>
  );
}

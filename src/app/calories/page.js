'use client';

/**
 * src/app/calories/page.js — Calorie tracker (Today).
 *
 * Premium PWA page where the user logs every food item they ate during the
 * day, then taps "Run analysis" to call their own Gemini key (stored
 * locally) and get a strict, evidence-based daily report. Reports are
 * cached per-day so we don't burn quota.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Stack,
  Box,
  Card,
  Typography,
  Button,
  IconButton,
  TextField,
  Divider,
  Chip,
  LinearProgress,
  Alert,
  Tooltip,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import {
  IconApple,
  IconPlus,
  IconTrash,
  IconSparkles,
  IconSettings,
  IconChartPie,
  IconCalendar,
  IconRefresh,
  IconAlertTriangle,
  IconChevronLeft,
  IconChevronRight,
} from '@tabler/icons-react';
import Link from 'next/link';
import { format, addDays, subDays } from 'date-fns';
import AppShell from '@/components/AppShell';
import Crumbs from '@/components/Crumbs';
import EmptyState from '@/components/EmptyState';
import {
  todayKey,
  addFoodEntry,
  listFoodEntriesForDate,
  deleteFoodEntry,
  getFoodReport,
} from '@/lib/db';
import {
  analyseDay,
  getCalorieProfile,
  getGeminiKey,
  estimateTDEE,
  suggestDailyTarget,
  dayReportId,
} from '@/lib/calories';

function fmtKcal(n) {
  if (typeof n !== 'number' || Number.isNaN(n)) return '—';
  return `${Math.round(n)} kcal`;
}

export default function CaloriesPage() {
  const [date, setDate] = useState(() => new Date());
  const dateKey = useMemo(() => todayKey(date), [date]);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [profile, setProfile] = useState(null);
  const [hasKey, setHasKey] = useState(false);
  const [report, setReport] = useState(null);
  const [analysing, setAnalysing] = useState(false);
  const [error, setError] = useState('');

  async function refresh(forDateKey = dateKey) {
    setLoading(true);
    try {
      const [list, prof, key, rep] = await Promise.all([
        listFoodEntriesForDate(forDateKey),
        getCalorieProfile(),
        getGeminiKey(),
        getFoodReport(dayReportId(forDateKey)),
      ]);
      setEntries(list);
      setProfile(prof);
      setHasKey(Boolean(key));
      setReport(rep || null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh(dateKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateKey]);

  async function handleAdd(e) {
    e?.preventDefault?.();
    const value = text.trim();
    if (!value) return;
    setText('');
    await addFoodEntry({ date: dateKey, at: Date.now(), text: value });
    refresh();
  }

  async function handleDelete(id) {
    await deleteFoodEntry(id);
    refresh();
  }

  async function handleAnalyse() {
    setError('');
    if (!hasKey) {
      setError('Add your Gemini API key in Calorie settings first.');
      return;
    }
    if (entries.length === 0) {
      setError('Log at least one food item before analysing.');
      return;
    }
    setAnalysing(true);
    try {
      const r = await analyseDay(dateKey);
      setReport(r);
    } catch (e) {
      setError(e?.message || 'Analysis failed.');
    } finally {
      setAnalysing(false);
    }
  }

  const isToday = dateKey === todayKey();
  const target = profile ? (profile.dailyCalorieTarget || suggestDailyTarget(profile)) : 0;
  const tdee = profile ? estimateTDEE(profile) : 0;
  const data = report?.json || null;

  return (
    <AppShell initial="B">
      <Stack spacing={3}>
        <Box>
          <Crumbs items={[{ label: 'Today', href: '/' }, { label: 'Calories' }]} />
          <Stack direction="row" sx={{ alignItems: 'center', mt: 1 }} spacing={1}>
            <Typography variant="h4" sx={{ flex: 1 }}>Calories</Typography>
            <Tooltip title="Weekly / monthly reports">
              <IconButton component={Link} href="/calories/reports" aria-label="Reports">
                <IconChartPie size={20} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Calorie settings">
              <IconButton component={Link} href="/calories/settings" aria-label="Settings">
                <IconSettings size={20} />
              </IconButton>
            </Tooltip>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Bring-your-own-key. Your Gemini API key never leaves this device.
          </Typography>
        </Box>

        {/* Date strip */}
        <Card sx={{ p: 1.25 }}>
          <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
            <IconButton size="small" onClick={() => setDate((d) => subDays(d, 1))} aria-label="Previous day">
              <IconChevronLeft size={18} />
            </IconButton>
            <Box sx={{ flex: 1, textAlign: 'center' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                {format(date, 'EEEE, d MMM yyyy')}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {isToday ? 'Today' : ''}
              </Typography>
            </Box>
            <IconButton
              size="small"
              onClick={() => setDate((d) => addDays(d, 1))}
              disabled={isToday}
              aria-label="Next day"
            >
              <IconChevronRight size={18} />
            </IconButton>
            {!isToday ? (
              <Button size="small" onClick={() => setDate(new Date())}>Today</Button>
            ) : null}
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
            Add your Gemini API key in <strong>Calorie settings</strong> to unlock analysis.
            Logs work without it; only the report needs the key.
          </Alert>
        ) : null}

        {/* Profile snapshot */}
        {profile ? (
          <Card sx={{ p: 2 }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 0.75 }}>
              <Chip size="small" label={`Target ${target} kcal`} color="primary" />
              <Chip size="small" label={`TDEE ~${tdee} kcal`} variant="outlined" />
              <Chip size="small" label={`Goal: ${profile.goal}`} variant="outlined" />
              <Chip size="small" label={`${profile.weightKg}kg → ${profile.goalWeightKg}kg`} variant="outlined" />
            </Stack>
          </Card>
        ) : null}

        {/* Add entry */}
        <Card sx={{ p: 2 }} component="form" onSubmit={handleAdd}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>What did you eat?</Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <TextField
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="e.g. 2 chapatis, 1 bowl rajma, small bowl rice"
              slotProps={{ htmlInput: { maxLength: 240 } }}
              fullWidth
            />
            <Button type="submit" variant="contained" startIcon={<IconPlus size={16} />}>
              Add
            </Button>
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            Be specific with portions — vague entries lead to vague calorie estimates.
          </Typography>
        </Card>

        {/* Entries */}
        {loading ? null : entries.length === 0 ? (
          <EmptyState
            icon={<IconApple size={32} />}
            title="Nothing logged yet"
            body="Add every meal and snack as you eat it. The dietitian gets honest only with honest data."
          />
        ) : (
          <Stack spacing={1}>
            <Typography variant="overline" color="text.secondary">Today's log</Typography>
            {entries.map((e) => (
              <Card key={e.id} sx={{ p: 1.5 }}>
                <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
                  <Typography variant="caption" sx={{ fontVariantNumeric: 'tabular-nums', color: 'primary.main', minWidth: 44 }}>
                    {format(new Date(e.at), 'HH:mm')}
                  </Typography>
                  <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }}>
                    {e.text}
                  </Typography>
                  <IconButton size="small" onClick={() => handleDelete(e.id)} aria-label="Delete entry">
                    <IconTrash size={16} />
                  </IconButton>
                </Stack>
              </Card>
            ))}
          </Stack>
        )}

        {/* Analyse */}
        <Card sx={{ p: 2 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} sx={{ alignItems: { sm: 'center' } }}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle2">Run analysis</Typography>
              <Typography variant="caption" color="text.secondary">
                Sends your log + profile to Gemini. Cached per day — re-run to refresh.
              </Typography>
            </Box>
            <Button
              variant="contained"
              startIcon={analysing ? <IconRefresh size={16} /> : <IconSparkles size={16} />}
              onClick={handleAnalyse}
              disabled={analysing || !hasKey || entries.length === 0}
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

        {/* Report */}
        {data ? <DayReport data={data} target={target} /> : null}
      </Stack>
    </AppShell>
  );
}

function DayReport({ data, target }) {
  const total = data.totalCalories || 0;
  const pct = target ? Math.min(100, Math.round((total / target) * 100)) : 0;
  const surplus = (data.surplusOrDeficit ?? (total - target)) || 0;
  const align = data.goalAlignment || 'aligned';
  const alignColor = align === 'aligned' ? 'success' : align === 'off-track' ? 'warning' : 'error';

  return (
    <Card sx={{ p: 2.5 }}>
      <Stack spacing={2}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 0.75 }}>
          <Typography variant="h5" sx={{ flex: 1 }}>Today's report</Typography>
          <Chip size="small" color={alignColor} label={align.replace('-', ' ')} />
        </Stack>

        <Box>
          <Stack direction="row" sx={{ alignItems: 'baseline', gap: 1 }}>
            <Typography variant="h3" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
              {Math.round(total)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              / {target} kcal
            </Typography>
            <Box sx={{ flex: 1 }} />
            <Chip
              size="small"
              color={surplus > 0 ? 'warning' : 'primary'}
              label={`${surplus > 0 ? '+' : ''}${Math.round(surplus)} vs target`}
            />
          </Stack>
          <LinearProgress
            value={pct}
            variant="determinate"
            sx={{ mt: 1, height: 8, borderRadius: 4 }}
          />
        </Box>

        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 0.75 }}>
          <Chip size="small" label={`Protein ${Math.round(data.protein_g || 0)} g`} variant="outlined" />
          <Chip size="small" label={`Carbs ${Math.round(data.carbs_g || 0)} g`} variant="outlined" />
          <Chip size="small" label={`Fat ${Math.round(data.fat_g || 0)} g`} variant="outlined" />
          <Chip size="small" label={`Fiber ${Math.round(data.fiber_g || 0)} g`} variant="outlined" />
          {typeof data.proteinGap === 'number' && data.proteinGap > 0 ? (
            <Chip size="small" color="warning" label={`${Math.round(data.proteinGap)}g protein short`} />
          ) : null}
        </Stack>

        <Box>
          <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Verdict</Typography>
          <Typography variant="body2">{data.verdict}</Typography>
        </Box>

        {Array.isArray(data.riskFlags) && data.riskFlags.length ? (
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Risk flags</Typography>
            <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap', gap: 0.75 }}>
              {data.riskFlags.map((r, i) => (
                <Chip key={i} size="small" color="error" variant="outlined" label={r} />
              ))}
            </Stack>
          </Box>
        ) : null}

        {Array.isArray(data.improvements) && data.improvements.length ? (
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Concrete next steps</Typography>
            <Stack component="ul" sx={{ pl: 2.5, m: 0 }} spacing={0.5}>
              {data.improvements.map((s, i) => (
                <Typography component="li" variant="body2" key={i}>{s}</Typography>
              ))}
            </Stack>
          </Box>
        ) : null}

        {Array.isArray(data.items) && data.items.length ? (
          <Box>
            <Divider sx={{ mb: 1 }} />
            <Typography variant="subtitle2" sx={{ mb: 0.75 }}>Item breakdown</Typography>
            <Stack spacing={0.5}>
              {data.items.map((it, i) => (
                <Stack key={i} direction="row" spacing={1} sx={{ alignItems: 'baseline' }}>
                  <Typography variant="body2" sx={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {it.name}{it.qty ? ` · ${it.qty}` : ''}
                  </Typography>
                  <Typography variant="caption" sx={{ fontVariantNumeric: 'tabular-nums', color: 'text.secondary' }}>
                    {fmtKcal(it.kcal)} · P{Math.round(it.protein_g || 0)} C{Math.round(it.carbs_g || 0)} F{Math.round(it.fat_g || 0)}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          </Box>
        ) : null}
      </Stack>
    </Card>
  );
}

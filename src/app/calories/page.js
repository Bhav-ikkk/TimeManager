'use client';

/**
 * src/app/calories/page.js — Calorie tracker (Today).
 *
 * Premium PWA page for daily food logging. Three ways to add an item:
 *  1. Search the USDA FoodData Central database (real per-100g nutrition,
 *     scaled to whatever serving the user picks).
 *  2. Free-text entry ("2 chapatis, 1 bowl rajma") — analysed by AI on demand.
 *  3. Quick add from previously logged items (TODO: future).
 *
 * Reports are cached per-day so we don't burn quota on the AI provider.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
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
  Autocomplete,
  CircularProgress,
} from '@mui/material';
import {
  IconApple,
  IconPlus,
  IconTrash,
  IconSparkles,
  IconSettings,
  IconChartPie,
  IconRefresh,
  IconAlertTriangle,
  IconChevronLeft,
  IconChevronRight,
  IconSearch,
  IconPencil,
} from '@tabler/icons-react';
import Link from 'next/link';
import { format, addDays, subDays } from 'date-fns';
import AppShell from '@/components/AppShell';
import Crumbs from '@/components/Crumbs';
import DietActivationPanel from '@/components/DietActivationPanel';
import EmptyState from '@/components/EmptyState';
import { useDietFeatureEnabled } from '@/hooks/useDietFeatureEnabled';
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
  getActiveAIConfig,
  estimateTDEE,
  suggestDailyTarget,
  dayReportId,
} from '@/lib/calories';
import { searchFoods, computeServing } from '@/lib/foodSearch';
import { PROVIDERS } from '@/lib/aiProviders';

function fmtKcal(n) {
  if (typeof n !== 'number' || Number.isNaN(n)) return '—';
  return `${Math.round(n)} kcal`;
}

export default function CaloriesPage() {
  const { enabled, ready } = useDietFeatureEnabled();

  if (!ready) {
    return (
      <AppShell initial="B">
        <Card sx={{ p: 2 }}><LinearProgress /></Card>
      </AppShell>
    );
  }

  if (!enabled) {
    return (
      <AppShell initial="B">
        <DietActivationPanel />
      </AppShell>
    );
  }

  return <CaloriesPageContent />;
}

function CaloriesPageContent() {
  const [date, setDate] = useState(() => new Date());
  const dateKey = useMemo(() => todayKey(date), [date]);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [aiCfg, setAiCfg] = useState(null);
  const [report, setReport] = useState(null);
  const [analysing, setAnalysing] = useState(false);
  const [error, setError] = useState('');
  const [addMode, setAddMode] = useState('search'); // 'search' | 'text'

  async function refresh(forDateKey = dateKey) {
    setLoading(true);
    try {
      const [list, prof, cfg, rep] = await Promise.all([
        listFoodEntriesForDate(forDateKey),
        getCalorieProfile(),
        getActiveAIConfig(),
        getFoodReport(dayReportId(forDateKey)),
      ]);
      setEntries(list);
      setProfile(prof);
      setAiCfg(cfg);
      setReport(rep || null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh(dateKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateKey]);

  async function handleDelete(id) {
    await deleteFoodEntry(id);
    refresh();
  }

  async function handleAnalyse() {
    setError('');
    if (!aiCfg?.key) {
      setError('Add an AI provider key in Calorie settings first.');
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
  const hasKey = Boolean(aiCfg?.key);
  const providerLabel = aiCfg ? PROVIDERS[aiCfg.provider]?.label.split(' (')[0] : '';

  // Quick totals from grounded entries (instant feedback before AI).
  const localTotals = useMemo(() => {
    const t = { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, grounded: 0, free: 0 };
    for (const e of entries) {
      if (e.nutrition) {
        t.kcal += e.nutrition.kcal || 0;
        t.protein_g += e.nutrition.protein_g || 0;
        t.carbs_g += e.nutrition.carbs_g || 0;
        t.fat_g += e.nutrition.fat_g || 0;
        t.grounded += 1;
      } else {
        t.free += 1;
      }
    }
    return t;
  }, [entries]);

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
            Search USDA's database for verified nutrition. Free-text logs work too.
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
            Add an AI key in <strong>Calorie settings</strong> to unlock analysis.
            Logging works without it.
          </Alert>
        ) : null}

        {/* Profile + live totals */}
        {profile ? (
          <Card sx={{ p: 2 }}>
            <Stack spacing={1}>
              <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap', gap: 0.75 }}>
                <Chip size="small" label={`Target ${target} kcal`} color="primary" />
                <Chip size="small" label={`TDEE ~${tdee} kcal`} variant="outlined" />
                <Chip size="small" label={`Goal: ${profile.goal}`} variant="outlined" />
                <Chip size="small" label={`Diet: ${profile.diet}`} variant="outlined" />
                {hasKey ? <Chip size="small" label={`AI: ${providerLabel}`} variant="outlined" /> : null}
              </Stack>
              {entries.length > 0 ? (
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Logged so far ({localTotals.grounded} verified · {localTotals.free} free-text)
                  </Typography>
                  <Stack direction="row" spacing={0.75} sx={{ mt: 0.5, flexWrap: 'wrap', gap: 0.5 }}>
                    <Chip size="small" label={`${Math.round(localTotals.kcal)} kcal`} />
                    <Chip size="small" variant="outlined" label={`P ${Math.round(localTotals.protein_g)}g`} />
                    <Chip size="small" variant="outlined" label={`C ${Math.round(localTotals.carbs_g)}g`} />
                    <Chip size="small" variant="outlined" label={`F ${Math.round(localTotals.fat_g)}g`} />
                    {localTotals.free > 0 ? (
                      <Chip size="small" color="warning" variant="outlined" label="+ free-text estimates" />
                    ) : null}
                  </Stack>
                </Box>
              ) : null}
            </Stack>
          </Card>
        ) : null}

        {/* Add entry */}
        <Card sx={{ p: 2 }}>
          <ToggleButtonGroup
            size="small"
            exclusive
            value={addMode}
            onChange={(_, v) => v && setAddMode(v)}
            sx={{ mb: 1.5 }}
          >
            <ToggleButton value="search"><IconSearch size={14} style={{ marginRight: 6 }} /> Search food</ToggleButton>
            <ToggleButton value="text"><IconPencil size={14} style={{ marginRight: 6 }} /> Free text</ToggleButton>
          </ToggleButtonGroup>
          {addMode === 'search'
            ? <FoodSearchAdder dateKey={dateKey} onAdded={refresh} />
            : <FreeTextAdder dateKey={dateKey} onAdded={refresh} />}
        </Card>

        {/* Entries */}
        {loading ? null : entries.length === 0 ? (
          <EmptyState
            icon={<IconApple size={32} />}
            title="Nothing logged yet"
            body="Search the USDA database or free-type a meal. The dietitian only gets honest with honest data."
          />
        ) : (
          <Stack spacing={1}>
            <Typography variant="overline" color="text.secondary">Today's log</Typography>
            {entries.map((e) => <EntryRow key={e.id} entry={e} onDelete={() => handleDelete(e.id)} />)}
          </Stack>
        )}

        {/* Analyse */}
        <Card sx={{ p: 2 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} sx={{ alignItems: { sm: 'center' } }}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle2">Run analysis</Typography>
              <Typography variant="caption" color="text.secondary">
                Sends your log + profile to {providerLabel || 'your AI provider'}. Cached per day — re-run to refresh.
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

/* ---- Entry row ---- */

function EntryRow({ entry, onDelete }) {
  const n = entry.nutrition;
  return (
    <Card sx={{ p: 1.5 }}>
      <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
        <Typography variant="caption" sx={{ fontVariantNumeric: 'tabular-nums', color: 'primary.main', minWidth: 44 }}>
          {format(new Date(entry.at), 'HH:mm')}
        </Typography>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {entry.text}
            {entry.brand ? <Typography component="span" variant="caption" color="text.secondary"> · {entry.brand}</Typography> : null}
          </Typography>
          {n ? (
            <Typography variant="caption" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
              {entry.grams ? `${entry.grams}g · ` : ''}{Math.round(n.kcal)} kcal · P{Math.round(n.protein_g)} C{Math.round(n.carbs_g)} F{Math.round(n.fat_g)}
              <Chip size="small" label="USDA" sx={{ ml: 0.75, height: 16, fontSize: 10 }} color="success" variant="outlined" />
            </Typography>
          ) : (
            <Typography variant="caption" color="text.secondary">free-text · AI will estimate</Typography>
          )}
        </Box>
        <IconButton size="small" onClick={onDelete} aria-label="Delete entry">
          <IconTrash size={16} />
        </IconButton>
      </Stack>
    </Card>
  );
}

/* ---- Free text adder ---- */

function FreeTextAdder({ dateKey, onAdded }) {
  const [text, setText] = useState('');
  async function submit(e) {
    e?.preventDefault?.();
    const value = text.trim();
    if (!value) return;
    setText('');
    await addFoodEntry({ date: dateKey, at: Date.now(), text: value, source: 'text' });
    onAdded?.();
  }
  return (
    <Box component="form" onSubmit={submit}>
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
        Be specific with portions. The AI will estimate calories on analysis.
      </Typography>
    </Box>
  );
}

/* ---- Food search adder (USDA) ---- */

function FoodSearchAdder({ dateKey, onAdded }) {
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [picked, setPicked] = useState(null);
  const [grams, setGrams] = useState(100);
  const abortRef = useRef(null);

  useEffect(() => {
    if (query.trim().length < 2) {
      setOptions([]);
      return;
    }
    if (abortRef.current) abortRef.current.abort();
    const ctl = new AbortController();
    abortRef.current = ctl;
    const t = setTimeout(async () => {
      setLoading(true);
      setSearchError('');
      try {
        const list = await searchFoods(query, { signal: ctl.signal, pageSize: 15 });
        if (!ctl.signal.aborted) setOptions(list);
      } catch (e) {
        if (!ctl.signal.aborted) setSearchError(e?.message || 'Search failed');
      } finally {
        if (!ctl.signal.aborted) setLoading(false);
      }
    }, 350);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [query]);

  async function add() {
    if (!picked) return;
    const serving = computeServing(picked, grams);
    const label = `${picked.name}${picked.brand ? ` (${picked.brand})` : ''}`;
    await addFoodEntry({
      date: dateKey,
      at: Date.now(),
      text: label,
      grams: serving.grams,
      kcalEst: serving.kcal,
      brand: picked.brand || null,
      fdcId: picked.fdcId,
      nutrition: {
        kcal: serving.kcal,
        protein_g: serving.protein_g,
        fat_g: serving.fat_g,
        carbs_g: serving.carbs_g,
        fiber_g: serving.fiber_g,
        sugar_g: serving.sugar_g,
        sodium_mg: serving.sodium_mg,
      },
      source: 'usda',
    });
    setPicked(null);
    setQuery('');
    setOptions([]);
    setGrams(100);
    onAdded?.();
  }

  return (
    <Stack spacing={1}>
      <Autocomplete
        options={options}
        loading={loading}
        filterOptions={(x) => x}
        getOptionLabel={(o) => (o ? `${o.name}${o.brand ? ` (${o.brand})` : ''}` : '')}
        isOptionEqualToValue={(a, b) => a?.fdcId === b?.fdcId}
        value={picked}
        onChange={(_, v) => setPicked(v)}
        inputValue={query}
        onInputChange={(_, v) => setQuery(v)}
        noOptionsText={query.trim().length < 2 ? 'Type at least 2 characters' : 'No matches'}
        renderOption={(props, opt) => {
          const { key, ...rest } = props;
          return (
            <Box component="li" key={`${opt.fdcId}-${key}`} {...rest} sx={{ display: 'block !important' }}>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>{opt.name}</Typography>
              <Typography variant="caption" color="text.secondary">
                {opt.brand ? `${opt.brand} · ` : ''}{opt.dataType}
                {opt.perHundredGrams?.kcal ? ` · ${Math.round(opt.perHundredGrams.kcal)} kcal / 100g` : ''}
              </Typography>
            </Box>
          );
        }}
        renderInput={(params) => {
          const inputProps = params.InputProps || {};
          return (
            <TextField
              {...params}
              placeholder="Search a food (e.g. banana, dal, oats)…"
              InputProps={{
                ...inputProps,
                startAdornment: <InputSearchIcon />,
                endAdornment: (
                  <>
                    {loading ? <CircularProgress size={16} /> : null}
                    {inputProps.endAdornment}
                  </>
                ),
              }}
            />
          );
        }}
      />
      {searchError ? <Alert severity="warning">{searchError}</Alert> : null}
      {picked ? (
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ alignItems: { sm: 'center' } }}>
          <TextField
            label="Serving (grams)"
            type="number"
            value={grams}
            onChange={(e) => setGrams(Math.max(1, Number(e.target.value) || 0))}
            sx={{ width: { xs: '100%', sm: 180 } }}
            slotProps={{ htmlInput: { inputMode: 'numeric', min: 1, max: 5000 } }}
          />
          <Box sx={{ flex: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Per {grams}g:&nbsp;
              {(() => {
                const s = computeServing(picked, grams);
                return `${Math.round(s.kcal)} kcal · P${Math.round(s.protein_g)} C${Math.round(s.carbs_g)} F${Math.round(s.fat_g)}`;
              })()}
            </Typography>
          </Box>
          <Button onClick={add} variant="contained" startIcon={<IconPlus size={16} />}>
            Add
          </Button>
        </Stack>
      ) : null}
      <Typography variant="caption" color="text.secondary">
        Powered by USDA FoodData Central. Per-100g values are scaled to your serving size.
      </Typography>
    </Stack>
  );
}

function InputSearchIcon() {
  return (
    <Box sx={{ display: 'inline-flex', mr: 0.5, color: 'text.secondary' }}>
      <IconSearch size={16} />
    </Box>
  );
}

/* ---- Day report ---- */

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
          <Chip size="small" color={alignColor} label={String(align).replace('-', ' ')} />
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
          <LinearProgress value={pct} variant="determinate" sx={{ mt: 1, height: 8, borderRadius: 4 }} />
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

        {Array.isArray(data.mealSuggestions) && data.mealSuggestions.length ? (
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Meal ideas (matched to your diet)</Typography>
            <Stack spacing={0.5}>
              {data.mealSuggestions.map((m, i) => (
                <Stack key={i} direction="row" spacing={1} sx={{ alignItems: 'baseline' }}>
                  <Chip size="small" label={m.meal} sx={{ textTransform: 'capitalize' }} />
                  <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }}>{m.idea}</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                    ~{Math.round(m.approxKcal || 0)} kcal · {Math.round(m.protein_g || 0)}g P
                  </Typography>
                </Stack>
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
                    {it.source === 'usda' ? <Chip size="small" label="USDA" sx={{ ml: 0.5, height: 16, fontSize: 10 }} color="success" variant="outlined" /> : null}
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

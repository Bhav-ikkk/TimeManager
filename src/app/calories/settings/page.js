'use client';

/**
 * src/app/calories/settings/page.js — Profile + AI provider key.
 *
 * Profile drives the prompt. Keys are BYOK and never leave the browser.
 * Layout uses MUI Grid v2 so personal-details fields line up cleanly on
 * both phone and desktop.
 */
import { useEffect, useState } from 'react';
import {
  Stack,
  Box,
  Card,
  Typography,
  Button,
  TextField,
  IconButton,
  MenuItem,
  Alert,
  InputAdornment,
  Chip,
  Divider,
  ToggleButton,
  ToggleButtonGroup,
  Link as MuiLink,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import {
  IconArrowLeft,
  IconKey,
  IconEye,
  IconEyeOff,
  IconTrash,
  IconCheck,
  IconBolt,
  IconExternalLink,
} from '@tabler/icons-react';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import Crumbs from '@/components/Crumbs';
import DietActivationPanel from '@/components/DietActivationPanel';
import { useDietFeatureEnabled } from '@/hooks/useDietFeatureEnabled';
import {
  getCalorieProfile,
  setCalorieProfile,
  getProvider,
  setProvider,
  getApiKey,
  setApiKey,
  getModel,
  setModel,
  estimateBMR,
  estimateTDEE,
  suggestDailyTarget,
  maskKey,
  DEFAULT_PROFILE,
  DIET_OPTIONS,
} from '@/lib/calories';
import { PROVIDERS } from '@/lib/aiProviders';

const ACTIVITY_OPTIONS = [
  { value: 'sedentary', label: 'Sedentary (desk, no workouts)' },
  { value: 'light', label: 'Light (1-2 workouts / week)' },
  { value: 'moderate', label: 'Moderate (3-5 workouts / week)' },
  { value: 'active', label: 'Active (6-7 workouts / week)' },
  { value: 'athlete', label: 'Athlete (2x daily training)' },
];
const GENDER_OPTIONS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other / prefer not to say' },
];
const GOAL_OPTIONS = [
  { value: 'cut', label: 'Lose weight (cut)' },
  { value: 'maintain', label: 'Maintain' },
  { value: 'bulk', label: 'Gain weight (bulk)' },
];

export default function CalorieSettingsPage() {
  const { enabled, ready } = useDietFeatureEnabled();

  if (!ready) {
    return (
      <AppShell initial="B">
        <Card sx={{ p: 2 }}>
          <Typography variant="body2" color="text.secondary">Loading settings...</Typography>
        </Card>
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

  return <CalorieSettingsContent />;
}

function CalorieSettingsContent() {
  const [profile, setProfile] = useState(DEFAULT_PROFILE);
  const [provider, setProviderState] = useState('groq');
  const [keys, setKeys] = useState({ groq: '', gemini: '', openrouter: '' });
  const [models, setModels] = useState({ groq: '', gemini: '', openrouter: '' });
  const [savedKeys, setSavedKeys] = useState({ groq: '', gemini: '', openrouter: '' });
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const [p, prov] = await Promise.all([getCalorieProfile(), getProvider()]);
      setProfile(p);
      setProviderState(prov);
      const [gk, ek, ok, gm, em, om] = await Promise.all([
        getApiKey('groq'), getApiKey('gemini'), getApiKey('openrouter'),
        getModel('groq'), getModel('gemini'), getModel('openrouter'),
      ]);
      const k = { groq: gk, gemini: ek, openrouter: ok };
      setKeys(k);
      setSavedKeys(k);
      setModels({ groq: gm, gemini: em, openrouter: om });
    })();
  }, []);

  function update(patch) {
    setProfile((p) => ({ ...p, ...patch }));
    setSaved(false);
  }

  async function handleSave() {
    setBusy(true);
    try {
      const safe = {
        ...profile,
        age: clamp(toNum(profile.age), 10, 110),
        heightCm: clamp(toNum(profile.heightCm), 80, 250),
        weightKg: clamp(toNum(profile.weightKg), 25, 350),
        goalWeightKg: clamp(toNum(profile.goalWeightKg), 25, 350),
        dailyCalorieTarget: clamp(toNum(profile.dailyCalorieTarget), 800, 6000),
        proteinTargetG: clamp(toNum(profile.proteinTargetG), 20, 400),
        name: trimSlice(profile.name, 40),
        location: trimSlice(profile.location, 80),
        cuisinePref: trimSlice(profile.cuisinePref, 80),
        allergies: trimSlice(profile.allergies, 200),
        dietaryNotes: trimSlice(profile.dietaryNotes, 400),
      };
      await setCalorieProfile(safe);
      await setProvider(provider);
      await Promise.all([
        setApiKey('groq', keys.groq),
        setApiKey('gemini', keys.gemini),
        setApiKey('openrouter', keys.openrouter),
        setModel('groq', models.groq || PROVIDERS.groq.defaultModel),
        setModel('gemini', models.gemini || PROVIDERS.gemini.defaultModel),
        setModel('openrouter', models.openrouter || PROVIDERS.openrouter.defaultModel),
      ]);
      setSavedKeys(keys);
      setProfile(safe);
      setSaved(true);
      setTimeout(() => setSaved(false), 2400);
    } finally {
      setBusy(false);
    }
  }

  async function clearKey(p) {
    setKeys((k) => ({ ...k, [p]: '' }));
    await setApiKey(p, '');
    setSavedKeys((k) => ({ ...k, [p]: '' }));
  }

  const bmr = estimateBMR(profile);
  const tdee = estimateTDEE(profile);
  const suggested = suggestDailyTarget(profile);
  const cfg = PROVIDERS[provider];
  const modelOptions = cfg?.models || [];

  return (
    <AppShell initial="B">
      <Stack spacing={3}>
        <Box>
          <Crumbs
            items={[
              { label: 'Today', href: '/' },
              { label: 'Calories', href: '/calories' },
              { label: 'Settings' },
            ]}
          />
          <Stack direction="row" sx={{ alignItems: 'center', mt: 1 }}>
            <IconButton component={Link} href="/calories" aria-label="Back" sx={{ mr: 0.5 }}>
              <IconArrowLeft size={20} />
            </IconButton>
            <Typography variant="h4">Calorie settings</Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Your profile shapes the dietitian. Be honest — the analysis is only
            as good as the data behind it.
          </Typography>
        </Box>

        {/* Provider + key card */}
        <Card sx={{ p: { xs: 2, sm: 2.5 } }}>
          <Stack spacing={1.5}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <IconBolt size={18} />
              <Typography variant="subtitle2">AI provider (BYOK)</Typography>
            </Stack>
            <ToggleButtonGroup
              size="small"
              exclusive
              value={provider}
              onChange={(_, v) => v && setProviderState(v)}
              sx={{ flexWrap: 'wrap', gap: 0.5 }}
            >
              {Object.values(PROVIDERS).map((p) => (
                <ToggleButton key={p.id} value={p.id} sx={{ flex: 1, minWidth: 110 }}>
                  {p.label.split(' (')[0]}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
            <Typography variant="caption" color="text.secondary">
              {cfg?.label}.{' '}
              <MuiLink href={cfg?.docs} target="_blank" rel="noopener" underline="hover">
                Get a free key <IconExternalLink size={12} style={{ verticalAlign: 'middle' }} />
              </MuiLink>
            </Typography>

            <Grid container spacing={1.5}>
              <Grid size={{ xs: 12 }}>
                <TextField
                  fullWidth
                  label={`${cfg?.label.split(' (')[0]} API key`}
                  type={showKey ? 'text' : 'password'}
                  value={keys[provider] || ''}
                  onChange={(e) => setKeys((k) => ({ ...k, [provider]: e.target.value }))}
                  placeholder={provider === 'gemini' ? 'AIza…' : provider === 'groq' ? 'gsk_…' : 'sk-or-…'}
                  autoComplete="off"
                  spellCheck={false}
                  helperText={savedKeys[provider] ? `saved · ${maskKey(savedKeys[provider])}` : 'Stored only on this device'}
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <IconKey size={16} />
                        </InputAdornment>
                      ),
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton size="small" onClick={() => setShowKey((s) => !s)} aria-label="Toggle key">
                            {showKey ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                          </IconButton>
                          {savedKeys[provider] ? (
                            <IconButton size="small" onClick={() => clearKey(provider)} aria-label="Clear key">
                              <IconTrash size={16} />
                            </IconButton>
                          ) : null}
                        </InputAdornment>
                      ),
                    },
                    htmlInput: { maxLength: 200 },
                  }}
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <TextField
                  select
                  fullWidth
                  label="Model"
                  value={models[provider] || cfg?.defaultModel || ''}
                  onChange={(e) => setModels((m) => ({ ...m, [provider]: e.target.value }))}
                >
                  {modelOptions.map((o) => (
                    <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                  ))}
                </TextField>
              </Grid>
            </Grid>
            <Typography variant="caption" color="text.secondary">
              The key lives only in this browser's IndexedDB and is sent
              directly to the provider. We have no servers in this loop.
            </Typography>
          </Stack>
        </Card>

        {/* Profile card */}
        <Card sx={{ p: { xs: 2, sm: 2.5 } }}>
          <Typography variant="subtitle2" sx={{ mb: 1.5 }}>Personal details</Typography>
          <Grid container spacing={1.5}>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label="Name (optional)"
                value={profile.name}
                onChange={(e) => update({ name: e.target.value })}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                select fullWidth label="Gender"
                value={profile.gender}
                onChange={(e) => update({ gender: e.target.value })}
              >
                {GENDER_OPTIONS.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth label="Age" type="number"
                value={profile.age}
                onChange={(e) => update({ age: e.target.value })}
                slotProps={{ htmlInput: { inputMode: 'numeric', min: 10, max: 110 } }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                fullWidth label="Height (cm)" type="number"
                value={profile.heightCm}
                onChange={(e) => update({ heightCm: e.target.value })}
                slotProps={{ htmlInput: { inputMode: 'numeric', min: 80, max: 250 } }}
              />
            </Grid>
            <Grid size={{ xs: 6, sm: 4 }}>
              <TextField
                fullWidth label="Weight (kg)" type="number"
                value={profile.weightKg}
                onChange={(e) => update({ weightKg: e.target.value })}
                slotProps={{ htmlInput: { inputMode: 'decimal', step: 0.1, min: 25, max: 350 } }}
              />
            </Grid>
            <Grid size={{ xs: 6, sm: 4 }}>
              <TextField
                fullWidth label="Goal weight (kg)" type="number"
                value={profile.goalWeightKg}
                onChange={(e) => update({ goalWeightKg: e.target.value })}
                slotProps={{ htmlInput: { inputMode: 'decimal', step: 0.1, min: 25, max: 350 } }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                select fullWidth label="Activity level"
                value={profile.activity}
                onChange={(e) => update({ activity: e.target.value })}
              >
                {ACTIVITY_OPTIONS.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                select fullWidth label="Goal"
                value={profile.goal}
                onChange={(e) => update({ goal: e.target.value })}
              >
                {GOAL_OPTIONS.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                select fullWidth label="Diet type"
                value={profile.diet}
                onChange={(e) => update({ diet: e.target.value })}
              >
                {DIET_OPTIONS.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth label="Location (city, country)"
                value={profile.location}
                onChange={(e) => update({ location: e.target.value })}
                placeholder="e.g. Pune, India"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth label="Cuisine preference"
                value={profile.cuisinePref}
                onChange={(e) => update({ cuisinePref: e.target.value })}
                placeholder="e.g. North Indian, Italian"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth label="Allergies / intolerances"
                value={profile.allergies}
                onChange={(e) => update({ allergies: e.target.value })}
                placeholder="e.g. peanuts, lactose"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth label="Daily calorie target (kcal)" type="number"
                value={profile.dailyCalorieTarget}
                onChange={(e) => update({ dailyCalorieTarget: e.target.value })}
                helperText={`Suggested from your profile: ${suggested} kcal`}
                slotProps={{ htmlInput: { inputMode: 'numeric', min: 800, max: 6000 } }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth label="Daily protein target (g)" type="number"
                value={profile.proteinTargetG}
                onChange={(e) => update({ proteinTargetG: e.target.value })}
                slotProps={{ htmlInput: { inputMode: 'numeric', min: 20, max: 400 } }}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth multiline minRows={2}
                label="Other dietary notes"
                value={profile.dietaryNotes}
                onChange={(e) => update({ dietaryNotes: e.target.value })}
                placeholder="Anything else the dietitian should know."
              />
            </Grid>
          </Grid>

          <Divider sx={{ my: 2 }} />
          <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap', gap: 0.75 }}>
            <Chip size="small" variant="outlined" label={`BMR ~${bmr} kcal`} />
            <Chip size="small" variant="outlined" label={`TDEE ~${tdee} kcal`} />
            <Chip size="small" color="primary" label={`Suggested target ${suggested} kcal`} />
          </Stack>
        </Card>

        {saved ? (
          <Alert severity="success" icon={<IconCheck size={18} />}>Saved.</Alert>
        ) : null}

        <Stack direction="row" spacing={1}>
          <Button component={Link} href="/calories" variant="outlined">Cancel</Button>
          <Box sx={{ flex: 1 }} />
          <Button onClick={handleSave} variant="contained" disabled={busy}>
            Save settings
          </Button>
        </Stack>
      </Stack>
    </AppShell>
  );
}

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function clamp(n, lo, hi) {
  if (n < lo) return lo;
  if (n > hi) return hi;
  return n;
}
function trimSlice(v, max) {
  return String(v || '').trim().slice(0, max);
}

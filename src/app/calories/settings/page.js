'use client';

/**
 * src/app/calories/settings/page.js — Profile + Gemini key.
 *
 * Profile drives the prompt sent to Gemini. The API key never leaves the
 * device — it's stored in IndexedDB via the same `settings` keystore the
 * rest of the app uses.
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
} from '@mui/material';
import {
  IconArrowLeft,
  IconKey,
  IconEye,
  IconEyeOff,
  IconTrash,
  IconCheck,
} from '@tabler/icons-react';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import Crumbs from '@/components/Crumbs';
import {
  getCalorieProfile,
  setCalorieProfile,
  getGeminiKey,
  setGeminiKey,
  getGeminiModel,
  setGeminiModel,
  estimateBMR,
  estimateTDEE,
  suggestDailyTarget,
  maskKey,
  DEFAULT_PROFILE,
} from '@/lib/calories';

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
const MODEL_OPTIONS = [
  { value: 'gemini-2.5-flash', label: 'gemini-2.5-flash (fast, cheap)' },
  { value: 'gemini-2.5-pro', label: 'gemini-2.5-pro (most accurate)' },
  { value: 'gemini-2.0-flash', label: 'gemini-2.0-flash' },
];

export default function CalorieSettingsPage() {
  const [profile, setProfile] = useState(DEFAULT_PROFILE);
  const [key, setKey] = useState('');
  const [savedKey, setSavedKey] = useState('');
  const [model, setModel] = useState('gemini-2.5-flash');
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([getCalorieProfile(), getGeminiKey(), getGeminiModel()]).then(([p, k, m]) => {
      setProfile(p);
      setSavedKey(k);
      setKey(k);
      setModel(m);
    });
  }, []);

  function update(patch) {
    setProfile((p) => ({ ...p, ...patch }));
    setSaved(false);
  }

  async function handleSave() {
    setBusy(true);
    try {
      // Sanitise numbers.
      const safe = {
        ...profile,
        age: clamp(toNum(profile.age), 10, 110),
        heightCm: clamp(toNum(profile.heightCm), 80, 250),
        weightKg: clamp(toNum(profile.weightKg), 25, 350),
        goalWeightKg: clamp(toNum(profile.goalWeightKg), 25, 350),
        dailyCalorieTarget: clamp(toNum(profile.dailyCalorieTarget), 800, 6000),
        proteinTargetG: clamp(toNum(profile.proteinTargetG), 20, 400),
        name: String(profile.name || '').trim().slice(0, 40),
        dietaryNotes: String(profile.dietaryNotes || '').trim().slice(0, 400),
      };
      await setCalorieProfile(safe);
      await setGeminiKey(key);
      await setGeminiModel(model);
      setSavedKey(key);
      setProfile(safe);
      setSaved(true);
      setTimeout(() => setSaved(false), 2400);
    } finally {
      setBusy(false);
    }
  }

  async function handleClearKey() {
    setKey('');
    await setGeminiKey('');
    setSavedKey('');
  }

  const bmr = estimateBMR(profile);
  const tdee = estimateTDEE(profile);
  const suggested = suggestDailyTarget(profile);

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
            as accurate as the data behind it.
          </Typography>
        </Box>

        {/* API key card */}
        <Card sx={{ p: 2 }}>
          <Stack spacing={1.25}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <IconKey size={18} />
              <Typography variant="subtitle2">Gemini API key (BYOK)</Typography>
              {savedKey ? <Chip size="small" color="primary" label={`saved · ${maskKey(savedKey)}`} /> : null}
            </Stack>
            <TextField
              type={showKey ? 'text' : 'password'}
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="AIza…"
              autoComplete="off"
              spellCheck={false}
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setShowKey((s) => !s)} aria-label="Toggle key visibility">
                        {showKey ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                      </IconButton>
                      {savedKey ? (
                        <IconButton size="small" onClick={handleClearKey} aria-label="Clear key">
                          <IconTrash size={16} />
                        </IconButton>
                      ) : null}
                    </InputAdornment>
                  ),
                },
                htmlInput: { maxLength: 200 },
              }}
            />
            <TextField
              select
              label="Model"
              value={model}
              onChange={(e) => setModel(e.target.value)}
            >
              {MODEL_OPTIONS.map((o) => (
                <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
              ))}
            </TextField>
            <Typography variant="caption" color="text.secondary">
              The key is stored only in this browser's IndexedDB. It is sent
              directly to <strong>generativelanguage.googleapis.com</strong> when
              you tap analyse. It never touches our servers — there are none.
              Get a key at <em>aistudio.google.com</em>.
            </Typography>
          </Stack>
        </Card>

        {/* Profile card */}
        <Card sx={{ p: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1.5 }}>Personal profile</Typography>
          <Stack spacing={1.5}>
            <TextField
              label="Name (optional)"
              value={profile.name}
              onChange={(e) => update({ name: e.target.value })}
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <TextField
                select
                label="Gender"
                value={profile.gender}
                onChange={(e) => update({ gender: e.target.value })}
              >
                {GENDER_OPTIONS.map((o) => (
                  <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                ))}
              </TextField>
              <TextField
                label="Age"
                type="number"
                value={profile.age}
                onChange={(e) => update({ age: e.target.value })}
              />
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <TextField
                label="Height (cm)"
                type="number"
                value={profile.heightCm}
                onChange={(e) => update({ heightCm: e.target.value })}
              />
              <TextField
                label="Weight (kg)"
                type="number"
                value={profile.weightKg}
                onChange={(e) => update({ weightKg: e.target.value })}
              />
              <TextField
                label="Goal weight (kg)"
                type="number"
                value={profile.goalWeightKg}
                onChange={(e) => update({ goalWeightKg: e.target.value })}
              />
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <TextField
                select
                label="Activity level"
                value={profile.activity}
                onChange={(e) => update({ activity: e.target.value })}
              >
                {ACTIVITY_OPTIONS.map((o) => (
                  <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label="Goal"
                value={profile.goal}
                onChange={(e) => update({ goal: e.target.value })}
              >
                {GOAL_OPTIONS.map((o) => (
                  <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                ))}
              </TextField>
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <TextField
                label="Daily calorie target (kcal)"
                type="number"
                value={profile.dailyCalorieTarget}
                onChange={(e) => update({ dailyCalorieTarget: e.target.value })}
                helperText={`Suggested from your profile: ${suggested} kcal`}
              />
              <TextField
                label="Daily protein target (g)"
                type="number"
                value={profile.proteinTargetG}
                onChange={(e) => update({ proteinTargetG: e.target.value })}
              />
            </Stack>
            <TextField
              label="Dietary notes (allergies, vegetarian, etc.)"
              value={profile.dietaryNotes}
              onChange={(e) => update({ dietaryNotes: e.target.value })}
              multiline
              minRows={2}
            />

            <Divider />
            <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap', gap: 0.75 }}>
              <Chip size="small" variant="outlined" label={`BMR ~${bmr} kcal`} />
              <Chip size="small" variant="outlined" label={`TDEE ~${tdee} kcal`} />
              <Chip size="small" color="primary" label={`Suggested daily target ${suggested} kcal`} />
            </Stack>
          </Stack>
        </Card>

        {saved ? (
          <Alert severity="success" icon={<IconCheck size={18} />}>Saved.</Alert>
        ) : null}

        <Stack direction="row" spacing={1}>
          <Button component={Link} href="/calories" variant="outlined">
            Cancel
          </Button>
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

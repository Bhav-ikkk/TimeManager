'use client';

/**
 * src/app/notifications/page.js — Notification preferences.
 *
 * Per-category toggles plus the times for the daily quote nudges, plus a
 * "send test notification" button so the user can verify reminders work
 * on their device before relying on them.
 */
import { useEffect, useState } from 'react';
import {
  Stack,
  Typography,
  Box,
  Card,
  Switch,
  Button,
  IconButton,
  Chip,
  Divider,
  Alert,
} from '@mui/material';
import {
  IconBell,
  IconClock,
  IconQuote,
  IconSun,
  IconChecklist,
  IconPlus,
  IconTrash,
  IconRefresh,
} from '@tabler/icons-react';
import AppShell from '@/components/AppShell';
import Crumbs from '@/components/Crumbs';
import TimeField from '@/components/TimeField';
import {
  getNotificationPrefs,
  setNotificationPrefs,
  notificationStatus,
  notificationsSupported,
  requestNotificationPermission,
  sendTestNotification,
  rescheduleAll,
  getMorningAlarm,
  setMorningAlarm,
  getDeliveryCapabilities,
  DEFAULT_QUOTE_TIMES,
} from '@/lib/notifications';

const MAX_QUOTE_TIMES = 6;

export default function NotificationsPage() {
  const [prefs, setPrefs] = useState(null);
  const [perm, setPerm] = useState('default');
  const [morning, setMorning] = useState('07:00');
  const [busy, setBusy] = useState(false);
  const [testStatus, setTestStatus] = useState(null);
  const [caps, setCaps] = useState(null);

  useEffect(() => {
    getNotificationPrefs().then(setPrefs).catch(() => setPrefs({ ...{} }));
    getMorningAlarm().then(setMorning).catch(() => {});
    setPerm(notificationStatus());
    getDeliveryCapabilities().then(setCaps).catch(() => {});
  }, []);

  async function update(patch) {
    const next = { ...(prefs || {}), ...patch };
    setPrefs(next);
    await setNotificationPrefs(patch);
  }

  async function enable() {
    const next = await requestNotificationPermission();
    setPerm(next);
    if (next === 'granted') await rescheduleAll();
  }

  async function handleTest() {
    setBusy(true);
    try {
      const result = await sendTestNotification();
      setTestStatus(result);
      setPerm(notificationStatus());
    } finally {
      setBusy(false);
    }
  }

  async function updateQuoteTime(idx, value) {
    if (!prefs) return;
    const next = [...(prefs.quoteTimes || DEFAULT_QUOTE_TIMES)];
    next[idx] = value;
    await update({ quoteTimes: next });
  }

  async function addQuoteTime() {
    if (!prefs) return;
    const next = [...(prefs.quoteTimes || DEFAULT_QUOTE_TIMES), '12:00'];
    if (next.length > MAX_QUOTE_TIMES) return;
    await update({ quoteTimes: next });
  }

  async function removeQuoteTime(idx) {
    if (!prefs) return;
    const next = (prefs.quoteTimes || DEFAULT_QUOTE_TIMES).filter((_, i) => i !== idx);
    await update({ quoteTimes: next.length ? next : DEFAULT_QUOTE_TIMES });
  }

  async function saveMorning(hhmm) {
    setMorning(hhmm);
    if (/^\d{2}:\d{2}$/.test(hhmm)) await setMorningAlarm(hhmm);
  }

  const supported = notificationsSupported();
  const granted = perm === 'granted';

  return (
    <AppShell initial="B">
      <Stack spacing={3}>
        <Box>
          <Crumbs
            items={[
              { label: 'Today', href: '/' },
              { label: 'Notifications' },
            ]}
          />
          <Typography variant="h4" sx={{ mt: 1 }}>
            Notifications
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Pick exactly when and what TauntTable should nudge you about. All
            scheduled on-device — no servers.
          </Typography>
        </Box>

        {!supported ? (
          <Alert severity="warning">
            Notifications aren&apos;t supported in this browser. Install
            TauntTable to your home screen and reopen it from there.
          </Alert>
        ) : !granted ? (
          <Card sx={{ p: 2 }}>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
              <Box sx={{ color: 'primary.main', display: 'flex' }}>
                <IconBell size={22} />
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography variant="subtitle2">Permission required</Typography>
                <Typography variant="caption" color="text.secondary">
                  Allow notifications to receive reminders, the morning alarm
                  and your daily quotes.
                </Typography>
              </Box>
              <Button variant="contained" onClick={enable}>
                Enable
              </Button>
            </Stack>
          </Card>
        ) : (
          <Alert severity="success" icon={<IconBell size={20} />}>
            Notifications are on. {testStatus === 'granted' ? 'Test sent — check your tray.' : ''}
          </Alert>
        )}

        {granted && caps ? (
          <Alert
            severity={caps.periodicSync ? 'success' : 'info'}
            sx={{ '& .MuiAlert-message': { width: '100%' } }}
          >
            <Typography variant="subtitle2" sx={{ mb: 0.25 }}>
              {caps.periodicSync
                ? 'Background delivery is active'
                : 'Background delivery is best-effort'}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
              {caps.periodicSync
                ? 'Your phone will wake TauntTable in the background to fire reminders even when the app is closed.'
                : 'For the most reliable on-time reminders when the app is closed, install TauntTable to your home screen (Add to Home Screen / Install app) and open it from there at least once. The browser then grants periodic background sync.'}
            </Typography>
          </Alert>
        ) : null}

        {prefs ? (
          <>
            <CategoryCard
              icon={<IconChecklist size={20} />}
              title="Task reminders"
              description="A nudge at every task time you scheduled."
              checked={!!prefs.taskReminders}
              onChange={(v) => update({ taskReminders: v })}
            />

            <CategoryCard
              icon={<IconSun size={20} />}
              title="Morning alarm"
              description="A friendly wake-up at the time below, with the day's first task."
              checked={!!prefs.morningAlarm}
              onChange={(v) => update({ morningAlarm: v })}
            >
              <Box sx={{ mt: 1.5 }}>
                <TimeField label="Alarm time" value={morning} onChange={saveMorning} />
              </Box>
            </CategoryCard>

            <CategoryCard
              icon={<IconQuote size={20} />}
              title="Daily quotes"
              description="Short, calming lines fired throughout the day. Defaults to 3 a day."
              checked={!!prefs.dailyQuotes}
              onChange={(v) => update({ dailyQuotes: v })}
            >
              <Stack spacing={1.25} sx={{ mt: 1.5 }}>
                {(prefs.quoteTimes || DEFAULT_QUOTE_TIMES).map((t, i) => (
                  <Stack
                    key={i}
                    direction="row"
                    spacing={1}
                    sx={{ alignItems: 'center' }}
                  >
                    <Box sx={{ flex: 1 }}>
                      <TimeField
                        label={`Quote #${i + 1}`}
                        value={t}
                        onChange={(v) => updateQuoteTime(i, v)}
                      />
                    </Box>
                    <IconButton
                      size="small"
                      onClick={() => removeQuoteTime(i)}
                      aria-label={`Remove quote time ${i + 1}`}
                      disabled={(prefs.quoteTimes || []).length <= 1}
                    >
                      <IconTrash size={16} />
                    </IconButton>
                  </Stack>
                ))}
                <Box>
                  <Button
                    size="small"
                    startIcon={<IconPlus size={16} />}
                    onClick={addQuoteTime}
                    disabled={(prefs.quoteTimes || []).length >= MAX_QUOTE_TIMES}
                  >
                    Add another time
                  </Button>
                </Box>
                <Typography variant="caption" color="text.secondary">
                  Tip: mark your favourite quotes in{' '}
                  <Box component="span" sx={{ color: 'primary.main', fontWeight: 600 }}>
                    Quotes
                  </Box>{' '}
                  — those will be shown more often in these nudges.
                </Typography>
              </Stack>
            </CategoryCard>

            <Divider sx={{ opacity: 0.4 }} />

            <Card sx={{ p: 2 }}>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1.25}
                sx={{ alignItems: { xs: 'stretch', sm: 'center' } }}
              >
                <Box sx={{ flex: 1 }}>
                  <Typography variant="subtitle2">Send a test notification</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Verifies permission, the service worker, and your OS settings.
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1}>
                  <Button
                    variant="outlined"
                    startIcon={<IconRefresh size={16} />}
                    onClick={() => rescheduleAll().catch(() => {})}
                  >
                    Reschedule
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={<IconClock size={16} />}
                    onClick={handleTest}
                    disabled={busy}
                  >
                    Test
                  </Button>
                </Stack>
              </Stack>
            </Card>

            <Stack
              direction="row"
              spacing={1}
              sx={{ flexWrap: 'wrap', gap: 1, alignItems: 'center' }}
            >
              <Chip
                size="small"
                color={prefs.taskReminders ? 'primary' : 'default'}
                label={prefs.taskReminders ? 'Task reminders on' : 'Task reminders off'}
              />
              <Chip
                size="small"
                color={prefs.morningAlarm ? 'primary' : 'default'}
                label={prefs.morningAlarm ? 'Morning alarm on' : 'Morning alarm off'}
              />
              <Chip
                size="small"
                color={prefs.dailyQuotes ? 'primary' : 'default'}
                label={
                  prefs.dailyQuotes
                    ? `${(prefs.quoteTimes || DEFAULT_QUOTE_TIMES).length} daily quotes`
                    : 'Daily quotes off'
                }
              />
            </Stack>
          </>
        ) : null}
      </Stack>
    </AppShell>
  );
}

function CategoryCard({ icon, title, description, checked, onChange, children }) {
  return (
    <Card sx={{ p: 2 }}>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
        <Box sx={{ color: 'primary.main', display: 'flex' }}>{icon}</Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle2">{title}</Typography>
          <Typography variant="caption" color="text.secondary">
            {description}
          </Typography>
        </Box>
        <Switch
          checked={!!checked}
          onChange={(e) => onChange(e.target.checked)}
          inputProps={{ 'aria-label': title }}
        />
      </Stack>
      {checked && children ? <Box sx={{ pl: { xs: 0, sm: 4.5 } }}>{children}</Box> : null}
    </Card>
  );
}

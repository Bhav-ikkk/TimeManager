'use client';

/**
 * src/components/DayPicker.js
 * Toggleable Mon..Sun chip row used to mark which days a task repeats on.
 *
 * Convention: Monday is shown first (the user thinks in week-starts-Monday)
 * but values stored in db are JS DOW indices (0=Sun..6=Sat).
 */
import { Stack, Chip, Button } from '@mui/material';

const DAYS = [
  { label: 'Mon', value: 1 },
  { label: 'Tue', value: 2 },
  { label: 'Wed', value: 3 },
  { label: 'Thu', value: 4 },
  { label: 'Fri', value: 5 },
  { label: 'Sat', value: 6 },
  { label: 'Sun', value: 0 },
];

export default function DayPicker({ value = [], onChange }) {
  const set = new Set(value);
  const toggle = (v) => {
    const next = new Set(set);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    onChange?.([...next].sort());
  };
  const setMany = (vals) => onChange?.([...new Set(vals)].sort());

  return (
    <Stack spacing={1.25}>
      <Stack
        direction="row"
        sx={{
          flexWrap: 'wrap',
          gap: 0.75,
          rowGap: 1,
        }}
      >
        {DAYS.map((d) => {
          const active = set.has(d.value);
          return (
            <Chip
              key={d.value}
              label={d.label}
              clickable
              color={active ? 'primary' : 'default'}
              variant={active ? 'filled' : 'outlined'}
              onClick={() => toggle(d.value)}
              sx={{ minWidth: 52 }}
            />
          );
        })}
      </Stack>
      <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.5, rowGap: 0.75 }}>
        <Button size="small" onClick={() => setMany([1, 2, 3, 4, 5])}>
          Weekdays
        </Button>
        <Button size="small" onClick={() => setMany([0, 6])}>
          Weekend
        </Button>
        <Button size="small" onClick={() => setMany([0, 1, 2, 3, 4, 5, 6])}>
          Every day
        </Button>
        <Button size="small" onClick={() => setMany([])}>
          Clear
        </Button>
      </Stack>
    </Stack>
  );
}

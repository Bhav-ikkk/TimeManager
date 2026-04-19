'use client';

/**
 * src/components/TimeField.js
 * Pretty time input that opens a circular clock face on tap (mobile-friendly).
 *
 * Stores/returns "HH:mm" 24-hour strings to keep the rest of the app simple.
 */
import { useMemo } from 'react';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { MobileTimePicker } from '@mui/x-date-pickers/MobileTimePicker';

function hhmmToDate(hhmm) {
  if (!hhmm || !/^\d{2}:\d{2}$/.test(hhmm)) return null;
  const [h, m] = hhmm.split(':').map((n) => parseInt(n, 10));
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

function dateToHHmm(d) {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function TimeField({ label = 'Time', value, onChange }) {
  const dateValue = useMemo(() => hhmmToDate(value), [value]);

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <MobileTimePicker
        label={label}
        value={dateValue}
        onChange={(d) => onChange?.(dateToHHmm(d))}
        ampm
        minutesStep={5}
        slotProps={{
          textField: { fullWidth: true },
          dialog: { sx: { '& .MuiPaper-root': { borderRadius: 4 } } },
        }}
      />
    </LocalizationProvider>
  );
}

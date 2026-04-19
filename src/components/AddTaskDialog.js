'use client';

/**
 * src/components/AddTaskDialog.js
 * The single editor that handles both "add" and "edit" task flows.
 *
 * Fields:
 *   - title          required, trimmed, max 80 chars
 *   - time           required, "HH:mm" 24h
 *   - days           which days the task should repeat on (chips)
 *                    if empty, the task is treated as a one-off for today
 *   - note           optional, max 200 chars
 *
 * On save we also reschedule notifications so reminders reflect the change
 * immediately, even if the SW cannot fire while closed.
 */
import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Stack,
  Button,
  Typography,
  Box,
  IconButton,
} from '@mui/material';
import { IconTrash, IconX } from '@tabler/icons-react';
import DayPicker from './DayPicker';
import TimeField from './TimeField';
import { addTask, updateTask, deleteTask, todayKey } from '@/lib/db';
import { rescheduleAll } from '@/lib/notifications';

const MAX_TITLE = 80;
const MAX_NOTE = 200;

export default function AddTaskDialog({ open, initial, onClose }) {
  const isEdit = Boolean(initial && initial.id);

  const [title, setTitle] = useState('');
  const [time, setTime] = useState('09:00');
  const [days, setDays] = useState([]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setTitle(initial?.title ?? '');
    setTime(initial?.time ?? defaultTime());
    setDays(Array.isArray(initial?.days) ? initial.days : []);
    setNote(initial?.note ?? '');
    setError('');
  }, [open, initial]);

  function defaultTime() {
    const d = new Date();
    d.setMinutes(d.getMinutes() + 30 - (d.getMinutes() % 5));
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  async function handleSave() {
    const cleanTitle = title.trim().slice(0, MAX_TITLE);
    if (!cleanTitle) {
      setError('Give the task a name.');
      return;
    }
    if (!/^\d{2}:\d{2}$/.test(time)) {
      setError('Pick a time.');
      return;
    }
    setBusy(true);
    try {
      const payload = {
        title: cleanTitle,
        time,
        days,
        dateOneOff: days.length === 0 ? todayKey() : null,
        note: note.trim().slice(0, MAX_NOTE),
      };
      if (isEdit) {
        await updateTask(initial.id, payload);
      } else {
        await addTask(payload);
      }
      await rescheduleAll();
      onClose?.();
    } catch (e) {
      setError('Could not save. Try again.');
      // eslint-disable-next-line no-console
      console.error(e);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!isEdit) return;
    setBusy(true);
    try {
      await deleteTask(initial.id);
      await rescheduleAll();
      onClose?.();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box sx={{ flex: 1 }}>{isEdit ? 'Edit task' : 'New task'}</Box>
        <IconButton size="small" onClick={onClose} aria-label="Close">
          <IconX size={18} />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ borderColor: 'divider' }}>
        <Stack spacing={2}>
          <TextField
            label="What are you doing?"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            slotProps={{ htmlInput: { maxLength: MAX_TITLE, autoFocus: true } }}
            placeholder="Deep work — chapter 3"
          />
          <TimeField
            label="At what time?"
            value={time}
            onChange={setTime}
          />
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Repeat on
            </Typography>
            <DayPicker value={days} onChange={setDays} />
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              {days.length === 0
                ? 'No days selected → this task only appears today.'
                : `Reminder fires at ${time} on the selected days.`}
            </Typography>
          </Box>
          <TextField
            label="Note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            multiline
            minRows={2}
            slotProps={{ htmlInput: { maxLength: MAX_NOTE } }}
            placeholder="Why this matters today…"
          />
          {error ? (
            <Typography variant="body2" color="warning.main">
              {error}
            </Typography>
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
        {isEdit ? (
          <Button
            color="warning"
            onClick={handleDelete}
            startIcon={<IconTrash size={16} />}
            disabled={busy}
          >
            Delete
          </Button>
        ) : null}
        <Box sx={{ flex: 1 }} />
        <Button onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button variant="contained" onClick={handleSave} disabled={busy}>
          {isEdit ? 'Save' : 'Add task'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

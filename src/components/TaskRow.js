'use client';

/**
 * src/components/TaskRow.js
 * One row in the daily timetable: time, title, completion checkbox, edit/delete menu.
 */
import { Box, Card, Checkbox, IconButton, Stack, Typography, Chip, Tooltip } from '@mui/material';
import { IconDotsVertical, IconRepeat } from '@tabler/icons-react';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function TaskRow({ task, completed, onToggle, onEdit }) {
  const recurring = Array.isArray(task.days) && task.days.length > 0;
  const recurringLabel = recurring
    ? task.days.length === 7
      ? 'Every day'
      : task.days.length === 5 && [1, 2, 3, 4, 5].every((d) => task.days.includes(d))
        ? 'Weekdays'
        : task.days.map((d) => DAY_LABELS[d]).join(' · ')
    : 'One-off';

  return (
    <Card
      sx={{
        p: 1.5,
        opacity: completed ? 0.6 : 1,
      }}
    >
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
        <Checkbox
          checked={!!completed}
          onChange={(e) => onToggle?.(e.target.checked)}
          slotProps={{ input: { 'aria-label': `Mark ${task.title} as done` } }}
          sx={{ p: 0.5 }}
        />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack
            direction="row"
            spacing={1}
            sx={{ mb: 0.25, alignItems: 'baseline', flexWrap: 'wrap', rowGap: 0.25 }}
          >
            <Typography
              variant="subtitle2"
              sx={{ fontVariantNumeric: 'tabular-nums', color: 'primary.main', flexShrink: 0 }}
            >
              {task.time}
            </Typography>
            <Typography
              variant="subtitle1"
              sx={{
                fontWeight: 600,
                textDecoration: completed ? 'line-through' : 'none',
                color: 'text.primary',
                flex: 1,
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {task.title}
            </Typography>
          </Stack>
          <Stack direction="row" sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 0.75 }}>
            <Chip
              size="small"
              icon={recurring ? <IconRepeat size={12} /> : undefined}
              label={recurringLabel}
              variant="outlined"
            />
            {task.note ? (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{
                  flex: 1,
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {task.note}
              </Typography>
            ) : null}
          </Stack>
        </Box>
        <Tooltip title="Edit">
          <IconButton size="small" onClick={() => onEdit?.(task)} aria-label="Edit task">
            <IconDotsVertical size={18} />
          </IconButton>
        </Tooltip>
      </Stack>
    </Card>
  );
}

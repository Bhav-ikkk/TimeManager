'use client';

/**
 * src/app/page.js — Today screen.
 *
 * Shows the day's tasks sorted by time, lets you check them off, and exposes an
 * "Add task" button that opens the editor (wired in the next commit).
 */
import { useState } from 'react';
import { Stack, Typography, Box, Button, Fab } from '@mui/material';
import { IconPlus, IconCalendarTime } from '@tabler/icons-react';
import { format } from 'date-fns';
import AppShell from '@/components/AppShell';
import EmptyState from '@/components/EmptyState';
import SkeletonList from '@/components/SkeletonList';
import TaskRow from '@/components/TaskRow';
import AddTaskDialog from '@/components/AddTaskDialog';
import PermissionBanner from '@/components/PermissionBanner';
import { useToday } from '@/hooks/useToday';
import { setCompletion } from '@/lib/db';

export default function HomePage() {
  const today = new Date();
  const { loading, tasks, isDone, dateKey } = useToday(today);
  const [editing, setEditing] = useState(null);

  const total = tasks.length;
  const done = tasks.filter((t) => isDone(t.id)).length;

  return (
    <AppShell initial="B">
      <Stack spacing={3}>
        <Box>
          <Typography variant="overline" color="text.secondary">
            {format(today, 'EEEE, d MMMM')}
          </Typography>
          <Typography variant="h4" sx={{ mt: 0.25 }}>
            Today
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {total === 0
              ? 'No tasks scheduled. Add the first one to start your day.'
              : `${done} of ${total} done${done === total ? ' — perfectly executed.' : ''}`}
          </Typography>
        </Box>

        <PermissionBanner />

        {loading ? (
          <SkeletonList />
        ) : tasks.length === 0 ? (
          <EmptyState
            icon={<IconCalendarTime size={36} />}
            title="Your day is a blank page"
            body="Add a task with a time. We will quietly remind you when it is time to start."
            action={
              <Button
                variant="contained"
                startIcon={<IconPlus size={18} />}
                onClick={() => setEditing({})}
              >
                Add your first task
              </Button>
            }
          />
        ) : (
          <Stack spacing={1.25}>
            {tasks.map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                completed={isDone(t.id)}
                onToggle={(v) => setCompletion(t.id, dateKey, v)}
                onEdit={(task) => setEditing(task)}
              />
            ))}
          </Stack>
        )}
      </Stack>

      <Fab
        color="primary"
        aria-label="Add task"
        onClick={() => setEditing({})}
        sx={{
          position: 'fixed',
          right: 'calc(16px + env(safe-area-inset-right, 0px))',
          bottom: 'calc(24px + var(--safe-bottom))',
          boxShadow: '0 6px 18px rgba(15,118,110,0.32)',
        }}
      >
        <IconPlus size={22} />
      </Fab>

      <AddTaskDialog
        open={Boolean(editing)}
        initial={editing}
        onClose={() => setEditing(null)}
      />
    </AppShell>
  );
}

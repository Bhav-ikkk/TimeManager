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
import HeroCover from '@/components/HeroCover';
import { useToday } from '@/hooks/useToday';
import { setCompletion } from '@/lib/db';
import { rescheduleAll } from '@/lib/notifications';

export default function HomePage() {
  const today = new Date();
  const { loading, tasks, isDone, dateKey } = useToday(today);
  const [editing, setEditing] = useState(null);

  const total = tasks.length;
  const done = tasks.filter((t) => isDone(t.id)).length;

  return (
    <AppShell initial="B">
      <Stack spacing={3}>
        <HeroCover total={total} done={done} date={today} />

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
                onToggle={async (v) => {
                  await setCompletion(t.id, dateKey, v);
                  // Cancel any pending reminder for a task we just completed.
                  rescheduleAll().catch(() => {});
                }}
                onEdit={(task) => setEditing(task)}
              />
            ))}
          </Stack>
        )}
      </Stack>

      <Fab
        color="primary"
        aria-label="Add task"
        variant="extended"
        onClick={() => setEditing({})}
        sx={{
          position: 'fixed',
          right: 'calc(16px + env(safe-area-inset-right, 0px))',
          // Sit comfortably above the 60px mobile bottom-nav (+ safe area).
          // On >= sm there is no bottom-nav so we tuck closer to the edge.
          bottom: {
            xs: 'calc(76px + var(--safe-bottom))',
            sm: 'calc(28px + var(--safe-bottom))',
          },
          boxShadow: '0 6px 18px rgba(15,118,110,0.32)',
          textTransform: 'none',
          fontWeight: 600,
          pl: 1.75,
          pr: 2.25,
        }}
      >
        <IconPlus size={20} style={{ marginRight: 6 }} />
        Add task
      </Fab>

      <AddTaskDialog
        open={Boolean(editing)}
        initial={editing}
        onClose={() => setEditing(null)}
      />
    </AppShell>
  );
}

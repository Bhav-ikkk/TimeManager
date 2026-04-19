'use client';

/**
 * src/components/SkeletonList.js
 * Tiny rounded skeleton bars used while Dexie is hydrating.
 */
import { Stack, Skeleton } from '@mui/material';

export default function SkeletonList({ count = 4 }) {
  return (
    <Stack spacing={1.25}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton
          key={i}
          variant="rounded"
          height={64}
          sx={{ borderRadius: 2 }}
          animation={false}
        />
      ))}
    </Stack>
  );
}

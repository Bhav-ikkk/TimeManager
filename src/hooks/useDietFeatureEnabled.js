'use client';

import { useEffect, useState } from 'react';
import { DIET_FEATURE_EVENT, getDietFeatureEnabled } from '@/lib/features';

export function useDietFeatureEnabled() {
  const [state, setState] = useState({ enabled: false, ready: false });

  useEffect(() => {
    let active = true;
    getDietFeatureEnabled()
      .then((enabled) => {
        if (active) setState({ enabled, ready: true });
      })
      .catch(() => {
        if (active) setState({ enabled: false, ready: true });
      });

    function handleChange(event) {
      setState({ enabled: Boolean(event.detail?.enabled), ready: true });
    }

    window.addEventListener(DIET_FEATURE_EVENT, handleChange);
    return () => {
      active = false;
      window.removeEventListener(DIET_FEATURE_EVENT, handleChange);
    };
  }, []);

  return state;
}
'use client';

import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  IconButton,
  InputAdornment,
  Link as MuiLink,
  MenuItem,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { IconCheck, IconExternalLink, IconEye, IconEyeOff, IconKey, IconTrash } from '@tabler/icons-react';
import {
  getApiKey,
  getModel,
  getProvider,
  maskKey,
  setApiKey,
  setModel,
  setProvider as saveProvider,
} from '@/lib/calories';
import { PROVIDERS } from '@/lib/aiProviders';

const PROVIDER_IDS = Object.keys(PROVIDERS);

export default function AIProviderSettings() {
  const [provider, setProvider] = useState('groq');
  const [keys, setKeys] = useState({ groq: '', gemini: '', openrouter: '' });
  const [savedKeys, setSavedKeys] = useState({ groq: '', gemini: '', openrouter: '' });
  const [models, setModels] = useState({ groq: '', gemini: '', openrouter: '' });
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const [activeProvider, groqKey, geminiKey, openrouterKey, groqModel, geminiModel, openrouterModel] = await Promise.all([
        getProvider(),
        getApiKey('groq'),
        getApiKey('gemini'),
        getApiKey('openrouter'),
        getModel('groq'),
        getModel('gemini'),
        getModel('openrouter'),
      ]);
      if (!active) return;
      const nextKeys = { groq: groqKey, gemini: geminiKey, openrouter: openrouterKey };
      setProvider(activeProvider);
      setKeys(nextKeys);
      setSavedKeys(nextKeys);
      setModels({ groq: groqModel, gemini: geminiModel, openrouter: openrouterModel });
    })().catch(() => {});
    return () => { active = false; };
  }, []);

  async function save() {
    setSaving(true);
    try {
      await saveProvider(provider);
      await Promise.all(PROVIDER_IDS.map((providerId) => Promise.all([
        setApiKey(providerId, keys[providerId]),
        setModel(providerId, models[providerId] || PROVIDERS[providerId].defaultModel),
      ])));
      setSavedKeys(keys);
      setSaved(true);
      setTimeout(() => setSaved(false), 2200);
    } finally {
      setSaving(false);
    }
  }

  async function clearCurrentKey() {
    setKeys((current) => ({ ...current, [provider]: '' }));
    await setApiKey(provider, '');
    setSavedKeys((current) => ({ ...current, [provider]: '' }));
  }

  const config = PROVIDERS[provider];
  const providerName = config.label.split(' (')[0];

  return (
    <Stack spacing={1.25}>
      <Box>
        <Typography variant="subtitle2">AI writing</Typography>
        <Typography variant="caption" color="text.secondary">
          Your key stays in this browser and is sent directly to the provider you choose.
        </Typography>
      </Box>

      <ToggleButtonGroup
        size="small"
        exclusive
        value={provider}
        onChange={(_, value) => value && setProvider(value)}
        sx={{ flexWrap: 'wrap', gap: 0.5 }}
      >
        {Object.values(PROVIDERS).map((providerConfig) => (
          <ToggleButton key={providerConfig.id} value={providerConfig.id} sx={{ flex: 1, minWidth: 96 }}>
            {providerConfig.label.split(' (')[0]}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      <Typography variant="caption" color="text.secondary">
        Need a key?{' '}
        <MuiLink href={config.docs} target="_blank" rel="noopener" underline="hover">
          Open {providerName} keys <IconExternalLink size={12} style={{ verticalAlign: 'middle' }} />
        </MuiLink>
      </Typography>

      <TextField
        fullWidth
        label={`${providerName} API key`}
        type={showKey ? 'text' : 'password'}
        value={keys[provider] || ''}
        onChange={(event) => setKeys((current) => ({ ...current, [provider]: event.target.value }))}
        placeholder={provider === 'gemini' ? 'AIza...' : provider === 'groq' ? 'gsk_...' : 'sk-or-...'}
        autoComplete="off"
        spellCheck={false}
        helperText={savedKeys[provider] ? `saved, ${maskKey(savedKeys[provider])}` : 'Stored only on this device'}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <IconKey size={16} />
              </InputAdornment>
            ),
            endAdornment: (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => setShowKey((value) => !value)} aria-label="Toggle AI key visibility">
                  {showKey ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                </IconButton>
                {savedKeys[provider] ? (
                  <IconButton size="small" onClick={clearCurrentKey} aria-label="Clear AI key">
                    <IconTrash size={16} />
                  </IconButton>
                ) : null}
              </InputAdornment>
            ),
          },
          htmlInput: { maxLength: 220 },
        }}
      />

      <TextField
        select
        fullWidth
        label="Model"
        value={models[provider] || config.defaultModel}
        onChange={(event) => setModels((current) => ({ ...current, [provider]: event.target.value }))}
      >
        {config.models.map((model) => (
          <MenuItem key={model.value} value={model.value}>{model.label}</MenuItem>
        ))}
      </TextField>

      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'flex-end' }}>
        {saved ? (
          <Typography variant="caption" color="success.main" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
            <IconCheck size={14} /> Saved
          </Typography>
        ) : null}
        <Button size="small" variant="outlined" onClick={save} disabled={saving}>
          Save AI key
        </Button>
      </Stack>
    </Stack>
  );
}
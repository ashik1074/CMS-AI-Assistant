import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_SETTINGS, type Settings } from '../types/conversation';
import { loadSettings, saveSettings } from '../services/settingsService';

export function useSettings(onSaveError?: () => void) {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const onErrorRef = useRef(onSaveError);
  useEffect(() => {
    onErrorRef.current = onSaveError;
  }, [onSaveError]);

  useEffect(() => {
    if (!saveSettings(settings)) onErrorRef.current?.();
  }, [settings]);

  useEffect(() => {
    const dark = settings.theme === 'dark';
    document.documentElement.classList.toggle('dark', dark);
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  }, [settings.theme]);

  const update = useCallback((patch: Partial<Settings>) => setSettings((s) => ({ ...s, ...patch })), []);
  const reset = useCallback(() => setSettings({ ...DEFAULT_SETTINGS }), []);
  const toggleTheme = useCallback(() => setSettings((s) => ({ ...s, theme: s.theme === 'dark' ? 'light' : 'dark' })), []);

  return { settings, update, reset, toggleTheme };
}

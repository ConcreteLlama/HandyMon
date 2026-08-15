'use client';

import { Box, CircularProgress, Alert } from '@mui/material';
import { useAppConfig, useUpdateAppConfig } from '@/hooks/config/useAppConfig';
import { AppConfig } from '@/types/app-config';
import { PairSection } from '@/components/PairSection';
import { ToolPathsSection } from './ToolPathsSection';
import { LhmSection } from './LhmSection';
import { PresentMonSection } from './PresentMonSection';
import { ServicesConfigSection } from './ServicesConfigSection';
import { MyConnectionSection } from './MyConnectionSection';
import { LogsSection } from './LogsSection';
import { NavOrderSection } from './NavOrderSection';
import { AppearanceSection } from './AppearanceSection';
import { UptimeSection } from './UptimeSection';

export function SettingsPage() {
  const { data: config, isLoading, error } = useAppConfig();
  const { mutateAsync: updateConfig } = useUpdateAppConfig();
  const onSave = (updated: AppConfig) => updateConfig(updated);

  // MyConnectionSection is shown to every device regardless of grants — it's
  // "who am I / what can I do", not host config. The rest of this page edits
  // host config, so it needs a real (not error-shaped) config load.
  const configLoaded = !!config && Array.isArray((config as AppConfig).services);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      <MyConnectionSection />
      <AppearanceSection />

      {isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress size={24} sx={{ color: 'var(--accent)' }} />
        </Box>
      )}

      {!isLoading && (error || !configLoaded) && (
        <Alert severity="info">Sign in from the host PC to view or change host settings.</Alert>
      )}

      {!isLoading && configLoaded && (
        <>
          <PairSection />
          <UptimeSection />
          <NavOrderSection config={config!} onSave={onSave} />
          <ToolPathsSection config={config!} onSave={onSave} />
          <LhmSection config={config!} onSave={onSave} />
          <PresentMonSection config={config!} onSave={onSave} />
          <ServicesConfigSection config={config!} onSave={onSave} />
          <LogsSection config={config!} onSave={onSave} />
        </>
      )}
    </Box>
  );
}

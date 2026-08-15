'use client';

import { Box } from '@mui/material';
import SettingsSuggestIcon from '@mui/icons-material/SettingsSuggest';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ServiceStatusIcon } from '@/components/ui/ServiceStatusIcon';
import { ServiceToggleButton } from '@/components/ui/ServiceToggleButton';
import { useGrants } from '@/hooks/auth/useGrants';
import { apiFetch } from '@/utils/api-client';

interface ServiceStatus { id: string; label: string; allowControl: boolean; running: boolean; }

// Generic replacement for the old hardcoded "Apollo" section — lists whatever
// services the host admin configured in Settings → Services, with start/stop
// only where the admin allowed it AND this device has services:control.
export const ServicesSection = () => {
  const qc = useQueryClient();
  const { has } = useGrants();
  const canControl = has('services:control');

  const { data, isLoading } = useQuery({
    queryKey: ['services-status'],
    queryFn: async (): Promise<ServiceStatus[]> => {
      const d = await apiFetch<{ services?: ServiceStatus[] }>('/api/services');
      return d.services ?? [];
    },
    refetchInterval: 3000,
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, running }: { id: string; running: boolean }) =>
      apiFetch(`/api/services/${id}/control?action=${running ? 'stop' : 'start'}`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['services-status'] }),
  });

  const services = data ?? [];

  if (!isLoading && services.length === 0) {
    return (
      <Box sx={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: '14px', p: 3, textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.82rem' }}>
        No services configured — add one in Settings → Services.
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {services.map(s => {
        const statusColor = isLoading ? 'var(--warning)' : s.running ? 'var(--success)' : 'var(--text-dim)';
        const pending = toggleMutation.isPending && toggleMutation.variables?.id === s.id;
        return (
          <Box key={s.id} sx={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: '14px', p: 3, display: 'flex', alignItems: 'center', gap: 3 }}>
            <ServiceStatusIcon icon={SettingsSuggestIcon} isRunning={s.running} statusColor={statusColor} />
            <Box sx={{ flex: 1 }}>
              <Box sx={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '1rem', letterSpacing: '0.05em', color: 'var(--text-primary)' }}>
                {s.label.toUpperCase()}
              </Box>
              <Box sx={{ fontSize: '0.72rem', color: statusColor, mt: 0.25, fontFamily: 'var(--font-mono)', letterSpacing: '0.05em', transition: 'color 0.3s ease' }}>
                {isLoading ? 'CHECKING' : s.running ? 'RUNNING' : 'STOPPED'}
              </Box>
            </Box>
            {s.allowControl && canControl && (
              <ServiceToggleButton
                isRunning={s.running}
                isPending={pending}
                onToggle={() => toggleMutation.mutate({ id: s.id, running: s.running })}
              />
            )}
          </Box>
        );
      })}
    </Box>
  );
};

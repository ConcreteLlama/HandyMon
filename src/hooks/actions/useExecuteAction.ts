import { useMutation } from '@tanstack/react-query';
import { apiFetch } from '@/utils/api-client';
import { showToast } from '@/components/ui/Toast';

type ExecuteResult = { ok: boolean; warnings?: string[] };

const executeAction = (id: string): Promise<ExecuteResult> =>
  apiFetch(`/api/actions/${encodeURIComponent(id)}/execute`, { method: 'POST' });

export const useExecuteAction = () => useMutation({
  mutationFn: executeAction,
  onSuccess: (result) => {
    if (result.warnings?.length) showToast(result.warnings.join(' · '), 'error');
  },
});

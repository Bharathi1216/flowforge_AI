import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FailureDetailPanel } from '../components/FailureDetailPanel';
import { aiService } from '../services/aiService';
import { logService } from '../services/logService';
import { FailureAnalysis, LogLine, WorkflowRun } from '../types';

vi.mock('../contexts/authState', () => ({ useAuth: () => ({ user: { id: 'alice' } }) }));
vi.mock('../contexts/toastState', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));
vi.mock('../contexts/assistantState', () => ({
  useAIAssistant: () => ({ openAssistant: vi.fn() }),
}));
vi.mock('../services/aiService', () => ({
  aiService: { analyzeFailure: vi.fn(), reanalyzeFailure: vi.fn() },
}));
vi.mock('../services/logService', () => ({ logService: { getWorkflowLogs: vi.fn() } }));

const run: WorkflowRun = {
  id: '1',
  name: 'CI',
  runNumber: 1,
  status: 'failed',
  branch: 'main',
  commitMessage: 'test',
};
const lines: LogLine[] = [
  { lineNumber: 1, timestamp: '', type: 'error', message: 'Missing widget' },
];
const analysis: FailureAnalysis = {
  id: 'analysis-1',
  runId: '1',
  title: 'Diagnosis',
  summary: 'Missing widget',
  rootCause: 'Widget is missing',
  suggestedFix: 'Install widget',
  relevantDocs: [],
  previousDiscussions: [],
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function view(client: QueryClient, selected: WorkflowRun) {
  return (
    <StrictMode>
      <QueryClientProvider client={client}>
        <FailureDetailPanel run={selected} repoId="500" onPushToThread={() => {}} />
      </QueryClientProvider>
    </StrictMode>
  );
}

describe('automatic diagnostics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(aiService.analyzeFailure).mockResolvedValue(analysis);
  });
  it('waits for logs and deduplicates Strict Mode requests', async () => {
    const logs = deferred<LogLine[]>();
    vi.mocked(logService.getWorkflowLogs).mockReturnValue(logs.promise);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const mounted = render(view(client, run));
    await waitFor(() => expect(logService.getWorkflowLogs).toHaveBeenCalledTimes(1));
    expect(aiService.analyzeFailure).not.toHaveBeenCalled();
    await act(async () => {
      logs.resolve(lines);
    });
    await waitFor(() => expect(aiService.analyzeFailure).toHaveBeenCalledTimes(1));
    await screen.findByText('Widget is missing');
    mounted.unmount();
    render(view(client, run));
    expect(aiService.analyzeFailure).toHaveBeenCalledTimes(1);
  });
  it('does not analyze empty logs', async () => {
    vi.mocked(logService.getWorkflowLogs).mockResolvedValue([]);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(view(client, run));
    await waitFor(() =>
      expect(client.getQueryState(['logs', 'alice', '500', '1', 1])?.status).toBe('success'),
    );
    expect(aiService.analyzeFailure).not.toHaveBeenCalled();
  });
  it('ignores a previous run response after selection changes', async () => {
    const oldLogs = deferred<LogLine[]>();
    vi.mocked(logService.getWorkflowLogs).mockImplementation((id) =>
      id === '1' ? oldLogs.promise : Promise.resolve(lines),
    );
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const mounted = render(view(client, run));
    mounted.rerender(view(client, { ...run, id: '2', runNumber: 2 }));
    await waitFor(() =>
      expect(aiService.analyzeFailure).toHaveBeenCalledWith('2', undefined, '500'),
    );
    await act(async () => {
      oldLogs.resolve(lines);
    });
    expect(aiService.analyzeFailure).toHaveBeenCalledTimes(1);
  });
  it('shows a real request error instead of inventing a diagnosis', async () => {
    vi.mocked(logService.getWorkflowLogs).mockRejectedValue(new Error('Unavailable'));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(view(client, run));
    await screen.findByText(
      'Unable to retrieve complete GitHub Actions logs. Retry when they are available.',
    );
    expect(aiService.analyzeFailure).not.toHaveBeenCalled();
  });
});

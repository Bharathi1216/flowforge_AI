import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { AddRepositoryModal } from '../components/AddRepositoryModal';
import { RepositoryWorkspace } from '../pages/RepositoryWorkspace';
import apiClient from '../services/apiClient';
import { repositoryService } from '../services/repositoryService';
import { Comment, Discussion } from '../types';

vi.mock('../contexts/authState', () => ({ useAuth: () => ({ user: { id: 'alice' } }) }));
vi.mock('../contexts/toastState', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));
vi.mock('../contexts/assistantState', () => ({
  useAIAssistant: () => ({ openAssistant: vi.fn() }),
}));
vi.mock('../components/ThreadView', () => ({
  ThreadView: (props: {
    discussions: Discussion[];
    comments: Comment[];
    onSelectDiscussion: (disc: Discussion) => void;
  }) => (
    <div>
      {props.discussions.map((disc) => (
        <button key={disc.id} onClick={() => props.onSelectDiscussion(disc)}>
          {disc.title}
        </button>
      ))}
      {props.comments.map((comment) => (
        <p key={comment.id}>{comment.content}</p>
      ))}
    </div>
  ),
}));
const repo = {
  id: '500',
  name: 'project',
  owner: 'alice',
  lastWorkflowStatus: 'success',
  lastUpdated: '',
  openDiscussionsCount: 0,
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
beforeEach(() => {
  repositoryService.clearCache();
  repositoryService.setAccount('alice');
  vi.restoreAllMocks();
});

it('keeps the selected discussion when an earlier request finishes late', async () => {
  const oldDetails = deferred<{ data: { comments: Array<{ id: string; content: string }> } }>();
  vi.spyOn(apiClient, 'get').mockImplementation(async (url) => {
    if (url === '/repositories/500') return { data: repo };
    if (url === '/repositories/500/workflows') return { data: [] };
    if (url === '/repositories/500/discussions')
      return {
        data: [
          { id: '1', title: 'First thread' },
          { id: '2', title: 'Second thread' },
        ],
      };
    if (url === '/repositories/500/discussions/1') return oldDetails.promise;
    if (url === '/repositories/500/discussions/2')
      return { data: { comments: [{ id: '2', content: 'Second reply' }] } };
    throw new Error(`Unexpected request ${url}`);
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/repositories/500/threads']}>
        <Routes>
          <Route path="/repositories/:repoId/:tab" element={<RepositoryWorkspace />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  fireEvent.click(await screen.findByText('Second thread'));
  await screen.findByText('Second reply');
  await act(async () => {
    oldDetails.resolve({ data: { comments: [{ id: '1', content: 'Old reply' }] } });
  });
  expect(screen.queryByText('Old reply')).not.toBeInTheDocument();
  expect(screen.getByText('Second reply')).toBeInTheDocument();
});

it('loads collaboration data only when its tab is opened', async () => {
  const get = vi.spyOn(apiClient, 'get').mockImplementation(async (url) => {
    if (url === '/repositories/500') return { data: repo };
    if (url === '/repositories/500/workflows') return { data: [] };
    throw new Error(`Unexpected eager request ${url}`);
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/repositories/500']}>
        <Routes>
          <Route path="/repositories/:repoId" element={<RepositoryWorkspace />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  await screen.findByRole('heading', { name: 'project' });
  expect(
    get.mock.calls.some(
      ([url]) => String(url).includes('discussions') || String(url).includes('collaborators'),
    ),
  ).toBe(false);
});

it('saves an explicitly empty repository selection', async () => {
  vi.spyOn(apiClient, 'get').mockResolvedValue({
    data: [repo, { ...repo, id: '501', owner: 'org' }],
  });
  const save = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <AddRepositoryModal
        isOpen
        connectedRepoIds={[]}
        onClose={() => {}}
        onSavePermissions={save}
      />
    </QueryClientProvider>,
  );
  fireEvent.click(await screen.findByRole('button', { name: /save/i }));
  await waitFor(() => expect(save).toHaveBeenCalledWith([]));
});

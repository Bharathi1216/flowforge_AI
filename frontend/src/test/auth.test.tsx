import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { AuthProvider } from '../contexts/AuthContext';
import { useAuth } from '../contexts/authState';
import { authService } from '../services/authService';
import { queryClient } from '../services/queryClient';
import { User } from '../types';

vi.mock('../services/authService', () => ({
  authService: { getCurrentUser: vi.fn(), logout: vi.fn() },
}));
vi.mock('../components/SessionExpiredModal', () => ({ SessionExpiredModal: () => null }));
function Probe() {
  const { user, logout, refreshUser } = useAuth();
  return (
    <>
      <p>{user?.username || 'guest'}</p>
      <button onClick={() => void logout()}>Logout</button>
      <button onClick={() => void refreshUser()}>Refresh user</button>
    </>
  );
}
const alice: User = {
  id: 'alice',
  username: 'alice',
  name: 'Alice',
  avatarUrl: '',
  email: '',
  githubUrl: '',
};
beforeEach(() => {
  vi.clearAllMocks();
  queryClient.clear();
  vi.mocked(authService.logout).mockResolvedValue(undefined);
});

it('ignores a delayed session probe after logout', async () => {
  let resolve!: (user: User) => void;
  vi.mocked(authService.getCurrentUser).mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );
  queryClient.setQueryData(['repositories', 'alice'], [{ id: 'private' }]);
  fireEvent.click(screen.getByText('Logout'));
  await act(async () => {
    resolve(alice);
  });
  expect(screen.getByText('guest')).toBeInTheDocument();
  expect(queryClient.getQueryData(['repositories', 'alice'])).toBeUndefined();
});

it('clears previous account data when the server session changes', async () => {
  vi.mocked(authService.getCurrentUser)
    .mockResolvedValueOnce(alice)
    .mockResolvedValueOnce({ ...alice, id: 'bob', username: 'bob' });
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );
  await screen.findByText('alice');
  queryClient.setQueryData(['repositories', 'alice'], [{ id: 'private' }]);
  fireEvent.click(screen.getByText('Refresh user'));
  await screen.findByText('bob');
  expect(queryClient.getQueryData(['repositories', 'alice'])).toBeUndefined();
});

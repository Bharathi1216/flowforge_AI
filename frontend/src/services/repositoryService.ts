import { Repository } from '../types';
import apiClient from './apiClient';
import { queryClient } from './queryClient';

let accountId: string | null = null;
const requireAccount = () => {
  if (!accountId) throw new Error('Sign in to load repositories.');
  return accountId;
};

export const repositoryService = {
  setAccount(id: string | null) {
    accountId = id;
  },
  queryOptions(userId: string) {
    return {
      queryKey: ['repositories', userId],
      queryFn: () => this.fetchRepositories(),
      staleTime: 60_000,
    };
  },
  async fetchRepositories(refresh = false): Promise<Repository[]> {
    requireAccount();
    return (
      await apiClient.get<Repository[]>('/repositories', {
        params: refresh ? { refresh: true } : undefined,
      })
    ).data;
  },
  async getRepositories(refresh = false): Promise<Repository[]> {
    const options = this.queryOptions(requireAccount());
    if (refresh)
      await queryClient.invalidateQueries({ queryKey: options.queryKey, refetchType: 'none' });
    return queryClient.fetchQuery({ ...options, queryFn: () => this.fetchRepositories(refresh) });
  },
  repositoryOptions(userId: string, repoId: string) {
    return {
      queryKey: ['repository', userId, repoId],
      queryFn: async () =>
        (await apiClient.get<Repository>(`/repositories/${encodeURIComponent(repoId)}`)).data,
    };
  },
  async getRepository(repoId: string): Promise<Repository | null> {
    return queryClient.fetchQuery(this.repositoryOptions(requireAccount(), repoId));
  },
  clearCache() {
    void queryClient.cancelQueries();
    queryClient.clear();
    accountId = null;
  },
};

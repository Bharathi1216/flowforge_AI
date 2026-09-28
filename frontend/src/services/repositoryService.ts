import { Repository } from '../types';
import apiClient from './apiClient';

let cachedRepositories: Repository[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60 * 1000; // 60 seconds

export const repositoryService = {
  async getRepositories(refresh = false): Promise<Repository[]> {
    const now = Date.now();
    if (!refresh && cachedRepositories && now - cacheTimestamp < CACHE_TTL_MS) {
      return cachedRepositories;
    }

    const response = await apiClient.get<Repository[]>('/repositories', {
      params: refresh ? { refresh: true } : undefined,
    });
    cachedRepositories = response.data;
    cacheTimestamp = now;
    return response.data;
  },

  async getRepository(repoId: string): Promise<Repository | null> {
    // 1. Fast path: check in-memory cache if available
    if (cachedRepositories) {
      const match = cachedRepositories.find(
        (repo) => repo.id === repoId || repo.name === repoId
      );
      if (match) return match;
    }

    // 2. Fetch specific repository directly
    try {
      const response = await apiClient.get<Repository>(`/repositories/${encodeURIComponent(repoId)}`);
      return response.data;
    } catch {
      // Fallback to full list if individual lookup fails
      const repositories = await this.getRepositories();
      return repositories.find((repo) => repo.id === repoId || repo.name === repoId) || null;
    }
  },

  clearCache() {
    cachedRepositories = null;
    cacheTimestamp = 0;
  },
};


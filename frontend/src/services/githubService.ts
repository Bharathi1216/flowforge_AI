import { githubApiService } from './githubApiService';

export interface GithubRepo {
  name: string;
  owner: string;
  isPrivate: boolean;
  description: string;
  language: string;
  added: boolean;
}

export const githubService = {
  async getGithubRepositories(): Promise<GithubRepo[]> {
    const repos = await githubApiService.fetchRepositories();
    const selected = githubApiService.getSelectedRepoNames();
    
    return repos.map(r => ({
      name: r.name,
      owner: r.owner,
      isPrivate: r.isPrivate,
      description: r.description || '',
      language: r.language || '',
      added: selected.length === 0 ? true : selected.includes(r.name),
    }));
  },

  async connectGithubAccount(): Promise<void> {
    // Handled via AuthContext
  },

  async disconnectGithubAccount(): Promise<void> {
    githubApiService.logout();
  },

  async addRepositoryAccess(owner: string, name: string): Promise<void> {
    const selected = githubApiService.getSelectedRepoNames();
    if (!selected.includes(name)) {
      selected.push(name);
      githubApiService.saveSelectedRepoNames(selected);
    }
  }
};

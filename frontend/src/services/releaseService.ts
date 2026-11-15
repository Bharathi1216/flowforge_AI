import { Release } from '../types';
export const releaseService = {
  async getReleases(_repoId: string): Promise<Release[]> {
    throw new Error('Release history is not available yet. View releases on GitHub.');
  },
  async generateChangelog(_repoId: string, _fromTag: string, _toTag: string): Promise<never> {
    throw new Error('Changelog generation is not available yet.');
  },
};

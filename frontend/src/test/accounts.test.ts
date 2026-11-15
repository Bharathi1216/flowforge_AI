import { beforeEach, describe, expect, it, vi } from 'vitest';
import apiClient from '../services/apiClient';
import { readSelection, saveSelection } from '../services/preferences';
import { queryClient } from '../services/queryClient';
import { repositoryService } from '../services/repositoryService';

describe('account data', () => {
  beforeEach(() => {
    repositoryService.clearCache();
    vi.restoreAllMocks();
  });
  it('distinguishes default selection from explicitly selecting none', () => {
    expect(readSelection('alice')).toBeNull();
    saveSelection('alice', []);
    expect(readSelection('alice')).toEqual([]);
    expect(readSelection('bob')).toBeNull();
  });
  it('rejects malformed browser preferences', () => {
    for (const value of ['bad json', '{}', '[1]', '"all"']) {
      localStorage.setItem('flowforge-repositories:alice', value);
      expect(readSelection('alice')).toBeNull();
    }
  });
  it('works when browser storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('Denied');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Denied');
    });
    expect(readSelection('alice')).toBeNull();
    expect(() => saveSelection('alice', ['500'])).not.toThrow();
  });
  it('does not serve a previous account cache after switching', async () => {
    const get = vi.spyOn(apiClient, 'get');
    get.mockResolvedValueOnce({ data: [{ id: '500', name: 'private-alice' }] });
    repositoryService.setAccount('alice');
    await repositoryService.getRepositories();
    repositoryService.clearCache();
    expect(queryClient.getQueryData(['repositories', 'alice'])).toBeUndefined();
    get.mockResolvedValueOnce({ data: [{ id: '600', name: 'private-bob' }] });
    repositoryService.setAccount('bob');
    expect(await repositoryService.getRepositories()).toEqual([{ id: '600', name: 'private-bob' }]);
    expect(get).toHaveBeenCalledTimes(2);
  });
  it('deduplicates concurrent repository reads', async () => {
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue({ data: [] });
    repositoryService.setAccount('alice');
    await Promise.all([repositoryService.getRepositories(), repositoryService.getRepositories()]);
    expect(get).toHaveBeenCalledTimes(1);
  });
});

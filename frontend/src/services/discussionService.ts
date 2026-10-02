import { Discussion, Comment } from '../types';
import apiClient from './apiClient';

export const discussionService = {
  async getDiscussions(repoId: string): Promise<Discussion[]> {
    const response = await apiClient.get<Discussion[]>(`/repositories/${encodeURIComponent(repoId)}/discussions`);
    return response.data;
  },

  async getDiscussion(repoId: string, discussionId: string): Promise<{ discussion: Discussion; comments: Comment[] }> {
    const response = await apiClient.get<{ discussion: Discussion; comments: Comment[] }>(
      `/repositories/${encodeURIComponent(repoId)}/discussions/${encodeURIComponent(discussionId)}`
    );
    return response.data;
  },

  async createDiscussion(repoId: string, runId: string | undefined, title: string, content: string): Promise<Discussion> {
    const response = await apiClient.post<Discussion>(
      `/repositories/${encodeURIComponent(repoId)}/discussions`,
      { title, content, run_id: runId }
    );
    return response.data;
  },

  async addComment(repoId: string, discussionId: string, content: string): Promise<Comment> {
    const response = await apiClient.post<Comment>(
      `/repositories/${encodeURIComponent(repoId)}/discussions/${encodeURIComponent(discussionId)}/comments`,
      { content }
    );
    return response.data;
  },

  async resolveDiscussion(repoId: string, discId: string, status: 'resolved' | 'open' = 'resolved'): Promise<Discussion> {
    const response = await apiClient.patch<Discussion>(
      `/repositories/${encodeURIComponent(repoId)}/discussions/${encodeURIComponent(discId)}`,
      { status }
    );
    return response.data;
  }
};

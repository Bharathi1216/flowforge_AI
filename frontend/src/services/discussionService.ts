import apiClient, { USE_MOCK_DATA } from './apiClient';
import { Discussion, Comment } from '../types';
import { mockDiscussions, mockComments, mockCurrentUser } from '../mock/data';

export const discussionService = {
  async getDiscussions(repoId: string): Promise<Discussion[]> {
    if (USE_MOCK_DATA) {
      const key = repoId.toLowerCase().includes('flowforge') ? 'repo-1' : repoId;
      return Promise.resolve(mockDiscussions[key] || []);
    }
    const response = await apiClient.get(`/repositories/${repoId}/discussions`);
    return response.data;
  },

  async getDiscussion(discId: string): Promise<{ discussion: Discussion; comments: Comment[] } | null> {
    if (USE_MOCK_DATA) {
      let discussion: Discussion | undefined;
      for (const key of Object.keys(mockDiscussions)) {
        discussion = mockDiscussions[key].find(d => d.id === discId);
        if (discussion) break;
      }
      if (!discussion) return Promise.resolve(null);
      const comments = mockComments[discId] || [];
      return Promise.resolve({ discussion, comments });
    }
    const response = await apiClient.get(`/discussions/${discId}`);
    return response.data;
  },

  async createDiscussion(repoId: string, runId: string | undefined, title: string, content: string): Promise<Discussion> {
    if (USE_MOCK_DATA) {
      const key = repoId.toLowerCase().includes('flowforge') ? 'repo-1' : repoId;
      const newDiscussion: Discussion = {
        id: `disc-${Date.now()}`,
        repoId: key,
        runId,
        runNumber: runId ? 184 : undefined,
        title,
        author: mockCurrentUser,
        status: 'open',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        participants: [mockCurrentUser],
        commentsCount: 1
      };
      
      if (!mockDiscussions[key]) mockDiscussions[key] = [];
      mockDiscussions[key].unshift(newDiscussion);

      const firstComment: Comment = {
        id: `c-${Date.now()}`,
        discussionId: newDiscussion.id,
        author: mockCurrentUser,
        content,
        createdAt: new Date().toISOString()
      };
      mockComments[newDiscussion.id] = [firstComment];

      return Promise.resolve(newDiscussion);
    }
    const response = await apiClient.post(`/repositories/${repoId}/discussions`, { runId, title, content });
    return response.data;
  },

  async addComment(discId: string, content: string, logExcerpt?: string): Promise<Comment> {
    if (USE_MOCK_DATA) {
      const newComment: Comment = {
        id: `c-${Date.now()}`,
        discussionId: discId,
        author: mockCurrentUser,
        content,
        createdAt: new Date().toISOString(),
        logExcerpt
      };

      if (!mockComments[discId]) mockComments[discId] = [];
      mockComments[discId].push(newComment);

      // Update comment count
      for (const key of Object.keys(mockDiscussions)) {
        const disc = mockDiscussions[key].find(d => d.id === discId);
        if (disc) {
          disc.commentsCount = mockComments[discId].length;
          disc.updatedAt = new Date().toISOString();
        }
      }

      return Promise.resolve(newComment);
    }
    const response = await apiClient.post(`/discussions/${discId}/comments`, { content, logExcerpt });
    return response.data;
  },

  async resolveDiscussion(discId: string): Promise<void> {
    if (USE_MOCK_DATA) {
      for (const key of Object.keys(mockDiscussions)) {
        const disc = mockDiscussions[key].find(d => d.id === discId);
        if (disc) {
          disc.status = 'resolved';
          disc.updatedAt = new Date().toISOString();
        }
      }
      return Promise.resolve();
    }
    await apiClient.post(`/discussions/${discId}/resolve`);
  }
};

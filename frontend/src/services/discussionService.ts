import { Discussion, Comment } from '../types';
import { githubApiService } from './githubApiService';

export const discussionService = {
  async getDiscussions(repoId: string): Promise<Discussion[]> {
    const owner = githubApiService.getSavedUsername() || 'user';
    return githubApiService.fetchDiscussions(owner, repoId);
  },

  async getDiscussion(discId: string, repoOwner?: string, repoName?: string): Promise<{ discussion: Discussion; comments: Comment[] } | null> {
    const owner = repoOwner || githubApiService.getSavedUsername() || 'user';
    const name = repoName || 'repo';
    const discussions = await githubApiService.fetchDiscussions(owner, name);
    const disc = discussions.find(d => d.id === discId);
    if (!disc) return null;

    const comments = await githubApiService.fetchComments(owner, name, discId);
    return { discussion: disc, comments };
  },

  async createDiscussion(repoId: string, runId: string | undefined, title: string, content: string): Promise<Discussion> {
    const owner = githubApiService.getSavedUsername() || 'user';
    const name = repoId;
    void runId;
    return githubApiService.createDiscussion(owner, name, title, content);
  },

  async addComment(discId: string, content: string, repoOwner?: string, repoName?: string, logExcerpt?: string): Promise<Comment> {
    const owner = repoOwner || githubApiService.getSavedUsername() || 'user';
    const name = repoName || 'repo';
    
    try {
      const liveComment = await githubApiService.createComment(owner, name, discId, content);
      if (liveComment) return liveComment;
    } catch (error) {
      throw error;
    }
    throw new Error('Comment was not created because GitHub did not return a comment.');
  },

  async resolveDiscussion(discId: string): Promise<void> {
    void discId;
    throw new Error('Resolving a discussion is not available until the GitHub issue update endpoint is connected.');
  }
};

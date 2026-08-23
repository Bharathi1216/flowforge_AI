export interface User {
  id: string;
  username: string;
  name: string;
  avatarUrl: string;
  email: string;
  githubUrl: string;
}

export type RepositoryRole = 'owner' | 'maintainer' | 'developer' | 'contributor' | 'viewer';
export type WorkflowStatus = 'success' | 'failed' | 'running' | 'warning';

export interface Repository {
  id: string;
  name: string;
  owner: string;
  description: string;
  language: string;
  isPrivate: boolean;
  lastWorkflowStatus: WorkflowStatus;
  lastUpdated: string;
  contributorCount: number;
  openDiscussionsCount: number;
  failureCount: number;
  healthScore: number;
  successRate: number;
  userAccessRole: RepositoryRole;
}

export interface Collaborator {
  id: string;
  username: string;
  name: string;
  avatarUrl: string;
  role: 'owner' | 'maintainer' | 'developer' | 'contributor';
  lastActivity: string;
  issuesResolved: number;
  failuresFixed: number;
}

export interface Workflow {
  id: string;
  name: string;
  path: string;
  status: 'active' | 'inactive';
}

export interface WorkflowRun {
  id: string;
  workflowId: string;
  name: string;
  runNumber: number;
  status: WorkflowStatus;
  event: string;
  triggeredBy: User;
  branch: string;
  commitSha: string;
  commitMessage: string;
  durationSeconds: number;
  startedAt: string;
  completedAt?: string;
  failureSummary?: string;
  logsAnalysed?: boolean;
}

export interface LogLine {
  lineNumber: number;
  timestamp: string;
  type: 'info' | 'warn' | 'error';
  message: string;
  section?: string;
}

export interface FailureAnalysis {
  id: string;
  runId: string;
  title: string;
  summary: string;
  rootCause: string;
  suggestedFix: string;
  similarPreviousRunId?: string;
  similarPreviousRunNumber?: number;
  confidence: number; // e.g. 92 for 92%
  relevantDocs: { title: string; url: string }[];
  previousDiscussions: { id: string; title: string }[];
}

export interface Discussion {
  id: string;
  repoId: string;
  runId?: string;
  runNumber?: number;
  title: string;
  author: User;
  status: 'open' | 'resolved';
  createdAt: string;
  updatedAt: string;
  participants: User[];
  commentsCount: number;
}

export interface Comment {
  id: string;
  discussionId: string;
  author: User;
  content: string;
  createdAt: string;
  isAISuggestion?: boolean;
  logExcerpt?: string;
}

export interface KnowledgeItem {
  id: string;
  repoId: string;
  errorType: string;
  occurrences: number;
  lastResolvedAt: string;
  suggestedFix: string;
  similarRunId?: string;
  similarRunNumber?: number;
  category: 'failure' | 'docs' | 'discussion';
}

export interface Notification {
  id: string;
  type: 'failure' | 'mention' | 'assignment' | 'resolution' | 'system';
  title: string;
  message: string;
  repoId: string;
  repoName: string;
  runId?: string;
  discussionId?: string;
  isRead: boolean;
  createdAt: string;
}

export interface Release {
  id: string;
  repoId: string;
  version: string;
  name: string;
  tagName: string;
  publishedAt: string;
  prCount: number;
  commitCount: number;
  author: User;
  aiSummary?: {
    features: string[];
    fixes: string[];
    breaking: string[];
    changes: string[];
  };
}

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  sources?: string[]; // e.g. ["Workflow #184", "README.md"]
}

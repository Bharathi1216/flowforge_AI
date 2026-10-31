export interface User {
  id: string;
  username: string;
  name: string;
  avatarUrl: string;
  email: string;
  githubUrl: string;
}

export type RepositoryRole = 'owner' | 'maintainer' | 'developer' | 'contributor' | 'viewer';
export type WorkflowStatus = 'success' | 'failed' | 'running' | 'warning' | 'unknown';

export interface Repository {
  id: string;
  name: string;
  owner: string;
  description: string | null;
  language: string | null;
  isPrivate: boolean;
  lastWorkflowStatus: WorkflowStatus;
  lastUpdated: string;
  contributorCount: number;
  openDiscussionsCount: number;
  failureCount: number;
  successRate: number | null;
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
  permissions?: Record<string, boolean>;
}

export interface Workflow {
  id: string;
  name: string;
  path: string;
  status: 'active' | 'inactive';
}

export interface WorkflowStep {
  name: string;
  status: 'success' | 'failed' | 'skipped' | 'running';
  duration: string;
}

export interface DiagnosticInfo {
  errorType?: string;
  frequency?: number;
  errorSnippet?: string;
  aiExplanation?: string;
  rootCause?: string;
  suggestedFix?: string;
}

export interface WorkflowRun {
  id: string;
  workflowId?: string;
  repoId?: string;
  name: string;
  runNumber: number;
  status: WorkflowStatus;
  event?: string;
  triggeredBy?: User;
  branch: string;
  commitSha?: string;
  commitMessage: string;
  durationSeconds?: number;
  duration?: string;
  startedAt?: string;
  timestamp?: string;
  completedAt?: string;
  failureSummary?: string;
  logsAnalysed?: boolean;
  steps?: WorkflowStep[];
  diagnosticInfo?: DiagnosticInfo;
}

export interface LogLine {
  lineNumber: number;
  timestamp: string;
  type: 'info' | 'warn' | 'error';
  message: string;
  section?: string;
}

export interface LogAnalysisBlock {
  error_logs?: number[][];
  errorLogs?: number[][];
  analysis: string;
}

export interface ImportantLogBlock {
  start_line?: number;
  startLine?: number;
  end_line?: number;
  endLine?: number;
  lines?: { line_number?: number; lineNumber?: number; text: string; is_candidate?: boolean; isCandidate?: boolean }[];
  text?: string;
  importance_score?: number;
  importanceScore?: number;
  reasons?: string[];
}

export interface FailureAnalysis {
  id: string;
  runId: string;
  title: string;
  summary: string;
  rootCause: string;
  suggestedFix: string;
  confidence?: number;
  evidence?: string[];
  evidenceGraph?: EvidenceGraphSummary;
  logAnalysis?: LogAnalysisBlock[];
  importantLogBlocks?: ImportantLogBlock[];
  failureFingerprint?: string;
  analysisStatus?: 'completed' | 'fallback' | 'failed' | 'pending';
  rawLogs?: string;
  similarPreviousRunId?: string;
  similarPreviousRunNumber?: number;
  similarMatchPercent?: number;
  relevantDocs: { title: string; url: string }[];
  previousDiscussions: { id: string; title: string }[];
  providers?: {
    gemini?: ProviderAnalysis;
    groq?: ProviderAnalysis;
  };
}

export interface EvidenceGraphEvent {
  event_id: string;
  category: string;
  component: string;
  severity: string;
  line_start: number;
  line_end: number;
  workflow_step?: string | null;
  original_message: string;
  identifiers: string[];
}

export interface EvidenceGraphEdge {
  source_node_id: string;
  target_node_id: string;
  relationship_type: string;
  supporting_evidence: string;
  relationship_confidence: number;
}

export interface EvidenceGraphCandidate {
  event_id: string;
  rank: number;
  score: number;
  reasons: string[];
  score_interpretation: string;
}

export interface EvidenceGraphSummary {
  version: string;
  nodes: EvidenceGraphEvent[];
  edges: EvidenceGraphEdge[];
  root_cause_candidates: EvidenceGraphCandidate[];
  insufficient_evidence: boolean;
  line_count: number;
}

export interface ProviderAnalysis {
  provider: string;
  status: 'completed' | 'fallback' | 'failed' | 'unavailable' | 'pending';
  model?: string;
  summary: string;
  rootCause: string;
  suggestedFix: string;
  confidence?: number;
  evidence?: string[];
  logAnalysis?: LogAnalysisBlock[];
  error?: string;
}

export interface Discussion {
  id: string;
  repoId: string;
  runId?: string;
  workflowRunId?: string;
  runNumber?: number;
  title: string;
  content?: string;
  author: User;
  status?: 'open' | 'resolved';
  isPinned?: boolean;
  createdAt?: string;
  updatedAt?: string;
  timestamp?: string;
  participants: User[];
  commentsCount: number;
}

export interface Comment {
  id: string;
  discussionId: string;
  author: User;
  content: string;
  createdAt?: string;
  timestamp?: string;
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
  sources?: string[];
}

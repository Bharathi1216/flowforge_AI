import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { 
  GitBranch, Terminal, MessageSquare, Users, BookOpen, Brain, 
  Tag, RefreshCw, Globe, Shield, ExternalLink, HelpCircle, Send, Plus, GitMerge, FileText, CheckCircle2, XCircle, AlertTriangle 
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { repositoryService } from '../services/repositoryService';
import { workflowService } from '../services/workflowService';
import { discussionService } from '../services/discussionService';
import { teamService } from '../services/teamService';
import { knowledgeService } from '../services/knowledgeService';
import { releaseService } from '../services/releaseService';
import { aiService } from '../services/aiService';
import { Repository, WorkflowRun, Discussion, Collaborator, KnowledgeItem, Release, AIMessage, Comment } from '../types';
import { TerminalLogs } from '../components/TerminalLogs';
import { mockLogs } from '../mock/data';

export const RepositoryWorkspace: React.FC = () => {
  const { repoId, workflowId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [repo, setRepo] = useState<Repository | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  // Sub-data states
  const [workflowRuns, setWorkflowRuns] = useState<WorkflowRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<WorkflowRun | null>(null);
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [selectedDisc, setSelectedDisc] = useState<Discussion | null>(null);
  const [discComments, setDiscComments] = useState<Comment[]>([]);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [knowledgeBase, setKnowledgeBase] = useState<KnowledgeItem[]>([]);
  const [releases, setReleases] = useState<Release[]>([]);
  
  // Custom interactive actions
  const [isRegeneratingSummary, setIsRegeneratingSummary] = useState(false);
  const [isOnboardingGenerating, setIsOnboardingGenerating] = useState(false);
  const [onboardingGuide, setOnboardingGuide] = useState<any>(null);
  const [newDiscussionTitle, setNewDiscussionTitle] = useState('');
  const [newDiscussionContent, setNewDiscussionContent] = useState('');
  const [isNewDiscussionOpen, setIsNewDiscussionOpen] = useState(false);
  const [newCommentText, setNewCommentText] = useState('');
  
  // Release summaries state
  const [releaseSummaryGenerating, setReleaseSummaryGenerating] = useState<string | null>(null);

  // AI assistant chat state
  const [assistantMessages, setAssistantMessages] = useState<AIMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Hello Bharathi! I am the FlowForge AI assistant. Ask me questions about repository codebase structure, latest build failures, or who has solved similar peer dependency blocks.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatTyping, setIsChatTyping] = useState(false);

  // Synchronize Tab from URL route
  useEffect(() => {
    const segments = location.pathname.split('/');
    const lastSegment = segments[segments.length - 1];
    
    const validTabs = ['overview', 'workflows', 'logs', 'discussions', 'team', 'knowledge', 'assistant', 'releases'];
    if (validTabs.includes(lastSegment)) {
      setActiveTab(lastSegment);
    } else if (segments.includes('workflows')) {
      setActiveTab('workflows');
    }
  }, [location.pathname]);

  // Fetch Repository details and sub-resources
  useEffect(() => {
    const fetchRepoDetails = async () => {
      if (!repoId) return;
      setLoading(true);
      try {
        const repoData = await repositoryService.getRepository(repoId);
        setRepo(repoData);

        if (repoData) {
          // Fetch runs
          const runs = await workflowService.getWorkflowRuns(repoData.id);
          setWorkflowRuns(runs);

          // Auto-select run if workflowId param is present
          if (workflowId) {
            const r = runs.find(run => run.id === workflowId);
            if (r) setSelectedRun(r);
          } else {
            // Auto-select latest run if it failed
            const latest = runs[0];
            if (latest) setSelectedRun(latest);
          }

          // Fetch discussions
          const discList = await discussionService.getDiscussions(repoData.id);
          setDiscussions(discList);
          if (discList.length > 0) {
            handleSelectDiscussion(discList[0]);
          }

          // Fetch collaborators
          const members = await teamService.getMembers(repoData.id);
          setCollaborators(members);

          // Fetch knowledge
          const kb = await knowledgeService.getKnowledgeBase(repoData.id);
          setKnowledgeBase(kb);

          // Fetch releases
          const rels = await releaseService.getReleases(repoData.id);
          setReleases(rels);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchRepoDetails();
  }, [repoId, workflowId]);

  const handleTabChange = (tabName: string) => {
    setActiveTab(tabName);
    navigate(`/repositories/${repoId}/${tabName}`);
  };

  const handleSelectDiscussion = async (disc: Discussion) => {
    setSelectedDisc(disc);
    try {
      const details = await discussionService.getDiscussion(disc.id);
      if (details) {
        setDiscComments(details.comments);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateDiscussion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repo || !newDiscussionTitle.trim() || !newDiscussionContent.trim()) return;

    try {
      const newDisc = await discussionService.createDiscussion(
        repo.id,
        selectedRun?.id,
        newDiscussionTitle,
        newDiscussionContent
      );
      
      // Refresh list
      const discList = await discussionService.getDiscussions(repo.id);
      setDiscussions(discList);
      handleSelectDiscussion(newDisc);
      
      setIsNewDiscussionOpen(false);
      setNewDiscussionTitle('');
      setNewDiscussionContent('');
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDisc || !newCommentText.trim()) return;

    try {
      const comment = await discussionService.addComment(selectedDisc.id, newCommentText);
      setDiscComments(prev => [...prev, comment]);
      setNewCommentText('');

      // Refresh comment count in list
      if (repo) {
        const discList = await discussionService.getDiscussions(repo.id);
        setDiscussions(discList);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleResolveDiscussion = async () => {
    if (!selectedDisc) return;
    try {
      await discussionService.resolveDiscussion(selectedDisc.id);
      setSelectedDisc(prev => prev ? { ...prev, status: 'resolved' } : null);
      if (repo) {
        const discList = await discussionService.getDiscussions(repo.id);
        setDiscussions(discList);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRetryRun = async (runId: string) => {
    try {
      await workflowService.retryWorkflow(runId);
      // Reload runs
      if (repo) {
        const runs = await workflowService.getWorkflowRuns(repo.id);
        setWorkflowRuns(runs);
        const updated = runs.find(r => r.id === runId);
        if (updated) setSelectedRun(updated);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRegenerateSummary = async () => {
    if (!repo) return;
    setIsRegeneratingSummary(true);
    try {
      const newSummary = await repositoryService.regenerateRepositorySummary(repo.id);
      setRepo(prev => prev ? { ...prev, description: newSummary } : null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsRegeneratingSummary(false);
    }
  };

  const handleGenerateOnboarding = async () => {
    if (!repo) return;
    setIsOnboardingGenerating(true);
    try {
      const guide = await aiService.generateOnboardingGuide(repo.id);
      setOnboardingGuide(guide);
    } catch (err) {
      console.error(err);
    } finally {
      setIsOnboardingGenerating(false);
    }
  };

  const handleGenerateReleaseSummary = async (releaseId: string) => {
    if (!repo) return;
    setReleaseSummaryGenerating(releaseId);
    try {
      const summary = await releaseService.generateReleaseSummary(repo.id, releaseId);
      setReleases(prev => prev.map(r => r.id === releaseId ? { ...r, aiSummary: summary } : r));
    } catch (err) {
      console.error(err);
    } finally {
      setReleaseSummaryGenerating(null);
    }
  };

  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !repo) return;

    const userMsg: AIMessage = {
      id: `usr-${Date.now()}`,
      role: 'user',
      content: chatInput,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setAssistantMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setIsChatTyping(true);

    try {
      const response = await aiService.chatWithAssistant(repo.id, [...assistantMessages, userMsg]);
      setAssistantMessages(prev => [...prev, response]);
    } catch (err) {
      console.error(err);
    } finally {
      setIsChatTyping(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <span className="rounded bg-emerald-50 text-emerald-700 px-2 py-0.5 text-[10px] font-bold dark:bg-emerald-950/30 dark:text-emerald-400">SUCCESS</span>;
      case 'failed':
        return <span className="rounded bg-rose-50 text-rose-700 px-2 py-0.5 text-[10px] font-bold dark:bg-rose-950/30 dark:text-rose-400">FAILED</span>;
      case 'running':
        return <span className="rounded bg-blue-50 text-blue-700 px-2 py-0.5 text-[10px] font-bold dark:bg-blue-950/30 dark:text-blue-400 animate-pulse">RUNNING</span>;
      case 'warning':
        return <span className="rounded bg-amber-50 text-amber-700 px-2 py-0.5 text-[10px] font-bold dark:bg-amber-950/30 dark:text-amber-400">WARNING</span>;
      default:
        return null;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
      case 'failed': return <XCircle className="h-5 w-5 text-rose-500" />;
      case 'warning': return <AlertTriangle className="h-5 w-5 text-amber-500" />;
      default: return <RefreshCw className="h-5 w-5 text-blue-500 animate-spin" />;
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <RefreshCw className="h-8 w-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!repo) {
    return (
      <div className="text-center p-12 space-y-4">
        <XCircle className="h-12 w-12 text-rose-500 mx-auto" />
        <h2 className="text-lg font-bold">Access restricted</h2>
        <p className="text-sm text-slate-400 max-w-sm mx-auto">Your GitHub account does not have permission to view this repository workspace.</p>
        <button onClick={() => navigate('/repositories')} className="rounded-lg bg-primary px-4 py-2 text-xs font-bold text-white">Back to Repositories</button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-6">
      
      {/* Workspace Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-semibold">{repo.owner}</span>
            <span className="text-slate-300 dark:text-slate-700">/</span>
            <h1 className="text-xl font-extrabold text-slate-950 dark:text-white">{repo.name}</h1>
            <span className="rounded border border-slate-200 px-1.5 py-0.5 text-[9px] font-extrabold text-slate-500 dark:border-slate-800 uppercase tracking-wide">
              {repo.isPrivate ? 'Private' : 'Public'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 dark:text-slate-400 max-w-2xl">{repo.description}</p>
        </div>

        <div className="flex items-center gap-3">
          <a
            href={`https://github.com/${repo.owner}/${repo.name}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-bold hover:bg-slate-50 dark:border-slate-850 dark:bg-slate-950 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300"
          >
            <span>GitHub</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
          <button
            onClick={() => navigate('/settings')}
            className="rounded-lg border border-slate-200 bg-white p-2 hover:bg-slate-50 dark:border-slate-850 dark:bg-slate-950 dark:hover:bg-slate-900 text-slate-600 dark:text-slate-400"
          >
            <Shield className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 overflow-x-auto scrollbar-terminal">
        {[
          { id: 'overview', name: 'Overview', icon: Globe },
          { id: 'workflows', name: 'Workflows', icon: GitBranch },
          { id: 'logs', name: 'Logs', icon: Terminal },
          { id: 'discussions', name: 'Discussions', icon: MessageSquare },
          { id: 'team', name: 'Team', icon: Users },
          { id: 'knowledge', name: 'Knowledge', icon: BookOpen },
          { id: 'assistant', name: 'AI Assistant', icon: Brain },
          { id: 'releases', name: 'Releases', icon: Tag }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-semibold whitespace-nowrap transition-colors ${
                isActive
                  ? 'border-primary text-primary dark:text-primary-hover'
                  : 'border-transparent text-slate-400 hover:border-slate-200 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.name}
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      <div className="pt-2">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
          >
            
            {/* Overview View */}
            {activeTab === 'overview' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-8 space-y-6">
                  {/* Summary Card */}
                  <div className="card-main space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-slate-950 dark:text-white">AI Summary</h3>
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-primary/10 px-2 py-0.5 text-[9px] font-extrabold text-primary dark:bg-primary/20">AI Generated</span>
                        <button
                          onClick={handleRegenerateSummary}
                          disabled={isRegeneratingSummary}
                          className="text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-semibold"
                        >
                          {isRegeneratingSummary ? 'Regenerating...' : 'Regenerate'}
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed bg-slate-50 dark:bg-slate-950/40 p-4 rounded-xl border border-slate-200/60 dark:border-slate-850">
                      {isRegeneratingSummary ? 'Regenerating repository summary...' : repo.description}
                    </p>
                  </div>

                  {/* Onboarding Guide builder */}
                  <div className="card-main space-y-4">
                    <div>
                      <h3 className="text-sm font-bold text-slate-950 dark:text-white">New to this repository?</h3>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Generate a complete onboarding architecture layout dynamically.</p>
                    </div>

                    {!onboardingGuide && !isOnboardingGenerating && (
                      <button
                        onClick={handleGenerateOnboarding}
                        className="rounded-lg bg-primary/10 border border-primary/20 hover:bg-primary/20 text-primary dark:bg-primary/20 px-4 py-2.5 text-xs font-bold transition-all"
                      >
                        Generate Onboarding Guide
                      </button>
                    )}

                    {isOnboardingGenerating && (
                      <div className="rounded-xl border border-dashed border-primary/30 p-8 text-center animate-pulse space-y-3">
                        <Brain className="h-6 w-6 text-primary mx-auto animate-spin" />
                        <span className="text-xs font-bold block">Generating Onboarding Guide...</span>
                        <div className="w-24 mx-auto"><div className="dot-typing" /></div>
                      </div>
                    )}

                    {onboardingGuide && !isOnboardingGenerating && (
                      <div className="space-y-4 rounded-xl border border-slate-250 bg-slate-50/20 p-5 dark:border-slate-800 dark:bg-slate-900/10">
                        <h4 className="text-xs font-bold text-slate-950 dark:text-white uppercase tracking-wider">{onboardingGuide.title}</h4>
                        
                        <div className="space-y-3.5 text-xs">
                          <div>
                            <span className="font-bold text-slate-700 dark:text-slate-300">Project Overview:</span>
                            <p className="text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{onboardingGuide.overview}</p>
                          </div>
                          <div>
                            <span className="font-bold text-slate-700 dark:text-slate-300">Architecture & Stack:</span>
                            <p className="text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{onboardingGuide.architecture}</p>
                          </div>
                          <div>
                            <span className="font-bold text-slate-700 dark:text-slate-300">Important Modules:</span>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                              {onboardingGuide.importantModules.map((m: any, i: number) => (
                                <div key={i} className="rounded-lg border border-slate-200 bg-white p-2.5 dark:border-slate-800 dark:bg-slate-950">
                                  <code className="text-[11px] font-bold text-primary">{m.name}</code>
                                  <p className="text-[10px] text-slate-450 mt-0.5">{m.description}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div>
                            <span className="font-bold text-slate-700 dark:text-slate-300">Common Problems & Fixes:</span>
                            <ul className="list-disc pl-4 mt-1.5 space-y-1 text-slate-500 dark:text-slate-400">
                              {onboardingGuide.commonProblems.map((p: any, i: number) => (
                                <li key={i}><b className="text-slate-750 dark:text-slate-300">{p.issue}</b>: {p.fix}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="lg:col-span-4 space-y-6">
                  {/* Health Widget */}
                  <div className="card-main text-center space-y-4">
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Health Score</span>
                    <div className="relative flex items-center justify-center">
                      {/* Premium Circle dial visual */}
                      <svg className="w-32 h-32 transform -rotate-90">
                        <circle cx="64" cy="64" r="54" strokeWidth="8" stroke="currentColor" fill="transparent" className="text-slate-100 dark:text-slate-800" />
                        <circle cx="64" cy="64" r="54" strokeWidth="8" stroke="currentColor" fill="transparent" strokeDasharray={339} strokeDashoffset={339 - (339 * repo.healthScore) / 100} className="text-primary" />
                      </svg>
                      <div className="absolute text-xl font-extrabold text-slate-950 dark:text-white">{repo.healthScore}%</div>
                    </div>
                    <div className="flex justify-around border-t border-slate-200/60 pt-3.5 dark:border-slate-800/40 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400">Success Rate</span>
                        <div className="font-bold text-slate-950 dark:text-white mt-0.5">{repo.successRate}%</div>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400">Contributors</span>
                        <div className="font-bold text-slate-950 dark:text-white mt-0.5">{repo.contributorCount}</div>
                      </div>
                    </div>
                  </div>

                  {/* Team Preview */}
                  <div className="card-main space-y-4">
                    <h3 className="text-xs font-bold text-slate-950 dark:text-white uppercase tracking-wider">Active Collaborators</h3>
                    <div className="space-y-3">
                      {collaborators.slice(0, 3).map(c => (
                        <div key={c.id} className="flex items-center gap-3">
                          <img src={c.avatarUrl} alt="" className="h-7 w-7 rounded-full object-cover" />
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-bold truncate text-slate-950 dark:text-white">{c.name}</div>
                            <span className="text-[10px] text-slate-400 truncate block">@{c.username}</span>
                          </div>
                          <span className="text-[9px] font-bold text-slate-500">{c.role}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Workflows View */}
            {activeTab === 'workflows' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Left runs list column */}
                <div className="lg:col-span-4 card-main p-0 overflow-hidden">
                  <div className="px-4 py-3.5 bg-slate-50 dark:bg-slate-900/30 border-b border-slate-200 dark:border-slate-800 font-bold text-xs text-slate-500">
                    Runs History
                  </div>
                  <div className="divide-y divide-slate-100 dark:divide-slate-800/40">
                    {workflowRuns.map(run => (
                      <div
                        key={run.id}
                        onClick={() => setSelectedRun(run)}
                        className={`p-4 cursor-pointer transition-colors text-xs ${
                          selectedRun?.id === run.id 
                            ? 'bg-slate-100 dark:bg-slate-800/60' 
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/20'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="font-semibold text-slate-950 dark:text-white">Run #{run.runNumber} - {run.name}</div>
                          {getStatusBadge(run.status)}
                        </div>
                        <p className="text-[10px] text-slate-400 truncate mt-1">{run.commitMessage}</p>
                        <div className="mt-3 flex items-center justify-between text-[10px] text-slate-450">
                          <span>branch: <b className="text-slate-650 dark:text-slate-350">{run.branch}</b></span>
                          <span>{new Date(run.startedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right run details and logs viewer column */}
                <div className="lg:col-span-8 space-y-6">
                  {selectedRun ? (
                    <div className="space-y-6">
                      {/* Active Run Header metadata */}
                      <div className="card-main space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2.5">
                              {getStatusIcon(selectedRun.status)}
                              <h3 className="text-sm font-bold text-slate-950 dark:text-white">Run #{selectedRun.runNumber} — {selectedRun.name}</h3>
                            </div>
                            <div className="flex flex-wrap items-center gap-4 text-[10px] text-slate-500 dark:text-slate-400 mt-2">
                              <span>Branch: <b className="text-slate-700 dark:text-slate-200">{selectedRun.branch}</b></span>
                              <span>Commit: <code className="font-mono text-slate-700 dark:text-slate-200">{selectedRun.commitSha.substring(0, 7)}</code></span>
                              <span>Triggered by: <b>@{selectedRun.triggeredBy.username}</b></span>
                              <span>Duration: <b>{selectedRun.durationSeconds}s</b></span>
                            </div>
                          </div>

                          <div className="flex gap-2">
                            {selectedRun.status !== 'running' && (
                              <button
                                onClick={() => handleRetryRun(selectedRun.id)}
                                className="flex items-center gap-1.5 rounded-lg border border-slate-250 bg-white px-3.5 py-2 text-xs font-bold hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-850 text-slate-700 dark:text-slate-300"
                              >
                                <RefreshCw className="h-3.5 w-3.5" />
                                Retry Run
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Standalone log console */}
                      <TerminalLogs 
                        runId={selectedRun.id} 
                        logs={selectedRun.id === 'run-184' ? mockLogs['run-184'] : selectedRun.id === 'run-54' ? mockLogs['run-54'] : []}
                        onStartDiscussion={(excerpt) => {
                          setNewDiscussionTitle(`Logs issue in Build #${selectedRun.runNumber}`);
                          setNewDiscussionContent(`The build failed during the workflow logs run. Excerpt:\n\n\`\`\`\n${excerpt}\n\`\`\``);
                          setIsNewDiscussionOpen(true);
                          setActiveTab('discussions');
                        }}
                      />
                    </div>
                  ) : (
                    <div className="card-main text-center p-12 text-slate-400">
                      Select a workflow run from the left panel to inspect failures.
                    </div>
                  )}
                </div>

              </div>
            )}

            {/* Standalone Log Viewer Tab */}
            {activeTab === 'logs' && (
              <div className="space-y-4">
                <div className="card-main">
                  <h3 className="text-sm font-bold text-slate-950 dark:text-white">Active Logs Terminal</h3>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Showing terminal stream diagnostics for latest run: Run #184</p>
                </div>
                <TerminalLogs 
                  runId="run-184" 
                  logs={mockLogs['run-184']} 
                  onStartDiscussion={(excerpt) => {
                    setNewDiscussionTitle('Build #184 Logs Thread');
                    setNewDiscussionContent(`Workflow logs failing on main:\n\n\`\`\`\n${excerpt}\n\`\`\``);
                    setIsNewDiscussionOpen(true);
                    setActiveTab('discussions');
                  }}
                />
              </div>
            )}

            {/* Discussions View */}
            {activeTab === 'discussions' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Left Discussions threads */}
                <div className="lg:col-span-4 card-main p-0 overflow-hidden">
                  <div className="px-4 py-3.5 bg-slate-50 dark:bg-slate-900/30 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-500">Repository Threads</span>
                    <button
                      onClick={() => setIsNewDiscussionOpen(true)}
                      className="flex items-center gap-1 text-[11px] font-bold text-primary hover:underline"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Create Thread
                    </button>
                  </div>
                  <div className="divide-y divide-slate-100 dark:divide-slate-850">
                    {discussions.map(disc => (
                      <div
                        key={disc.id}
                        onClick={() => handleSelectDiscussion(disc)}
                        className={`p-4 cursor-pointer transition-colors text-xs ${
                          selectedDisc?.id === disc.id 
                            ? 'bg-slate-100 dark:bg-slate-800/60' 
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/20'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <span className="font-bold text-slate-950 dark:text-white leading-tight">{disc.title}</span>
                          <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${
                            disc.status === 'open' 
                              ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/20 dark:text-rose-400' 
                              : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400'
                          }`}>
                            {disc.status.toUpperCase()}
                          </span>
                        </div>
                        {disc.runNumber && (
                          <div className="mt-2 text-[10px] text-primary font-bold">Related: Run #{disc.runNumber}</div>
                        )}
                        <div className="mt-3 flex items-center justify-between text-[10px] text-slate-450">
                          <span>Created by @{disc.author.username}</span>
                          <span>{disc.commentsCount} comments</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right comment stream column */}
                <div className="lg:col-span-8 space-y-6">
                  {isNewDiscussionOpen ? (
                    <div className="card-main space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-slate-950 dark:text-white">Start New Discussion</h3>
                        <button onClick={() => setIsNewDiscussionOpen(false)} className="text-xs text-slate-400 hover:text-white">Cancel</button>
                      </div>
                      <form onSubmit={handleCreateDiscussion} className="space-y-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Discussion Title</label>
                          <input
                            type="text"
                            placeholder="e.g. Dependency peer conflict on node setup"
                            value={newDiscussionTitle}
                            onChange={e => setNewDiscussionTitle(e.target.value)}
                            className="w-full rounded-lg border border-slate-200 p-2.5 text-xs outline-none dark:border-slate-800 dark:bg-slate-950 focus-ring"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Details / Description (Markdown & Excerpts supported)</label>
                          <textarea
                            rows={6}
                            placeholder="Describe your issue or paste relevant error logs here..."
                            value={newDiscussionContent}
                            onChange={e => setNewDiscussionContent(e.target.value)}
                            className="w-full rounded-lg border border-slate-200 p-2.5 text-xs font-mono outline-none dark:border-slate-800 dark:bg-slate-950 focus-ring"
                          />
                        </div>
                        <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-xs font-bold text-white">Create Thread</button>
                      </form>
                    </div>
                  ) : selectedDisc ? (
                    <div className="card-main space-y-5 flex flex-col justify-between min-h-[450px]">
                      
                      {/* Thread Title Header */}
                      <div className="border-b border-slate-200 pb-4 dark:border-slate-850 flex flex-wrap items-center justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold text-slate-950 dark:text-white">{selectedDisc.title}</h3>
                            <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${
                              selectedDisc.status === 'open' 
                                ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/20 dark:text-rose-400' 
                                : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400'
                            }`}>
                              {selectedDisc.status.toUpperCase()}
                            </span>
                          </div>
                          {selectedDisc.runNumber && <span className="text-[10px] text-slate-400 mt-1 block">Related build: <b>Run #{selectedDisc.runNumber}</b></span>}
                        </div>

                        {selectedDisc.status === 'open' && (
                          <button
                            onClick={handleResolveDiscussion}
                            className="rounded-lg bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900/40 px-3.5 py-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 transition-colors"
                          >
                            Mark as Resolved
                          </button>
                        )}
                      </div>

                      {/* Comments Feed */}
                      <div className="flex-1 space-y-4 max-h-[350px] overflow-y-auto pr-2 scrollbar-terminal py-2">
                        {discComments.map((comment) => (
                          <div
                            key={comment.id}
                            className={`flex gap-3.5 ${
                              comment.isAISuggestion 
                                ? 'rounded-xl border border-primary/20 bg-primary/5 p-4 dark:bg-primary/5' 
                                : ''
                            }`}
                          >
                            <img src={comment.author.avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-950 dark:text-white">{comment.author.name}</span>
                                <span className="text-[10px] text-slate-400">@{comment.author.username}</span>
                                <span className="text-[10px] text-slate-400">•</span>
                                <span className="text-[10px] text-slate-400">{new Date(comment.createdAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                              </div>
                              
                              <div className="mt-1.5 text-xs leading-relaxed text-slate-650 dark:text-slate-300 whitespace-pre-wrap">
                                {comment.content}
                              </div>

                              {comment.logExcerpt && (
                                <pre className="mt-2.5 rounded-lg bg-slate-950 p-3 font-mono text-[10px] text-rose-400 border border-slate-900 overflow-x-auto scrollbar-terminal">
                                  {comment.logExcerpt}
                                </pre>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Comment Input */}
                      {selectedDisc.status === 'open' ? (
                        <form onSubmit={handleAddComment} className="border-t border-slate-200 pt-4 dark:border-slate-850 flex items-center gap-2">
                          <input
                            type="text"
                            placeholder="Write a comment... (use @mentions, Markdown support)"
                            value={newCommentText}
                            onChange={e => setNewCommentText(e.target.value)}
                            className="flex-1 rounded-lg border border-slate-250 p-2.5 text-xs outline-none dark:border-slate-800 dark:bg-slate-950 focus-ring"
                          />
                          <button
                            type="submit"
                            className="rounded-lg bg-primary p-2.5 text-white hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-primary/40 transition-colors"
                          >
                            <Send className="h-4 w-4" />
                          </button>
                        </form>
                      ) : (
                        <div className="border-t border-slate-200 pt-4 dark:border-slate-850 text-center text-xs text-slate-400 font-medium">
                          🔒 This thread is resolved and locked.
                        </div>
                      )}

                    </div>
                  ) : (
                    <div className="card-main text-center p-12 text-slate-400">
                      No thread selected. Start a discussion or select one from the left sidebar.
                    </div>
                  )}
                </div>

              </div>
            )}

            {/* Team View */}
            {activeTab === 'team' && (
              <div className="space-y-6">
                <div className="card-main flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-950 dark:text-white">Repository Collaborators</h3>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Permissions are managed in your organization GitHub account settings.</p>
                  </div>
                  <button
                    onClick={() => alert('Access configuration requires GitHub Organization Owner authorization on the backend.')}
                    className="rounded-lg border border-slate-250 bg-white px-3.5 py-1.5 text-xs font-bold hover:bg-slate-50 dark:border-slate-850 dark:bg-slate-950 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300"
                  >
                    Manage Access
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {collaborators.map(member => (
                    <div key={member.id} className="card-main space-y-4">
                      <div className="flex items-center gap-3">
                        <img src={member.avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold truncate text-slate-950 dark:text-white">{member.name}</h4>
                          <span className="text-[10px] text-slate-400 truncate block">@{member.username}</span>
                        </div>
                      </div>
                      
                      <div className="border-t border-slate-200/60 pt-3 dark:border-slate-800/40 space-y-2 text-[10px]">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Role:</span>
                          <span className="font-bold text-slate-900 dark:text-slate-355 uppercase">{member.role}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Activity:</span>
                          <span className="text-slate-650 dark:text-slate-400">{member.lastActivity}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Failures Fixed:</span>
                          <span className="font-bold text-slate-900 dark:text-slate-300">{member.failuresFixed}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Knowledge View */}
            {activeTab === 'knowledge' && (
              <div className="space-y-6">
                <div className="card-main flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-950 dark:text-white">Repository Knowledge Base</h3>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Vector indexer stores and queries successful failure remedies.</p>
                  </div>
                </div>

                {knowledgeBase.length === 0 ? (
                  <div className="card-main text-center p-12 text-slate-400">
                    Knowledge base will populate as build failures are resolved.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {knowledgeBase.map(item => (
                      <div key={item.id} className="card-main space-y-3.5">
                        <div className="flex items-start justify-between">
                          <div className="rounded bg-rose-50 border border-rose-200 px-2 py-0.5 text-[9px] font-extrabold text-rose-500 dark:bg-rose-950/20 dark:border-rose-900/30 dark:text-rose-400 uppercase tracking-wide">
                            {item.category}
                          </div>
                          <span className="text-[10px] text-slate-400 font-semibold">Resolutions: {item.occurrences} times</span>
                        </div>

                        <h4 className="text-xs font-bold text-slate-950 dark:text-white">{item.errorType}</h4>
                        
                        <div className="bg-slate-50 dark:bg-slate-950/40 p-3 rounded-lg border border-slate-200/60 dark:border-slate-850 text-[11px] leading-relaxed">
                          <span className="font-bold block text-slate-700 dark:text-slate-300 mb-0.5">Known Fix:</span>
                          <span className="text-slate-650 dark:text-slate-400">{item.suggestedFix}</span>
                        </div>

                        <span className="text-[9px] text-slate-400 block pt-1">Last Resolved: {item.lastResolvedAt}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* AI Assistant Chat View */}
            {activeTab === 'assistant' && (
              <div className="card-main space-y-4 flex flex-col justify-between h-[500px]">
                
                {/* Chat Header */}
                <div className="border-b border-slate-200 pb-3.5 dark:border-slate-850">
                  <h3 className="text-sm font-bold text-slate-950 dark:text-white">FlowForge AI Assistant</h3>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Query failures, codebase architectures, or past resolutions.</p>
                </div>

                {/* Messages feed */}
                <div className="flex-1 space-y-4 overflow-y-auto pr-2 scrollbar-terminal py-2">
                  {assistantMessages.map((msg, i) => (
                    <div
                      key={i}
                      className={`flex gap-3 max-w-[85%] ${msg.role === 'user' ? 'ml-auto flex-row-reverse' : ''}`}
                    >
                      <div className={`rounded-full p-2 h-8 w-8 flex items-center justify-center shrink-0 text-xs font-extrabold ${
                        msg.role === 'user' 
                          ? 'bg-primary text-white' 
                          : 'bg-violet-500/10 text-violet-500 dark:bg-violet-950/20'
                      }`}>
                        {msg.role === 'user' ? 'ME' : 'AI'}
                      </div>
                      
                      <div className={`rounded-xl p-3.5 text-xs leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-primary text-white'
                          : 'border border-slate-200 bg-slate-50 dark:border-slate-850 dark:bg-slate-900/60 text-slate-700 dark:text-slate-300'
                      }`}>
                        <div className="whitespace-pre-wrap">{msg.content}</div>

                        {/* Sources list */}
                        {msg.sources && msg.sources.length > 0 && (
                          <div className="mt-3.5 border-t border-slate-200/60 pt-2 dark:border-slate-800/40">
                            <span className="text-[9px] font-bold text-slate-400 block uppercase tracking-wider mb-1">Sources Context:</span>
                            <div className="flex flex-wrap gap-1.5">
                              {msg.sources.map((s, idx) => (
                                <span key={idx} className="rounded bg-slate-200/60 dark:bg-slate-800 px-1.5 py-0.5 text-[9px] font-semibold text-slate-500 dark:text-slate-400">
                                  ✓ {s}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {isChatTyping && (
                    <div className="flex gap-3 max-w-[80%]">
                      <div className="rounded-full p-2 h-8 w-8 flex items-center justify-center bg-violet-500/10 text-violet-500 dark:bg-violet-950/20 text-xs font-bold shrink-0">
                        AI
                      </div>
                      <div className="rounded-xl p-4 border border-slate-200 bg-slate-50 dark:border-slate-850 dark:bg-slate-900/60 flex items-center justify-center">
                        <div className="dot-typing" />
                      </div>
                    </div>
                  )}
                </div>

                {/* Quick Prompts shortcuts */}
                <div className="flex flex-wrap gap-2 pt-2">
                  {[
                    'Why did the latest workflow fail?',
                    'Has this error happened before?',
                    'Who fixed a similar issue?',
                    'Explain this repository structure.'
                  ].map((q, idx) => (
                    <button
                      key={idx}
                      onClick={() => setChatInput(q)}
                      className="rounded-full border border-slate-200 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900 px-3 py-1.5 text-[10px] text-slate-500 dark:text-slate-450 transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>

                {/* Input form */}
                <form onSubmit={handleSendChatMessage} className="border-t border-slate-200 pt-3 dark:border-slate-850 flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Ask questions about this repository..."
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    className="flex-1 rounded-lg border border-slate-250 p-2.5 text-xs outline-none dark:border-slate-800 dark:bg-slate-950 focus-ring"
                  />
                  <button
                    type="submit"
                    className="rounded-lg bg-primary p-2.5 text-white hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-primary/40 transition-colors"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </form>

              </div>
            )}

            {/* Releases View */}
            {activeTab === 'releases' && (
              <div className="space-y-6">
                {releases.map(rel => (
                  <div key={rel.id} className="card-main space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-3.5 dark:border-slate-850">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-slate-950 dark:text-white">{rel.name}</h3>
                          <span className="rounded-full bg-slate-100 dark:bg-slate-850 px-2.5 py-0.5 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                            {rel.tagName}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 block mt-1">Published {rel.publishedAt} • {rel.commitCount} commits • {rel.prCount} PRs</span>
                      </div>

                      {!rel.aiSummary && releaseSummaryGenerating !== rel.id && (
                        <button
                          onClick={() => handleGenerateReleaseSummary(rel.id)}
                          className="rounded-lg bg-primary/10 border border-primary/20 hover:bg-primary/20 text-primary dark:bg-primary/20 px-3.5 py-1.5 text-xs font-bold transition-all"
                        >
                          Generate Release Summary
                        </button>
                      )}

                      {releaseSummaryGenerating === rel.id && (
                        <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 animate-pulse">
                          <Brain className="h-4 w-4 animate-spin text-primary" />
                          <span>Generating AI Changelog...</span>
                        </div>
                      )}
                    </div>

                    {/* AI generated changelog details */}
                    {rel.aiSummary && (
                      <div className="space-y-4 rounded-xl bg-slate-50/50 p-5 dark:bg-slate-950/20 border border-slate-200/60 dark:border-slate-850 animate-fade-in text-xs">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                          <div className="space-y-3">
                            <div>
                              <span className="font-extrabold text-emerald-500 block uppercase tracking-wider text-[9px] mb-1">🚀 Features Added</span>
                              <ul className="list-disc pl-4 space-y-1 text-slate-650 dark:text-slate-450">
                                {rel.aiSummary.features.map((f, i) => <li key={i}>{f}</li>)}
                              </ul>
                            </div>
                            <div>
                              <span className="font-extrabold text-rose-500 block uppercase tracking-wider text-[9px] mb-1">⚠️ Breaking Changes</span>
                              <ul className="list-disc pl-4 space-y-1 text-slate-650 dark:text-slate-450">
                                {rel.aiSummary.breaking.map((b, i) => <li key={i}>{b}</li>)}
                              </ul>
                            </div>
                          </div>
                          
                          <div className="space-y-3">
                            <div>
                              <span className="font-extrabold text-blue-500 block uppercase tracking-wider text-[9px] mb-1">🛠️ Bug Fixes</span>
                              <ul className="list-disc pl-4 space-y-1 text-slate-650 dark:text-slate-450">
                                {rel.aiSummary.fixes.map((fx, i) => <li key={i}>{fx}</li>)}
                              </ul>
                            </div>
                            <div>
                              <span className="font-extrabold text-slate-400 block uppercase tracking-wider text-[9px] mb-1">⚙️ General Changes</span>
                              <ul className="list-disc pl-4 space-y-1 text-slate-650 dark:text-slate-450">
                                {rel.aiSummary.changes.map((c, i) => <li key={i}>{c}</li>)}
                              </ul>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

          </motion.div>
        </AnimatePresence>
      </div>

    </div>
  );
};

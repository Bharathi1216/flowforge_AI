import React, { useState } from 'react';
import { 
  MessageSquare, Plus, Send, Pin, ArrowLeft, 
  Terminal, Bot, Check, Copy, Sparkles, MessageSquarePlus
} from 'lucide-react';
import { Discussion, Comment } from '../types';
import { AIExplanationCard } from './AIExplanationCard';
import { SimilarFailureCard } from './SimilarFailureCard';
import { useToast } from '../contexts/ToastContext';
import { useAIAssistant } from '../contexts/AIAssistantContext';

interface ThreadViewProps {
  discussions: Discussion[];
  selectedDiscussion: Discussion | null;
  comments: Comment[];
  onSelectDiscussion: (disc: Discussion) => void;
  onCreateDiscussion: (title: string, content: string) => void;
  onAddComment: (discId: string, text: string) => void;
  initialNewThreadTitle?: string;
  initialNewThreadContent?: string;
}

export const ThreadView: React.FC<ThreadViewProps> = ({
  discussions,
  selectedDiscussion,
  comments,
  onSelectDiscussion,
  onCreateDiscussion,
  onAddComment,
  initialNewThreadTitle = '',
  initialNewThreadContent = ''
}) => {
  const { success } = useToast();
  const { openAssistant } = useAIAssistant();
  const [isCreating, setIsCreating] = useState(!!initialNewThreadTitle);
  const [newTitle, setNewTitle] = useState(initialNewThreadTitle);
  const [newContent, setNewContent] = useState(initialNewThreadContent);
  const [replyText, setReplyText] = useState('');
  const [isAIResponding, setIsAIResponding] = useState(false);
  const [copiedFix, setCopiedFix] = useState(false);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) return;
    onCreateDiscussion(newTitle, newContent);
    success('Discussion thread published to team', 'Thread Created');
    setNewTitle('');
    setNewContent('');
    setIsCreating(false);
  };

  const handleSendReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedDiscussion) return;
    const userText = replyText;
    onAddComment(selectedDiscussion.id, userText);
    setReplyText('');
    success('Message sent to thread', 'Reply Posted');

    if (userText.includes('?') || userText.toLowerCase().includes('how') || userText.toLowerCase().includes('why') || userText.toLowerCase().includes('fix') || userText.toLowerCase().includes('ai')) {
      setIsAIResponding(true);
      setTimeout(() => {
        setIsAIResponding(false);
        onAddComment(
          selectedDiscussion.id,
          `🤖 **FlowForge AI Assistant:**
To resolve this peer dependency conflict in GitHub Actions, update your \`.github/workflows/ci.yml\` workflow step:
\`\`\`yaml
- name: Install dependencies
  run: npm ci --legacy-peer-deps
\`\`\`
Or pin \`react\` to \`^18.2.0\` and \`react-dom\` to \`^18.2.0\` in your root \`package.json\`.`
        );
      }, 1000);
    }
  };

  const suggestedFixCode = 
`# Option 1: Run npm install with peer bypass in workflow yaml
npm install --legacy-peer-deps

# Option 2: Pin React to stable 18.2.0 in package.json
npm install react@^18.2.0 react-dom@^18.2.0`;

  const handleCopyFix = () => {
    navigator.clipboard.writeText(suggestedFixCode);
    setCopiedFix(true);
    success('Suggested command copied to clipboard!');
    setTimeout(() => setCopiedFix(false), 2000);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[640px]">
      {/* Left Column: Discussion Threads List */}
      <div className="lg:col-span-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0E121D] p-4 shadow-sm flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 mb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Discussion Threads
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 font-mono font-bold">
                  {discussions.length}
                </span>
              </h3>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">Team failure discussions & solutions</p>
            </div>
            <button
              onClick={() => setIsCreating(true)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all shadow-sm"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>New</span>
            </button>
          </div>

          <div className="space-y-2.5 max-h-[540px] overflow-y-auto pr-1 scrollbar-terminal">
            {discussions.map((disc, idx) => {
              const isSelected = selectedDiscussion?.id === disc.id;
              const isLatest = idx === 0;
              return (
                <div
                  key={disc.id}
                  onClick={() => {
                    setIsCreating(false);
                    onSelectDiscussion(disc);
                  }}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                    isSelected && !isCreating
                      ? 'border-purple-500 bg-purple-50/60 dark:bg-purple-950/20 text-slate-900 dark:text-white shadow-sm'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {isLatest && (
                        <span className="h-2 w-2 rounded-full bg-rose-500 animate-ping shrink-0" />
                      )}
                      <h4 className={`text-xs font-bold truncate ${isSelected ? 'text-purple-700 dark:text-purple-300' : 'text-slate-800 dark:text-slate-200'}`}>
                        {disc.title}
                      </h4>
                    </div>
                    {disc.isPinned && <Pin className="h-3 w-3 text-purple-500 shrink-0 mt-0.5" />}
                  </div>

                  <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-1 font-mono">
                    {disc.content}
                  </p>

                  <div className="mt-2.5 flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-800 font-mono">
                    <div className="flex items-center gap-1.5">
                      <img
                        src={disc.author.avatarUrl}
                        alt=""
                        className="h-4 w-4 rounded-full object-cover ring-1 ring-slate-300 dark:ring-slate-700"
                      />
                      <span className="text-slate-700 dark:text-slate-300 font-medium">@{disc.author.username}</span>
                    </div>
                    <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold">
                      <MessageSquare className="h-3 w-3" />
                      {disc.commentsCount}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right Column: Interactive Thread View */}
      <div className="lg:col-span-8 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0E121D] p-5 shadow-sm flex flex-col justify-between space-y-4">
        {isCreating ? (
          /* Create New Thread Form */
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 hover:text-slate-900 dark:hover:text-white"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Start New Discussion Thread</h3>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 font-mono">Thread Subject</label>
              <input
                type="text"
                placeholder="e.g. Build Failure #92: npm ERESOLVE Conflict"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 font-mono">Pushed Failure Logs & Details</label>
              <textarea
                rows={7}
                placeholder="Paste failure logs, error traces, or diagnostic queries..."
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-900 p-3 text-xs font-mono text-rose-300 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-xs font-bold text-white shadow-sm"
              >
                Publish to Team
              </button>
            </div>
          </form>
        ) : selectedDiscussion ? (
          /* Active Thread View */
          <div className="flex flex-col h-full justify-between space-y-4">
            <div className="max-h-[380px] overflow-y-auto space-y-4 pr-1 scrollbar-terminal">
              {/* Thread Header Info */}
              <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">{selectedDiscussion.title}</h3>
                  <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                    <img
                      src={selectedDiscussion.author.avatarUrl}
                      alt=""
                      className="h-4 w-4 rounded-full object-cover ring-1 ring-purple-500/30"
                    />
                    <span className="text-slate-800 dark:text-slate-200 font-semibold">@{selectedDiscussion.author.username}</span>
                    <span>•</span>
                    <span>{selectedDiscussion.timestamp || 'Today'}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 px-2.5 py-0.5 text-[10px] font-mono font-bold text-rose-700 dark:text-rose-300">
                    Attached Failure Logs
                  </span>
                  <button
                    onClick={() => openAssistant(`Analyze thread failure: ${selectedDiscussion.title}\n\n${selectedDiscussion.content}`)}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-100 dark:hover:bg-purple-900/50 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 text-[11px] font-bold transition-all"
                  >
                    <Sparkles className="h-3 w-3 text-purple-600 dark:text-purple-400" />
                    <span>Ask AI</span>
                  </button>
                </div>
              </div>

              {/* 1. Captured GitHub Actions Failure Log Box */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-900 text-slate-200 overflow-hidden shadow-inner">
                <div className="flex items-center justify-between px-3.5 py-2 bg-slate-950 border-b border-slate-800 text-[10px] font-bold font-mono">
                  <span className="flex items-center gap-1.5 text-slate-400">
                    <Terminal className="h-3.5 w-3.5 text-purple-400" />
                    <span>Pushed GitHub Actions Failure Log</span>
                  </span>
                  <span className="text-rose-400">Exit Code 1</span>
                </div>
                <pre className="font-mono text-xs text-rose-300 p-3.5 whitespace-pre-wrap max-h-28 overflow-y-auto scrollbar-terminal leading-relaxed select-text">
                  {selectedDiscussion.content}
                </pre>
              </div>

              {/* 2. AI Failure Diagnostics & Root Cause Card */}
              <AIExplanationCard
                summary="The CI run failed during npm dependency resolution because react-router-dom expects React 18, whereas the repository has react@19-rc. NPM v9+ halts on peer dependency mismatches by default."
                rootCause="Strict peer dependency mismatch: react@19.0.0 vs react-router-dom peer requirement ^18.0.0"
              />

              {/* 3. Suggested Fix & Patch Card */}
              <div className="rounded-xl border border-purple-200 dark:border-purple-800/80 bg-purple-50/50 dark:bg-purple-950/20 p-3.5 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-purple-800 dark:text-purple-300 uppercase tracking-wider font-mono">
                    Suggested Resolution & Patch
                  </span>
                  <button
                    onClick={handleCopyFix}
                    className="flex items-center gap-1 px-2.5 py-1 rounded bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 text-[10px] font-bold transition-all shadow-sm"
                  >
                    {copiedFix ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                    <span>{copiedFix ? 'Copied' : 'Copy Fix'}</span>
                  </button>
                </div>
                <pre className="font-mono text-[11px] text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-950 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 overflow-x-auto">
                  {suggestedFixCode}
                </pre>
              </div>

              {/* 4. Similar Past Failure RAG Match */}
              <SimilarFailureCard
                pastFailureId="89"
                repoName="FlowForge-AI"
                errorSnippet="npm ERR! ERESOLVE could not resolve peer dep react@18"
                fixedBy={{
                  name: 'Bharathi',
                  username: 'bharathi1216',
                  avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'
                }}
                solutionSummary="Added --legacy-peer-deps flag to GitHub Actions workflow yaml step."
              />
            </div>

            {/* Teammates Chat Stream */}
            <div className="flex-1 max-h-[220px] overflow-y-auto space-y-2.5 pr-1 scrollbar-terminal py-1 border-t border-slate-200 dark:border-slate-800">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 font-mono pt-1 pb-1">
                Developer Collaboration Stream
              </div>

              {comments.map((comment) => {
                const isCurrentUser = comment.author.username === 'bharathi1216';
                const isAI = comment.author.username === 'flowforge-ai' || comment.content.includes('🤖');
                return (
                  <div
                    key={comment.id}
                    className={`flex items-start gap-2.5 ${isCurrentUser ? 'flex-row-reverse' : 'flex-row'}`}
                  >
                    <img
                      src={comment.author.avatarUrl}
                      alt={comment.author.name}
                      className="h-6 w-6 rounded-full object-cover shrink-0 mt-1 ring-1 ring-slate-300 dark:ring-slate-700"
                    />
                    <div
                      className={`max-w-[80%] rounded-2xl p-3 text-xs leading-relaxed ${
                        isCurrentUser
                          ? 'bg-purple-600 text-white shadow-sm'
                          : isAI
                          ? 'bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/80 text-slate-800 dark:text-slate-200'
                          : 'bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3 text-[10px] opacity-85 mb-1 font-mono">
                        <span className="font-bold">{comment.author.name}</span>
                        <span>{comment.timestamp || 'Date unavailable'}</span>
                      </div>
                      <div className="whitespace-pre-wrap font-sans">{comment.content}</div>
                    </div>
                  </div>
                );
              })}

              {isAIResponding && (
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 text-xs text-purple-700 dark:text-purple-300 font-medium">
                  <Bot className="h-4 w-4 animate-bounce text-purple-600" />
                  <span>FlowForge AI Assistant is analyzing the failure log and formulating a fix...</span>
                </div>
              )}
            </div>

            {/* Developer Query / Chat Input Bar */}
            <form onSubmit={handleSendReply} className="flex items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <input
                type="text"
                placeholder="Ask AI for a patch, discuss with team, or type a question..."
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                className="flex-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 py-2.5 px-4 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
              />
              <button
                type="submit"
                className="flex items-center gap-1.5 rounded-xl bg-purple-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-purple-700 transition-all shadow-sm"
              >
                <Send className="h-3.5 w-3.5" />
                <span>Send</span>
              </button>
            </form>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center text-slate-400 p-8">
            <MessageSquare className="h-8 w-8 text-slate-400 mb-2" />
            <span className="text-xs">Select a thread on the left to inspect logs, AI diagnosis, and reply</span>
          </div>
        )}
      </div>
    </div>
  );
};


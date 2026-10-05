import React, { useState, useMemo } from 'react';
import { Search, AlertTriangle, AlertCircle, Copy, Download, Brain, ChevronDown, ChevronRight, CheckCircle2, RotateCw } from 'lucide-react';
import { LogLine, FailureAnalysis } from '../types';
import { aiService } from '../services/aiService';
import { RAGVisualizer } from './RAGVisualizer';

interface TerminalLogsProps {
  runId: string;
  logs: LogLine[];
  onStartDiscussion?: (excerpt: string) => void;
}

export const TerminalLogs: React.FC<TerminalLogsProps> = ({ runId, logs, onStartDiscussion }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterError, setFilterError] = useState(false);
  const [filterWarning, setFilterWarning] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    'Initialize environment': true,
    'Checkout': true,
    'Node Setup': true,
    'Install Dependencies': true,
    'Clean Up': true
  });
  
  // AI analysis states
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<FailureAnalysis | null>(null);
  const [copied, setCopied] = useState(false);

  // Group logs by section name
  const logsBySection = useMemo(() => {
    const sections: Record<string, LogLine[]> = {};
    logs.forEach(line => {
      const section = line.section || 'General';
      if (!sections[section]) {
        sections[section] = [];
      }
      sections[section].push(line);
    });
    return sections;
  }, [logs]);

  // Filter and search lines
  const filterLine = (line: LogLine) => {
    if (filterError && line.type !== 'error') return false;
    if (filterWarning && line.type !== 'warn') return false;
    if (searchQuery) {
      return line.message.toLowerCase().includes(searchQuery.toLowerCase());
    }
    return true;
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const handleCopy = () => {
    const text = logs.map(l => `[${l.timestamp}] ${l.type.toUpperCase()}: ${l.message}`).join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const text = logs.map(l => `[${l.timestamp}] ${l.type.toUpperCase()}: ${l.message}`).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `workflow-run-${runId}-logs.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleAIAnalyze = async () => {
    setIsAnalyzing(true);
    try {
      const result = await aiService.analyzeFailure(runId);
      setAnalysisResult(result);
    } catch (err) {
      console.error(err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Get lines causing the error to attach to discussion
  const getErrorExcerpt = () => {
    return logs
      .filter(l => l.type === 'error')
      .map(l => `Line ${l.lineNumber}: ${l.message}`)
      .join('\n');
  };

  return (
    <div className="space-y-6">
      {/* Terminal Tools Controller */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              placeholder="Search logs..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-56 rounded-lg border border-slate-200 bg-white py-1.5 pl-9 pr-4 text-sm outline-none dark:border-slate-800 dark:bg-slate-950 focus-ring"
            />
          </div>

          {/* Toggle Error Filter */}
          <button
            onClick={() => setFilterError(!filterError)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium border transition-colors ${
              filterError
                ? 'bg-rose-50 border-rose-200 text-rose-600 dark:bg-rose-950/30 dark:border-rose-900/40 dark:text-rose-400'
                : 'bg-white border-slate-200 hover:bg-slate-100 dark:bg-slate-950 dark:border-slate-800 dark:hover:bg-slate-900 text-slate-600 dark:text-slate-400'
            }`}
          >
            <AlertCircle className="h-3.5 w-3.5" />
            Errors Only
          </button>

          {/* Toggle Warning Filter */}
          <button
            onClick={() => setFilterWarning(!filterWarning)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium border transition-colors ${
              filterWarning
                ? 'bg-amber-50 border-amber-200 text-amber-600 dark:bg-amber-950/30 dark:border-amber-900/40 dark:text-amber-400'
                : 'bg-white border-slate-200 hover:bg-slate-100 dark:bg-slate-950 dark:border-slate-800 dark:hover:bg-slate-900 text-slate-600 dark:text-slate-400'
            }`}
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            Warnings Only
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Analyze with AI */}
          <button
            onClick={handleAIAnalyze}
            disabled={isAnalyzing}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-70 transition-colors"
          >
            <Brain className="h-4 w-4" />
            {isAnalyzing ? 'Analyzing logs...' : 'Analyze with AI'}
          </button>

          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white p-2 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-slate-900 text-slate-600 dark:text-slate-400"
            title="Copy logs"
          >
            <Copy className="h-3.5 w-3.5" />
            <span className="text-xs hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
          </button>

          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white p-2 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-slate-900 text-slate-600 dark:text-slate-400"
            title="Download logs"
          >
            <Download className="h-3.5 w-3.5" />
            <span className="text-xs hidden sm:inline">Download</span>
          </button>
        </div>
      </div>

      {/* Terminal Output */}
      <div className="rounded-xl border border-slate-900 bg-slate-950 p-4 font-mono text-xs shadow-inner select-text">
        {/* Terminal Header */}
        <div className="mb-4 flex items-center justify-between border-b border-slate-800/80 pb-2.5 text-slate-500">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-rose-500" />
            <span className="h-3 w-3 rounded-full bg-amber-500" />
            <span className="h-3 w-3 rounded-full bg-emerald-500" />
            <span className="ml-2 text-[10px] uppercase font-bold tracking-wider">bash - run-{runId}</span>
          </div>
          <span className="text-[10px]">UTF-8</span>
        </div>

        {/* Console logs */}
        <div className="space-y-4 max-h-[500px] overflow-y-auto scrollbar-terminal pr-2">
          {Object.keys(logsBySection).map(sectionName => {
            const sectionLines = logsBySection[sectionName];
            const isExpanded = expandedSections[sectionName] ?? false;
            
            // Check if section contains any match
            const matchingLines = sectionLines.filter(filterLine);
            if (matchingLines.length === 0 && searchQuery) return null;

            // Check if section contains error to display red badge on closed header
            const hasError = sectionLines.some(l => l.type === 'error');
            const hasWarning = sectionLines.some(l => l.type === 'warn');

            return (
              <div key={sectionName} className="space-y-1.5">
                {/* Section Header */}
                <button
                  onClick={() => toggleSection(sectionName)}
                  className="flex w-full items-center justify-between rounded bg-slate-900/50 px-2.5 py-2 text-left font-medium text-slate-300 hover:bg-slate-900"
                >
                  <div className="flex items-center gap-2">
                    {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    <span>{sectionName}</span>
                    <span className="text-[10px] text-slate-500 font-normal">({matchingLines.length} lines)</span>
                  </div>
                  <div className="flex gap-1.5">
                    {hasError && <span className="rounded bg-rose-950/50 border border-rose-900/40 px-1.5 py-0.5 text-[9px] text-rose-400 font-bold">ERROR</span>}
                    {hasWarning && <span className="rounded bg-amber-950/50 border border-amber-900/40 px-1.5 py-0.5 text-[9px] text-amber-400 font-bold">WARN</span>}
                    {!hasError && !hasWarning && <span className="rounded bg-emerald-950/30 border border-emerald-900/20 px-1.5 py-0.5 text-[9px] text-emerald-400 font-bold">PASS</span>}
                  </div>
                </button>

                {/* Section Content */}
                {isExpanded && (
                  <div className="pl-4 space-y-1 border-l border-slate-900 ml-2.5">
                    {matchingLines.map((line, idx) => {
                      const isError = line.type === 'error';
                      const isWarning = line.type === 'warn';

                      return (
                        <div
                          key={idx}
                          className={`flex items-start gap-4 py-0.5 px-2 rounded ${
                            isError
                              ? 'bg-rose-950/15 text-rose-400 border-l-2 border-rose-500'
                              : isWarning
                              ? 'bg-amber-950/15 text-amber-400 border-l-2 border-amber-500'
                              : 'text-slate-400 hover:bg-slate-900/40'
                          }`}
                        >
                          <span className="w-10 text-right select-none text-slate-600 pr-1">{line.lineNumber}</span>
                          <span className="w-24 select-none text-slate-600 truncate">{new Date(line.timestamp).toLocaleTimeString()}</span>
                          <span className="flex-1 whitespace-pre-wrap leading-relaxed">{line.message}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* AI Analyzing Loader */}
      {isAnalyzing && (
        <div className="rounded-xl border border-dashed border-primary/40 bg-primary/5 p-8 text-center animate-pulse">
          <div className="flex flex-col items-center justify-center gap-3">
            <Brain className="h-8 w-8 text-primary animate-spin-slow" />
            <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">Analyzing workflow logs...</div>
            <div className="text-xs text-slate-400 dark:text-slate-500">Retrieving previous failures, discussions, and wiki context</div>
            <div className="w-24 mt-2 flex justify-center">
              <div className="dot-typing" />
            </div>
          </div>
        </div>
      )}

      {/* AI Diagnostic report panel */}
      {analysisResult && !isAnalyzing && (
        <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 to-violet-500/5 p-6 dark:border-primary/20 dark:from-primary/10 dark:to-violet-500/5 animate-fade-in">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2 text-primary dark:bg-primary/20">
                <Brain className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-950 dark:text-white">AI Failure Analysis</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Resolved using repository context</p>
              </div>
            </div>
            <div className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary dark:bg-primary/20">
              {analysisResult.title}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">What Happened</span>
                <p className="mt-1 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{analysisResult.summary}</p>
              </div>
              
              <div>
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Why It Happened</span>
                <p className="mt-1 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{analysisResult.rootCause}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-lg border border-primary/20 bg-primary/10 p-4 dark:border-primary/30 dark:bg-primary/10">
                <span className="text-[10px] font-bold text-primary dark:text-primary-hover uppercase tracking-wider">Suggested Fix</span>
                <p className="mt-1.5 text-sm font-semibold text-slate-800 dark:text-slate-100">{analysisResult.suggestedFix}</p>
              </div>

              {analysisResult.similarPreviousRunNumber && (
                <div className="rounded-lg border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900/60">
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Similar Previous Failure</span>
                  <div className="mt-1 flex items-center justify-between text-xs text-slate-700 dark:text-slate-300">
                    <span>Workflow run #{analysisResult.similarPreviousRunNumber}</span>
                    <span className="font-semibold text-rose-500">Failed</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* RAG Section */}
          <div className="mt-6 border-t border-slate-200 pt-5 dark:border-slate-800">
            <RAGVisualizer />
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/60 pt-4 dark:border-slate-800/40">
            <div className="flex flex-wrap items-center gap-3">
              {analysisResult.relevantDocs.map((doc, idx) => (
                <a
                  key={idx}
                  href={doc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline dark:text-primary-hover"
                >
                  📄 {doc.title}
                </a>
              ))}
            </div>
            
            <div className="flex gap-2">
              {onStartDiscussion && (
                <button
                  onClick={() => onStartDiscussion(getErrorExcerpt())}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                >
                  Start Team Discussion
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

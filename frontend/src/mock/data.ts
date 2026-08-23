import { User, Repository, Collaborator, Workflow, WorkflowRun, LogLine, FailureAnalysis, Discussion, Comment, KnowledgeItem, Notification, Release } from '../types';

export const mockCurrentUser: User = {
  id: 'usr-1',
  username: 'bharathi1216',
  name: 'Bharathi',
  avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
  email: 'bharathi@flowforge.ai',
  githubUrl: 'https://github.com/bharathi1216'
};

export const mockUsers: Record<string, User> = {
  'usr-1': mockCurrentUser,
  'usr-2': {
    id: 'usr-2',
    username: 'sarah-codes',
    name: 'Sarah Connor',
    avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80',
    email: 'sarah@flowforge.ai',
    githubUrl: 'https://github.com/sarah-codes'
  },
  'usr-3': {
    id: 'usr-3',
    username: 'alex-dev',
    name: 'Alex Rivera',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80',
    email: 'alex@flowforge.ai',
    githubUrl: 'https://github.com/alex-dev'
  },
  'usr-4': {
    id: 'usr-4',
    username: 'john-lead',
    name: 'John Miller',
    avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&q=80',
    email: 'john@flowforge.ai',
    githubUrl: 'https://github.com/john-lead'
  }
};

export const mockRepositories: Repository[] = [
  {
    id: 'repo-1',
    name: 'FlowForge-AI',
    owner: 'flowforge-org',
    description: 'Repository-centric AI-powered CI/CD failure diagnostics and developer collaboration dashboard.',
    language: 'TypeScript',
    isPrivate: true,
    lastWorkflowStatus: 'failed',
    lastUpdated: '2 mins ago',
    contributorCount: 4,
    openDiscussionsCount: 3,
    failureCount: 2,
    healthScore: 84,
    successRate: 88,
    userAccessRole: 'maintainer'
  },
  {
    id: 'repo-2',
    name: 'EduCheck',
    owner: 'bharathi1216',
    description: 'An AI grader and assessment platform for academic institutions integrating automated feedback.',
    language: 'Python',
    isPrivate: false,
    lastWorkflowStatus: 'success',
    lastUpdated: '2 hours ago',
    contributorCount: 2,
    openDiscussionsCount: 0,
    failureCount: 0,
    healthScore: 98,
    successRate: 97,
    userAccessRole: 'owner'
  },
  {
    id: 'repo-3',
    name: 'Smart-Disaster-Twin',
    owner: 'twin-labs',
    description: '3D spatial simulation and causal inference engine for predicting extreme weather and environmental hazards.',
    language: 'JavaScript',
    isPrivate: true,
    lastWorkflowStatus: 'warning',
    lastUpdated: '1 day ago',
    contributorCount: 8,
    openDiscussionsCount: 5,
    failureCount: 4,
    healthScore: 78,
    successRate: 82,
    userAccessRole: 'developer'
  },
  {
    id: 'repo-4',
    name: 'German-Bharatham',
    owner: 'bharathi1216',
    description: 'A localization and language bridge tool mapping German idioms and vocabulary databases to Tamil dialects.',
    language: 'Python',
    isPrivate: false,
    lastWorkflowStatus: 'failed',
    lastUpdated: '3 days ago',
    contributorCount: 3,
    openDiscussionsCount: 1,
    failureCount: 3,
    healthScore: 65,
    successRate: 70,
    userAccessRole: 'owner'
  }
];

export const mockGithubRepositories = [
  { name: 'FlowForge-AI', owner: 'flowforge-org', isPrivate: true, description: 'Repository-centric AI-powered CI/CD diagnostics.', language: 'TypeScript', added: true },
  { name: 'EduCheck', owner: 'bharathi1216', isPrivate: false, description: 'An AI grader and assessment platform.', language: 'Python', added: true },
  { name: 'Smart-Disaster-Twin', owner: 'twin-labs', isPrivate: true, description: '3D spatial simulation and causal inference engine.', language: 'JavaScript', added: true },
  { name: 'German-Bharatham', owner: 'bharathi1216', isPrivate: false, description: 'Localization and language bridge tool.', language: 'Python', added: true },
  { name: 'neural-rag-pipeline', owner: 'bharathi1216', isPrivate: true, description: 'Fast vector search service using Gemini & ChromaDB.', language: 'Python', added: false },
  { name: 'react-gl-globe', owner: 'bharathi1216', isPrivate: false, description: 'Three.js lightweight visualizer globe.', language: 'TypeScript', added: false },
  { name: 'hacker-news-terminal', owner: 'bharathi1216', isPrivate: false, description: 'Read HN in retro terminal CLI style.', language: 'Go', added: false }
];

export const mockCollaborators: Record<string, Collaborator[]> = {
  'repo-1': [
    { id: 'usr-1', username: 'bharathi1216', name: 'Bharathi', avatarUrl: mockUsers['usr-1'].avatarUrl, role: 'maintainer', lastActivity: 'Active now', issuesResolved: 14, failuresFixed: 8 },
    { id: 'usr-2', username: 'sarah-codes', name: 'Sarah Connor', avatarUrl: mockUsers['usr-2'].avatarUrl, role: 'developer', lastActivity: '10 mins ago', issuesResolved: 25, failuresFixed: 15 },
    { id: 'usr-3', username: 'alex-dev', name: 'Alex Rivera', avatarUrl: mockUsers['usr-3'].avatarUrl, role: 'developer', lastActivity: '2 hours ago', issuesResolved: 9, failuresFixed: 4 },
    { id: 'usr-4', username: 'john-lead', name: 'John Miller', avatarUrl: mockUsers['usr-4'].avatarUrl, role: 'owner', lastActivity: 'Yesterday', issuesResolved: 41, failuresFixed: 22 }
  ],
  'repo-2': [
    { id: 'usr-1', username: 'bharathi1216', name: 'Bharathi', avatarUrl: mockUsers['usr-1'].avatarUrl, role: 'owner', lastActivity: 'Active now', issuesResolved: 31, failuresFixed: 12 },
    { id: 'usr-2', username: 'sarah-codes', name: 'Sarah Connor', avatarUrl: mockUsers['usr-2'].avatarUrl, role: 'maintainer', lastActivity: '5 hours ago', issuesResolved: 18, failuresFixed: 9 }
  ],
  'repo-3': [
    { id: 'usr-3', username: 'alex-dev', name: 'Alex Rivera', avatarUrl: mockUsers['usr-3'].avatarUrl, role: 'developer', lastActivity: 'Active now', issuesResolved: 6, failuresFixed: 2 },
    { id: 'usr-4', username: 'john-lead', name: 'John Miller', avatarUrl: mockUsers['usr-4'].avatarUrl, role: 'owner', lastActivity: '3 mins ago', issuesResolved: 55, failuresFixed: 30 }
  ],
  'repo-4': [
    { id: 'usr-1', username: 'bharathi1216', name: 'Bharathi', avatarUrl: mockUsers['usr-1'].avatarUrl, role: 'owner', lastActivity: '2 days ago', issuesResolved: 8, failuresFixed: 3 },
    { id: 'usr-3', username: 'alex-dev', name: 'Alex Rivera', avatarUrl: mockUsers['usr-3'].avatarUrl, role: 'developer', lastActivity: '1 day ago', issuesResolved: 4, failuresFixed: 1 }
  ]
};

export const mockWorkflows: Record<string, Workflow[]> = {
  'repo-1': [
    { id: 'wf-1', name: 'Build and Test', path: '.github/workflows/build-test.yml', status: 'active' },
    { id: 'wf-2', name: 'Release Pipeline', path: '.github/workflows/release.yml', status: 'active' }
  ],
  'repo-2': [
    { id: 'wf-3', name: 'Django CI', path: '.github/workflows/django.yml', status: 'active' }
  ]
};

export const mockWorkflowRuns: Record<string, WorkflowRun[]> = {
  'repo-1': [
    {
      id: 'run-184',
      workflowId: 'wf-1',
      name: 'Build and Test',
      runNumber: 184,
      status: 'failed',
      event: 'push',
      triggeredBy: mockUsers['usr-1'],
      branch: 'main',
      commitSha: 'e7f2b1ab73f8a0',
      commitMessage: 'feat: add RAG search and visualizer component',
      durationSeconds: 133,
      startedAt: '2026-08-22T19:50:00Z',
      completedAt: '2026-08-22T19:52:13Z',
      failureSummary: 'npm ERESOLVE unable to resolve dependency tree (React 19 vs React 18 peer requirements)',
      logsAnalysed: true
    },
    {
      id: 'run-183',
      workflowId: 'wf-1',
      name: 'Build and Test',
      runNumber: 183,
      status: 'success',
      event: 'pull_request',
      triggeredBy: mockUsers['usr-2'],
      branch: 'main',
      commitSha: '9a8b7c6d5e4f3a',
      commitMessage: 'fix: update notification service tests',
      durationSeconds: 125,
      startedAt: '2026-08-22T18:00:00Z',
      completedAt: '2026-08-22T18:02:05Z'
    },
    {
      id: 'run-182',
      workflowId: 'wf-1',
      name: 'Build and Test',
      runNumber: 182,
      status: 'failed',
      event: 'push',
      triggeredBy: mockUsers['usr-3'],
      branch: 'feature/log-viewer',
      commitSha: 'f1d2c3b4a5e6f7',
      commitMessage: 'wip: terminal styling improvements',
      durationSeconds: 98,
      startedAt: '2026-08-22T15:20:00Z',
      completedAt: '2026-08-22T15:21:38Z',
      failureSummary: 'ESLint command found 5 critical lint errors'
    }
  ],
  'repo-2': [
    {
      id: 'run-95',
      workflowId: 'wf-3',
      name: 'Django CI',
      runNumber: 95,
      status: 'success',
      event: 'push',
      triggeredBy: mockUsers['usr-1'],
      branch: 'main',
      commitSha: '4c3b2a1d0e9f8a',
      commitMessage: 'chore: bump python requirements',
      durationSeconds: 84,
      startedAt: '2026-08-22T14:15:00Z',
      completedAt: '2026-08-22T14:16:24Z'
    }
  ],
  'repo-3': [
    {
      id: 'run-102',
      workflowId: 'wf-1',
      name: 'Simulations Engine Run',
      runNumber: 102,
      status: 'warning',
      event: 'schedule',
      triggeredBy: mockUsers['usr-4'],
      branch: 'main',
      commitSha: '112233445566aa',
      commitMessage: 'cron: periodic simulation mesh verification',
      durationSeconds: 310,
      startedAt: '2026-08-21T00:00:00Z',
      completedAt: '2026-08-21T00:05:10Z',
      failureSummary: 'GPU validation tests warnings (12 warnings, 0 fatal errors)'
    }
  ],
  'repo-4': [
    {
      id: 'run-54',
      workflowId: 'wf-1',
      name: 'Bridge Build',
      runNumber: 54,
      status: 'failed',
      event: 'push',
      triggeredBy: mockUsers['usr-1'],
      branch: 'main',
      commitSha: 'eeddccbbaa9988',
      commitMessage: 'feat: add German-Tamil idioms vocabulary json dictionary',
      durationSeconds: 45,
      startedAt: '2026-08-19T10:10:00Z',
      completedAt: '2026-08-19T10:10:45Z',
      failureSummary: 'ModuleNotFoundError: No module named "yaml" in main.py'
    }
  ]
};

export const mockLogs: Record<string, LogLine[]> = {
  'run-184': [
    { lineNumber: 1, timestamp: '2026-08-22T19:50:01Z', type: 'info', message: 'Set up Job: Build and Test', section: 'Initialize environment' },
    { lineNumber: 2, timestamp: '2026-08-22T19:50:02Z', type: 'info', message: 'Pulling docker image node:20-alpine...', section: 'Initialize environment' },
    { lineNumber: 3, timestamp: '2026-08-22T19:50:05Z', type: 'info', message: 'Successfully pulled node:20-alpine image.', section: 'Initialize environment' },
    { lineNumber: 4, timestamp: '2026-08-22T19:50:06Z', type: 'info', message: 'Checking out repository flowforge-org/FlowForge-AI...', section: 'Checkout' },
    { lineNumber: 5, timestamp: '2026-08-22T19:50:08Z', type: 'info', message: 'Workspace sync completed on commit e7f2b1ab73f8a0', section: 'Checkout' },
    { lineNumber: 6, timestamp: '2026-08-22T19:50:10Z', type: 'info', message: 'Node.js version: v20.11.0', section: 'Node Setup' },
    { lineNumber: 7, timestamp: '2026-08-22T19:50:11Z', type: 'info', message: 'npm version: 10.2.4', section: 'Node Setup' },
    { lineNumber: 8, timestamp: '2026-08-22T19:50:12Z', type: 'info', message: 'Running npm ci (installing dependencies from lockfile)...', section: 'Install Dependencies' },
    { lineNumber: 9, timestamp: '2026-08-22T19:50:20Z', type: 'info', message: 'npm WARN deprecated inflight@1.0.6: Please use lru-cache instead.', section: 'Install Dependencies' },
    { lineNumber: 10, timestamp: '2026-08-22T19:50:35Z', type: 'info', message: 'npm WARN deprecated rimraf@3.0.2: Use fs.rmSync instead.', section: 'Install Dependencies' },
    { lineNumber: 11, timestamp: '2026-08-22T19:51:28Z', type: 'info', message: 'npm WARN deprecated @types/reach__router@1.3.13: Reach Router is deprecated.', section: 'Install Dependencies' },
    { lineNumber: 12, timestamp: '2026-08-22T19:51:30Z', type: 'info', message: 'npm ERR! code ERESOLVE', section: 'Install Dependencies' },
    { lineNumber: 13, timestamp: '2026-08-22T19:51:30Z', type: 'error', message: 'npm ERR! ERESOLVE unable to resolve dependency tree', section: 'Install Dependencies' },
    { lineNumber: 14, timestamp: '2026-08-22T19:51:30Z', type: 'error', message: 'npm ERR! While resolving: flowforge-frontend@0.1.0', section: 'Install Dependencies' },
    { lineNumber: 15, timestamp: '2026-08-22T19:51:30Z', type: 'error', message: 'npm ERR! Found: react@19.0.0', section: 'Install Dependencies' },
    { lineNumber: 16, timestamp: '2026-08-22T19:51:30Z', type: 'error', message: 'npm ERR! dependency react-router-dom@6.22.3 requires react@^18.0.0', section: 'Install Dependencies' },
    { lineNumber: 17, timestamp: '2026-08-22T19:51:30Z', type: 'error', message: 'npm ERR! To resolve, run: npm install --legacy-peer-deps', section: 'Install Dependencies' },
    { lineNumber: 18, timestamp: '2026-08-22T19:51:31Z', type: 'error', message: 'npm ERR! A complete log of this run can be found in:', section: 'Install Dependencies' },
    { lineNumber: 19, timestamp: '2026-08-22T19:51:31Z', type: 'error', message: 'npm ERR!   /home/runner/.npm/_logs/2026-08-22T19_51_30_912Z-debug-0.log', section: 'Install Dependencies' },
    { lineNumber: 20, timestamp: '2026-08-22T19:52:13Z', type: 'error', message: 'Process completed with exit code 1.', section: 'Clean Up' }
  ],
  'run-54': [
    { lineNumber: 1, timestamp: '2026-08-19T10:10:01Z', type: 'info', message: 'Setup python environment v3.10', section: 'Init' },
    { lineNumber: 2, timestamp: '2026-08-19T10:10:10Z', type: 'info', message: 'Running main.py server...', section: 'Running App' },
    { lineNumber: 3, timestamp: '2026-08-19T10:10:11Z', type: 'error', message: 'Traceback (most recent call last):', section: 'Running App' },
    { lineNumber: 4, timestamp: '2026-08-19T10:10:11Z', type: 'error', message: '  File "main.py", line 4, in <module>', section: 'Running App' },
    { lineNumber: 5, timestamp: '2026-08-19T10:10:11Z', type: 'error', message: '    import yaml', section: 'Running App' },
    { lineNumber: 6, timestamp: '2026-08-19T10:10:11Z', type: 'error', message: 'ModuleNotFoundError: No module named "yaml"', section: 'Running App' },
    { lineNumber: 7, timestamp: '2026-08-19T10:10:45Z', type: 'error', message: 'Process completed with exit code 1.', section: 'Clean Up' }
  ]
};

export const mockFailureAnalysis: Record<string, FailureAnalysis> = {
  'run-184': {
    id: 'an-184',
    runId: 'run-184',
    title: 'Dependency Tree Resolution Failure',
    summary: 'The CI pipeline failed during dependency installation due to incompatible version lock boundaries between React 19.0.0 and React Router Dom v6.22.3, which strict npm peer-resolutions rejected.',
    rootCause: 'A developer updated the package.json file to use React 19.0.0, but react-router-dom@6.22.3 is explicitly typed for React ^18.0.0 in its peerDependencies list. When "npm ci" ran, npm ERESOLVE aborted installation.',
    suggestedFix: 'Run the installation command with `--legacy-peer-deps` parameter, or modify `package.json` to lock React at `^18.3.1` until React Router supports React 19 stably.',
    similarPreviousRunId: 'run-54',
    similarPreviousRunNumber: 54,
    confidence: 96,
    relevantDocs: [
      { title: 'npm ERESOLVE Peer Conflict Docs', url: 'https://docs.npmjs.com/cli/v9/using-npm/developer-guide#eresolve' },
      { title: 'React 19 Upgrade Guide & Peer Resolution', url: 'https://react.dev/blog/2024/04/25/react-19-upgrade-guide' }
    ],
    previousDiscussions: [
      { id: 'disc-1', title: 'React 19 upgrade questions' }
    ]
  },
  'run-54': {
    id: 'an-54',
    runId: 'run-54',
    title: 'Missing Python Package Dependency',
    summary: 'Execution failed when loading the main script because PyYAML (yaml package) was imported but not listed in requirements.txt or installed.',
    rootCause: 'The commit eeddccbbaa9988 imported the "yaml" parser library but forgot to add "PyYAML>=6.0" to requirements.txt.',
    suggestedFix: 'Append "PyYAML>=6.0" into the requirements.txt file and push to main.',
    confidence: 98,
    relevantDocs: [
      { title: 'Python Import Guide', url: 'https://docs.python.org/3/tutorial/modules.html' }
    ],
    previousDiscussions: []
  }
};

export const mockDiscussions: Record<string, Discussion[]> = {
  'repo-1': [
    {
      id: 'disc-1',
      repoId: 'repo-1',
      runId: 'run-184',
      runNumber: 184,
      title: 'Dependency installation failing on main with React 19 peer conflict',
      author: mockUsers['usr-1'],
      status: 'open',
      createdAt: '2026-08-22T20:00:00Z',
      updatedAt: '2026-08-22T20:10:00Z',
      participants: [mockUsers['usr-1'], mockUsers['usr-2'], mockUsers['usr-4']],
      commentsCount: 3
    },
    {
      id: 'disc-2',
      repoId: 'repo-1',
      title: 'RAG database connection configuration in production',
      author: mockUsers['usr-4'],
      status: 'open',
      createdAt: '2026-08-21T10:00:00Z',
      updatedAt: '2026-08-21T16:30:00Z',
      participants: [mockUsers['usr-4'], mockUsers['usr-3']],
      commentsCount: 2
    },
    {
      id: 'disc-3',
      repoId: 'repo-1',
      title: 'Fix lint warnings in logs-viewer utility',
      author: mockUsers['usr-3'],
      status: 'resolved',
      createdAt: '2026-08-20T08:00:00Z',
      updatedAt: '2026-08-20T12:00:00Z',
      participants: [mockUsers['usr-3'], mockUsers['usr-2']],
      commentsCount: 4
    }
  ]
};

export const mockComments: Record<string, Comment[]> = {
  'disc-1': [
    {
      id: 'c-1',
      discussionId: 'disc-1',
      author: mockUsers['usr-1'],
      content: 'I upgraded React to version 19 in my branch, but it seems npm ci is failing on main due to React Router peer conflicts. Do we need to downgrade or run with `--legacy-peer-deps`?',
      createdAt: '2026-08-22T20:00:00Z',
      logExcerpt: 'npm ERR! Found: react@19.0.0\nnpm ERR! dependency react-router-dom@6.22.3 requires react@^18.0.0'
    },
    {
      id: 'c-2',
      discussionId: 'disc-1',
      author: mockUsers['usr-2'],
      content: '@bharathi1216 running with legacy peer deps works, but might cause runtime issues. Since React 19 is not fully stable across all our UI libraries, I highly recommend downgrading back to `react@18.3.1` and `react-dom@18.3.1` for now.',
      createdAt: '2026-08-22T20:05:00Z'
    },
    {
      id: 'c-3',
      discussionId: 'disc-1',
      author: {
        id: 'flowforge-ai-bot',
        username: 'flowforge-ai',
        name: 'FlowForge AI',
        avatarUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=150&q=80',
        email: 'bot@flowforge.ai',
        githubUrl: '#'
      },
      content: '### 🤖 FlowForge AI Suggested Action\nI found a similar peer dependency issue resolved in repository **German-Bharatham** (run #142) by reverting the react-compiler peer locks. \n\nI suggest you either:\n1. Update GitHub Actions yaml to run: `npm ci --legacy-peer-deps`\n2. Or update your `package.json` to:\n```json\n"dependencies": {\n  "react": "^18.3.1",\n  "react-dom": "^18.3.1"\n}\n```',
      createdAt: '2026-08-22T20:10:00Z',
      isAISuggestion: true
    }
  ],
  'disc-2': [
    {
      id: 'c-4',
      discussionId: 'disc-2',
      author: mockUsers['usr-4'],
      content: 'We need to move ChromaDB endpoint to run behind our VPC. How should the vector client connect now?',
      createdAt: '2026-08-21T10:00:00Z'
    },
    {
      id: 'c-5',
      discussionId: 'disc-2',
      author: mockUsers['usr-3'],
      content: 'I will modify the deployment manifest to set the `CHROMADB_URL` environment variable to use the local DNS cluster name.',
      createdAt: '2026-08-21T16:30:00Z'
    }
  ]
};

export const mockKnowledgeBase: Record<string, KnowledgeItem[]> = {
  'repo-1': [
    {
      id: 'ki-1',
      repoId: 'repo-1',
      errorType: 'ModuleNotFoundError (yaml)',
      occurrences: 4,
      lastResolvedAt: '3 days ago',
      suggestedFix: 'Run `pip install PyYAML` or add `PyYAML` to `requirements.txt` to solve standard YAML parsing failures.',
      category: 'failure'
    },
    {
      id: 'ki-2',
      repoId: 'repo-1',
      errorType: 'npm ERR! code ERESOLVE',
      occurrences: 7,
      lastResolvedAt: 'Active now',
      suggestedFix: 'Triggered when installing peer-restricted React versions. Can be resolved by setting `npm ci --legacy-peer-deps` or matching react peer package expectations.',
      similarRunId: 'run-184',
      similarRunNumber: 184,
      category: 'failure'
    },
    {
      id: 'ki-3',
      repoId: 'repo-1',
      errorType: 'Vite config build path',
      occurrences: 2,
      lastResolvedAt: '1 week ago',
      suggestedFix: 'Make sure build output directory is matching with the deployment settings. Vite base directory must match `dist/` and not `build/`.',
      category: 'docs'
    }
  ]
};

export const mockNotifications: Notification[] = [
  {
    id: 'nt-1',
    type: 'failure',
    title: 'Workflow Run #184 Failed',
    message: 'Build and Test failed on branch main. AI detected a dependency peer lock error.',
    repoId: 'repo-1',
    repoName: 'FlowForge-AI',
    runId: 'run-184',
    isRead: false,
    createdAt: '2 mins ago'
  },
  {
    id: 'nt-2',
    type: 'mention',
    title: 'Sarah Connor mentioned you',
    message: 'Sarah mentioned you in "Dependency installation failing on main with React 19 peer conflict".',
    repoId: 'repo-1',
    repoName: 'FlowForge-AI',
    discussionId: 'disc-1',
    isRead: false,
    createdAt: '5 mins ago'
  },
  {
    id: 'nt-3',
    type: 'resolution',
    title: 'Discussion resolved',
    message: 'Alex Rivera marked "Fix lint warnings in logs-viewer utility" as resolved.',
    repoId: 'repo-1',
    repoName: 'FlowForge-AI',
    discussionId: 'disc-3',
    isRead: true,
    createdAt: '2 days ago'
  }
];

export const mockReleases: Record<string, Release[]> = {
  'repo-1': [
    {
      id: 'rel-1',
      repoId: 'repo-1',
      version: 'v1.2.0',
      name: 'RAG Pipeline Integration & Dashboard v1.2',
      tagName: 'v1.2.0',
      publishedAt: '2 days ago',
      prCount: 15,
      commitCount: 42,
      author: mockUsers['usr-4'],
      aiSummary: {
        features: [
          'Added Vector indexer utilizing ChromaDB for repository knowledge extraction.',
          'Created initial RAG failure analysis visual representation graph.',
          'Integrated sidebar repository quick switcher dropdown.'
        ],
        fixes: [
          'Resolved layout shifting issues in terminal logs component.',
          'Fixed memory leaks in SSE telemetry watcher.'
        ],
        breaking: [
          'Requires new configuration variables CHROMADB_URL and GEMINI_API_KEY in server secrets.'
        ],
        changes: [
          'Updated node.js builder image from Node v18 to Node v20 in CI workflows.'
        ]
      }
    },
    {
      id: 'rel-2',
      repoId: 'repo-1',
      version: 'v1.1.0',
      name: 'Mock Service layer & Multi-theme v1.1',
      tagName: 'v1.1.0',
      publishedAt: '1 week ago',
      prCount: 8,
      commitCount: 22,
      author: mockUsers['usr-1']
    }
  ]
};

export const mockOnboardingGuide = {
  title: 'FlowForge AI Repository Onboarding',
  overview: 'FlowForge AI is an intelligent workspace that pulls failure context from GitHub Actions workflows, links them with previous developer chats and wikis using RAG, and serves them to the engineering team.',
  architecture: 'The system has a React/Vite/TS SPA frontend that interacts with a FastAPI backend. Backed by Celery tasks, Redis queue, and a PostgreSQL storage layer. ChromaDB stores semantic vector data to search previous fixes.',
  importantModules: [
    { name: 'src/services/', description: 'Client interfaces that handle backend API requests' },
    { name: 'src/mock/', description: 'Local developer sandbox datasets' },
    { name: 'src/contexts/ThemeContext.tsx', description: 'Handles custom theme configurations and style accent hooks' }
  ],
  commonProblems: [
    { issue: 'ERESOLVE tree conflicts', fix: 'Add legacy-peer-deps to installation processes when adding conflicting third-party components.' },
    { issue: 'ModuleNotFoundError (yaml)', fix: 'Import PyYAML package inside requirements.txt.' }
  ],
  currentWork: 'Integrating complete live connection workflows with real GitHub webhook endpoints.'
};

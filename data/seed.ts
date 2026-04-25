export type PermValue = boolean | 'ask';

export interface Agent {
  id: string;
  name: string;
  mono: string;
  tint: string;
  role: string;
  host: string;
  online: boolean;
  paired: string;
  folders: boolean;
  perms: { read: PermValue; write: PermValue; shell: PermValue; network: PermValue };
  notifs: { approvals: string; completions: string; mentions: string };
  sessionKey?: string;
  port?: number;
}

export interface DiffLine {
  type: 'plus' | 'minus' | 'plain';
  text: string;
}

export interface Message {
  id: number;
  role: 'user' | 'agent' | 'tool' | 'approval';
  text?: string;
  // tool
  name?: string;
  arg?: string;
  status?: string;
  result?: string;
  // approval
  tool?: string;
  summary?: string;
  risk?: string;
  files?: string[];
  diff?: DiffLine[];
  t?: string;
}

export interface Thread {
  id: string;
  agentId: string;
  title: string;
  folder: string | null;
  updatedMin: number;
  unread: number;
  preview: string;
  messages: Message[];
}

export interface Alert {
  id: string;
  kind: 'ask' | 'info';
  agentId: string;
  threadId: string;
  title: string;
  when: string;
}

export const SEED_AGENTS: Agent[] = __DEV__ ? DEMO_AGENTS() : [];
export const SEED_THREADS: Thread[] = __DEV__ ? DEMO_THREADS() : [];

function DEMO_AGENTS(): Agent[] { return [
  {
    id: 'grep', name: 'Grep Norton', mono: 'GN', tint: '#EADFC5',
    role: 'code · detective', host: 'mbp-noah.local', online: true, paired: '12d', folders: false,
    perms: { read: true, write: 'ask', shell: 'ask', network: true },
    notifs: { approvals: 'push+sound', completions: 'silent', mentions: 'push' },
  },
  {
    id: 'shell', name: 'Sir Shellsworth', mono: 'SS', tint: '#E9D1CA',
    role: 'ops · butler', host: 'prod-deploy-01', online: true, paired: '3w', folders: true,
    perms: { read: true, write: 'ask', shell: 'ask', network: true },
    notifs: { approvals: 'push+sound', completions: 'push', mentions: 'push' },
  },
  {
    id: 'monet', name: 'Claude Monet', mono: 'CM', tint: '#D6E0CE',
    role: 'writing · artsy', host: 'cloud-us-west', online: true, paired: '1mo', folders: false,
    perms: { read: true, write: true, shell: false, network: true },
    notifs: { approvals: 'push', completions: 'silent', mentions: 'push' },
  },
  {
    id: 'query', name: 'Sheryl Query', mono: 'SQ', tint: '#CCD8E3',
    role: 'data · sleuth', host: 'warehouse.io', online: false, paired: '2mo', folders: false,
    perms: { read: true, write: false, shell: false, network: true },
    notifs: { approvals: 'push', completions: 'silent', mentions: 'push' },
  },
  {
    id: 'paws', name: 'Paw Patrol', mono: 'PP', tint: '#E4D4E6',
    role: 'notes · archivist', host: 'meeting.local', online: false, paired: '10d', folders: false,
    perms: { read: true, write: 'ask', shell: false, network: false },
    notifs: { approvals: 'push', completions: 'silent', mentions: 'silent' },
  },
]; }

function DEMO_THREADS(): Thread[] { return [
  {
    id: 'grep-1', agentId: 'grep', title: 'auth refactor', folder: 'Work',
    updatedMin: 2, unread: 1, preview: '"want me to rotate the secret?"',
    messages: [
      { id: 1, role: 'user', text: 'clean up how we store tokens, pls', t: '-14m' },
      { id: 2, role: 'agent', text: 'On it. Checking where tokens are referenced.', t: '-14m' },
      { id: 3, role: 'tool', name: 'grep', arg: '"KEY|TOKEN"', status: 'done', result: '8 hits across 5 files', t: '-13m' },
      { id: 4, role: 'agent', text: "3 files touch it. I'll consolidate into auth/keys.ts, rotate the secret, and update 2 call sites.", t: '-12m' },
      {
        id: 5, role: 'approval', tool: 'write_files', summary: 'Write 3 files', risk: 'write',
        files: ['src/auth/keys.ts (new)', 'src/api/login.ts', 'src/api/refresh.ts'],
        diff: [
          { type: 'minus', text: 'const KEY = "legacy-static-key"' },
          { type: 'plus', text: 'const KEY = process.env.AUTH_KEY' },
          { type: 'plus', text: 'export function rotateSecret(prev, next) {…}' },
        ],
        status: 'pending', t: '-2m',
      },
    ],
  },
  {
    id: 'grep-2', agentId: 'grep', title: 'flaky CI', folder: 'Work',
    updatedMin: 12, unread: 0, preview: 'fixed 2, 3 retries left',
    messages: [
      { id: 1, role: 'user', text: "CI's been flaky on auth.test.ts", t: '-22m' },
      { id: 2, role: 'tool', name: 'run_tests', arg: '--retry 3', status: 'done', result: '10/12 passing', t: '-18m' },
      { id: 3, role: 'agent', text: 'Intermittent timeout on 2 tests. Bumped timeouts + retries. Down to 0 failures across 20 runs.', t: '-12m' },
    ],
  },
  {
    id: 'grep-3', agentId: 'grep', title: 'migrate SQLite → PG', folder: 'Infra',
    updatedMin: 61, unread: 0, preview: 'drafted plan, needs review',
    messages: [
      { id: 1, role: 'agent', text: 'Drafted a 3-phase migration plan in /docs/migration.md.', t: '-1h' },
    ],
  },
  {
    id: 'grep-4', agentId: 'grep', title: 'tidy utils/', folder: 'Cleanup',
    updatedMin: 60 * 24, unread: 0, preview: 'renamed 14 files ✓',
    messages: [
      { id: 1, role: 'agent', text: 'Renamed 14 files, updated imports. 0 regressions.', t: 'yday' },
    ],
  },
  {
    id: 'shell-1', agentId: 'shell', title: 'deploy to staging', folder: 'Deploys',
    updatedMin: 4, unread: 1, preview: 'deploy.sh → staging',
    messages: [
      { id: 1, role: 'user', text: 'ship main to staging please', t: '-6m' },
      { id: 2, role: 'tool', name: 'git', arg: 'pull origin main', status: 'done', result: '2 new commits', t: '-5m' },
      { id: 3, role: 'tool', name: 'build', arg: 'npm run build', status: 'done', result: 'bundle 2.1MB', t: '-5m' },
      { id: 4, role: 'agent', text: 'Build green. Ready to ship to staging?', t: '-4m' },
      {
        id: 5, role: 'approval', tool: 'shell', summary: 'Run deploy.sh staging', risk: 'shell',
        files: ['./scripts/deploy.sh staging'],
        diff: [
          { type: 'plain', text: '$ ssh deploy@staging.internal' },
          { type: 'plain', text: '$ systemctl restart clawface-api' },
        ],
        status: 'pending', t: '-4m',
      },
    ],
  },
  {
    id: 'shell-2', agentId: 'shell', title: 'rotate SSH keys', folder: 'Security',
    updatedMin: 60 * 3, unread: 0, preview: 'rotated, confirmed',
    messages: [
      { id: 1, role: 'agent', text: 'Rotated SSH keys on all 4 hosts. Old keys revoked.', t: '-3h' },
    ],
  },
  {
    id: 'monet-1', agentId: 'monet', title: 'landing copy v2', folder: null,
    updatedMin: 14, unread: 0, preview: 'draft 2 ready',
    messages: [
      { id: 1, role: 'agent', text: 'Draft 2 — tighter hook, fewer adjectives. Want me to mock headline variants?', t: '-14m' },
    ],
  },
  {
    id: 'monet-2', agentId: 'monet', title: 'brand voice review', folder: null,
    updatedMin: 55, unread: 1, preview: 'A / B / C — which tone?',
    messages: [
      { id: 1, role: 'agent', text: 'Which tone feels closest? A: warm/plain · B: punchy/technical · C: calm/measured', t: '-55m' },
    ],
  },
  {
    id: 'query-1', agentId: 'query', title: 'Q3 revenue', folder: null,
    updatedMin: 60, unread: 0, preview: 'summary ready',
    messages: [
      { id: 1, role: 'agent', text: 'Q3: $1.24M, +18% QoQ. Driven by SMB segment (+42%).', t: '-1h' },
    ],
  },
  {
    id: 'paws-1', agentId: 'paws', title: 'Mon standup notes', folder: null,
    updatedMin: 60 * 24, unread: 0, preview: 'archived',
    messages: [
      { id: 1, role: 'agent', text: 'Notes archived in /docs/standups/2026-04-21.md', t: 'yday' },
    ],
  },
]; }

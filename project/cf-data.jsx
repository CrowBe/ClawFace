// cf-data.jsx — seed state for ClawFace

const CF_AGENTS = [
  { id: 'grep',  name: 'Grep Norton',     role: 'code · detective',   tint: '#FBE9D1', mono: 'G', host: 'mbp-noah.local',   online: true,  paired: '12d ago' },
  { id: 'shell', name: 'Sir Shellsworth', role: 'ops · butler',       tint: '#F4D7CE', mono: 'S', host: 'prod-box-01',      online: true,  paired: '3w ago' },
  { id: 'monet', name: 'Claude Monet',    role: 'writing · artsy',    tint: '#E0E8D0', mono: 'M', host: 'studio.local',     online: true,  paired: '1mo ago' },
  { id: 'query', name: 'Sheryl Query',    role: 'data · sleuth',      tint: '#D4DDEA', mono: 'Q', host: 'warehouse-jump',   online: false, paired: '2mo ago' },
  { id: 'paw',   name: 'Paw Patrol',      role: 'notes · archivist',  tint: '#E9DDEA', mono: 'P', host: 'iphone-sync',      online: true,  paired: '5d ago' },
];

const CF_THREADS = {
  grep: [
    { id: 'auth',    title: 'auth refactor',       last: '"want me to rotate the secret?"', updated: '2m',  unread: 0, asking: true,  folder: 'active' },
    { id: 'ci',      title: 'flaky CI',            last: 'fixed 2 / 3 retries left',        updated: '12m', unread: 3, asking: false, folder: 'active' },
    { id: 'pg',      title: 'migrate SQLite → PG', last: 'drafted plan · needs review',     updated: '1h',  unread: 0, asking: false, folder: 'active' },
    { id: 'tidy',    title: 'tidy utils/',         last: 'renamed 14 files ✓',              updated: 'yday',unread: 0, asking: false, folder: 'done' },
    { id: 'perf',    title: 'perf regressions',    last: 'found the culprit in prod',       updated: '3d',  unread: 0, asking: false, folder: 'done' },
  ],
  shell: [
    { id: 'deploy',  title: 'deploy staging',      last: 'ready to ship to staging?',       updated: '4m',  unread: 1, asking: true,  folder: 'active' },
    { id: 'keys',    title: 'rotate SSH keys',     last: 'rotated · all hosts healthy',     updated: '3h',  unread: 0, asking: false, folder: 'done' },
  ],
  monet: [
    { id: 'land',    title: 'landing copy',        last: 'draft 2 ready for review',        updated: '14m', unread: 1, asking: false, folder: 'active' },
    { id: 'hero',    title: 'hero illustration',   last: 'tried 3 directions',              updated: '2h',  unread: 0, asking: false, folder: 'active' },
  ],
  query: [
    { id: 'q3',      title: 'Q3 revenue summary',  last: 'report ready',                    updated: '1h',  unread: 0, asking: false, folder: 'done' },
  ],
  paw: [
    { id: 'allhands',title: 'all-hands notes',     last: 'summary drafted',                 updated: '25m', unread: 1, asking: false, folder: 'active' },
  ],
};

const CF_MESSAGES = {
  'grep/auth': [
    { role: 'me',    text: 'clean up how we store tokens, pls' },
    { role: 'agent', text: "on it. checking where tokens get referenced…" },
    { role: 'tool',  name: 'grep',  args: '"KEY|TOKEN"', result: '8 hits in 3 files' },
    { role: 'agent', text: "3 files touch it. i'll consolidate into auth/keys.ts. ready to write?" },
    { role: 'ask',   title: 'Write 3 files?',
      files: ['src/auth/keys.ts', 'src/api/login.ts', 'src/api/refresh.ts'],
      diff: [
        { k: '+', text: 'export const getToken = () => keyring.read("access")' },
        { k: '-', text: 'const TOKEN = process.env.TOKEN' },
        { k: '+', text: 'import { getToken } from "./auth/keys"' },
      ],
    },
  ],
  'shell/deploy': [
    { role: 'me',    text: 'ship the latest to staging when tests pass' },
    { role: 'agent', text: 'all tests green. ran build · image built in 42s.' },
    { role: 'tool',  name: 'build', args: 'docker build .', result: 'image sha256:a3f…7e2' },
    { role: 'ask',   title: 'Run deploy.sh on staging?',
      files: ['scripts/deploy.sh --env staging'],
      diff: [],
    },
  ],
  'grep/ci': [
    { role: 'me',    text: 'why is CI flaking?' },
    { role: 'agent', text: 'three tests were time-sensitive. bumped timeout, mocked clock.' },
    { role: 'tool',  name: 'run',   args: 'pytest -k flaky', result: '2 passed, 1 skipped' },
    { role: 'agent', text: 'two fixed, one left. want me to rewrite that last one?' },
  ],
  'monet/land': [
    { role: 'me',    text: 'new angle for the landing page, focus on reliability' },
    { role: 'agent', text: "here's draft 2 — plainspoken, less marketing speak." },
  ],
};

const CF_ALERTS = [
  { id: 'a1', kind: 'ask',  agent: 'shell', thread: 'deploy',  title: 'Run deploy.sh on staging?',    when: 'now' },
  { id: 'a2', kind: 'ask',  agent: 'grep',  thread: 'auth',    title: 'Write 3 files · auth refactor', when: '6m' },
  { id: 'a3', kind: 'info', agent: 'monet', thread: 'land',    title: 'Draft 2 of landing copy ready',  when: '14m' },
  { id: 'a4', kind: 'info', agent: 'grep',  thread: 'ci',      title: 'Fixed 2 flaky tests ✓',          when: '22m' },
  { id: 'a5', kind: 'info', agent: 'query', thread: 'q3',      title: 'Q3 revenue summary ready',       when: '1h' },
  { id: 'a6', kind: 'info', agent: 'shell', thread: 'keys',    title: 'Rotated SSH keys',               when: '3h' },
];

Object.assign(window, { CF_AGENTS, CF_THREADS, CF_MESSAGES, CF_ALERTS });

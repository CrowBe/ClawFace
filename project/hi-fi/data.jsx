// Data store for ClawFace hi-fi prototype
// Exposes window.CF = { useStore, actions, useRoute, navigate, back }

const { useState, useEffect, useRef, useSyncExternalStore, useMemo } = React;

// ── tiny pub-sub store ─────────────────────────────────
function createStore(initial) {
  let state = initial;
  const listeners = new Set();
  return {
    get: () => state,
    set: (updater) => {
      state = typeof updater === 'function' ? updater(state) : { ...state, ...updater };
      listeners.forEach(l => l());
    },
    subscribe: (l) => { listeners.add(l); return () => listeners.delete(l); },
  };
}

// ── seed ───────────────────────────────────────────────
const SEED_AGENTS = [
  { id: 'grep', name: 'Grep Norton', mono: 'G', tint: '#F4E4C7', role: 'code · detective', host: 'mbp-noah.local', online: true, paired: '12d', folders: false,
    perms: { read: true, write: 'ask', shell: 'ask', network: true },
    notifs: { approvals: 'push+sound', completions: 'silent', mentions: 'push' } },
  { id: 'shell', name: 'Sir Shellsworth', mono: 'S', tint: '#EED5CF', role: 'ops · butler', host: 'prod-deploy-01', online: true, paired: '3w',  folders: true,
    perms: { read: true, write: 'ask', shell: 'ask', network: true },
    notifs: { approvals: 'push+sound', completions: 'push', mentions: 'push' } },
  { id: 'monet', name: 'Claude Monet', mono: 'M', tint: '#D9E4D2', role: 'gen · artsy',    host: 'cloud-us-west', online: true, paired: '1mo', folders: false,
    perms: { read: true, write: true, shell: false, network: true },
    notifs: { approvals: 'push', completions: 'silent', mentions: 'push' } },
  { id: 'query', name: 'Sheryl Query', mono: 'Q', tint: '#D4DDE8', role: 'data · sleuth',   host: 'warehouse.io',  online: false, paired: '2mo', folders: false,
    perms: { read: true, write: false, shell: false, network: true },
    notifs: { approvals: 'push', completions: 'silent', mentions: 'push' } },
];

// messages: {id, role: 'user'|'agent'|'tool'|'approval', ...}
const SEED_THREADS = [
  { id: 'grep-1', agentId: 'grep', title: 'auth refactor', folder: 'Work', updatedMin: 2, unread: 1, preview: "want me to rotate the secret?",
    messages: [
      { id: 1, role: 'user', text: "clean up how we store tokens, pls", t: '-14m' },
      { id: 2, role: 'agent', text: "On it. Checking where tokens are referenced.", t: '-14m' },
      { id: 3, role: 'tool', name: 'grep', arg: '"KEY|TOKEN"', status: 'done', result: '8 hits across 5 files', t: '-13m' },
      { id: 4, role: 'agent', text: "3 files touch it. I'll consolidate into auth/keys.ts, rotate the secret, and update 2 call sites.", t: '-12m' },
      { id: 5, role: 'approval', tool: 'write_files', summary: 'Write 3 files', risk: 'write',
        files: ['src/auth/keys.ts (new)', 'src/api/login.ts', 'src/api/refresh.ts'],
        diff: [
          { type: 'minus', text: 'const KEY = "legacy-static-key"' },
          { type: 'plus', text: 'const KEY = process.env.AUTH_KEY' },
          { type: 'plus', text: 'export function rotateSecret(prev, next) {…}' },
        ],
        status: 'pending', t: '-2m' },
    ]
  },
  { id: 'grep-2', agentId: 'grep', title: 'flaky CI', folder: 'Work', updatedMin: 12, unread: 0, preview: "fixed 2, 3 retries left",
    messages: [
      { id: 1, role: 'user', text: "CI's been flaky on auth.test.ts", t: '-22m' },
      { id: 2, role: 'tool', name: 'run_tests', arg: '--retry 3', status: 'done', result: '10/12 passing', t: '-18m' },
      { id: 3, role: 'agent', text: "Intermittent timeout on 2 tests. Bumped timeouts + added retries. Down to 0 failures across 20 runs.", t: '-12m' },
    ]
  },
  { id: 'grep-3', agentId: 'grep', title: 'migrate SQLite → PG', folder: 'Infra', updatedMin: 61, unread: 0, preview: "drafted plan, needs review",
    messages: [
      { id: 1, role: 'agent', text: "Drafted a 3-phase migration plan in /docs/migration.md.", t: '-1h' },
    ]
  },
  { id: 'grep-4', agentId: 'grep', title: 'tidy utils/', folder: 'Cleanup', updatedMin: 60*24, unread: 0, preview: "renamed 14 files ✓",
    messages: [
      { id: 1, role: 'agent', text: "Renamed 14 files, updated imports. 0 regressions.", t: 'yday' },
    ]
  },
  { id: 'shell-1', agentId: 'shell', title: 'deploy to staging', folder: 'Deploys', updatedMin: 4, unread: 1, preview: "deploy.sh → staging",
    messages: [
      { id: 1, role: 'user', text: "ship main to staging please", t: '-6m' },
      { id: 2, role: 'tool', name: 'git', arg: 'pull origin main', status: 'done', result: '2 new commits', t: '-5m' },
      { id: 3, role: 'tool', name: 'build', arg: 'npm run build', status: 'done', result: 'bundle 2.1MB', t: '-5m' },
      { id: 4, role: 'agent', text: "Build green. Ready to ship to staging?", t: '-4m' },
      { id: 5, role: 'approval', tool: 'shell', summary: 'Run deploy.sh staging', risk: 'shell',
        files: ['./scripts/deploy.sh staging'],
        diff: [
          { type: 'plain', text: '$ ssh deploy@staging.internal' },
          { type: 'plain', text: '$ systemctl restart clawface-api' },
        ],
        status: 'pending', t: '-4m' },
    ]
  },
  { id: 'shell-2', agentId: 'shell', title: 'rotate SSH keys', folder: 'Security', updatedMin: 60*3, unread: 0, preview: "rotated, confirmed",
    messages: [
      { id: 1, role: 'agent', text: "Rotated SSH keys on all 4 hosts. Old keys revoked.", t: '-3h' },
    ]
  },
  { id: 'monet-1', agentId: 'monet', title: 'landing copy v2', folder: null, updatedMin: 14, unread: 0, preview: "draft 2 ready",
    messages: [
      { id: 1, role: 'agent', text: "Draft 2 — tighter hook, fewer adjectives. Want me to mock headline variants?", t: '-14m' },
    ]
  },
  { id: 'monet-2', agentId: 'monet', title: 'brand voice review', folder: null, updatedMin: 55, unread: 1, preview: "A / B / C — which tone?",
    messages: [
      { id: 1, role: 'agent', text: "Which tone feels closest? A: warm/plain · B: punchy/technical · C: calm/measured", t: '-55m' },
    ]
  },
  { id: 'query-1', agentId: 'query', title: 'Q3 revenue', folder: null, updatedMin: 60, unread: 0, preview: "summary ready",
    messages: [
      { id: 1, role: 'agent', text: "Q3: $1.24M, +18% QoQ. Driven by SMB segment (+42%).", t: '-1h' },
    ]
  },
];

const initial = {
  agents: SEED_AGENTS,
  threads: SEED_THREADS,
  currentAgentId: 'grep',
  route: { name: 'agents' }, // {name, params}
  history: [],
  showDrawer: false,
  showPair: false,
  showTweaks: false,
  chatMenuForThread: null,
  tweaks: {
    autoApproveReadOnly: false,
    folderViewDefault: false,
  },
  toast: null,
};

const store = createStore(initial);

// ── hooks ──────────────────────────────────────────────
function useStore(selector = s => s) {
  return useSyncExternalStore(store.subscribe, () => selector(store.get()));
}

// ── navigation ─────────────────────────────────────────
function navigate(route, opts = {}) {
  store.set(s => ({
    ...s,
    history: opts.replace ? s.history : [...s.history, s.route],
    route,
    showDrawer: false,
    chatMenuForThread: null,
  }));
}
function back() {
  store.set(s => {
    if (s.history.length === 0) return s;
    const prev = s.history[s.history.length - 1];
    return { ...s, route: prev, history: s.history.slice(0, -1), chatMenuForThread: null };
  });
}

// ── actions ────────────────────────────────────────────
const actions = {
  setAgent: (id) => store.set({ currentAgentId: id, showDrawer: false }),
  toggleDrawer: (v) => store.set(s => ({ showDrawer: v ?? !s.showDrawer })),
  togglePair: (v) => store.set(s => ({ showPair: v ?? !s.showPair })),
  toggleTweaks: (v) => store.set(s => ({ showTweaks: v ?? !s.showTweaks })),
  openChatMenu: (tid) => store.set({ chatMenuForThread: tid }),
  closeChatMenu: () => store.set({ chatMenuForThread: null }),
  openThread: (tid) => {
    // mark read
    store.set(s => ({
      threads: s.threads.map(t => t.id === tid ? { ...t, unread: 0 } : t),
    }));
    navigate({ name: 'chat', params: { threadId: tid } });
  },
  setAgentFolders: (aid, v) => store.set(s => ({
    agents: s.agents.map(a => a.id === aid ? { ...a, folders: v } : a),
  })),
  setAgentPerm: (aid, key, val) => store.set(s => ({
    agents: s.agents.map(a => a.id === aid ? { ...a, perms: { ...a.perms, [key]: val } } : a),
  })),
  resolveApproval: (threadId, msgId, decision) => {
    store.set(s => ({
      threads: s.threads.map(t => {
        if (t.id !== threadId) return t;
        const updated = t.messages.map(m => m.id === msgId ? { ...m, status: decision } : m);
        // add an agent follow-up
        if (decision === 'approved') {
          updated.push({ id: Date.now(), role: 'agent', text: 'Approved — running now.', t: 'just now' });
        } else {
          updated.push({ id: Date.now(), role: 'agent', text: 'Canceled. Let me know what to change.', t: 'just now' });
        }
        return { ...t, messages: updated };
      }),
      toast: decision === 'approved' ? 'Approved' : 'Denied',
    }));
    setTimeout(() => store.set({ toast: null }), 1800);
  },
  sendMessage: (threadId, text) => {
    if (!text.trim()) return;
    store.set(s => ({
      threads: s.threads.map(t => {
        if (t.id !== threadId) return t;
        const msgs = [...t.messages, { id: Date.now(), role: 'user', text, t: 'now' }];
        return { ...t, messages: msgs, updatedMin: 0 };
      }),
    }));
    // fake agent reply
    setTimeout(() => {
      store.set(s => ({
        threads: s.threads.map(t => {
          if (t.id !== threadId) return t;
          const msgs = [...t.messages, { id: Date.now()+1, role: 'agent', text: 'Got it — on it.', t: 'now' }];
          return { ...t, messages: msgs };
        }),
      }));
    }, 900);
  },
  addAgent: (name) => {
    const id = 'new-' + Date.now();
    const agent = {
      id, name, mono: name[0].toUpperCase(),
      tint: '#E4DBEC', role: 'newly paired', host: 'unknown-host',
      online: true, paired: 'just now', folders: false,
      perms: { read: true, write: 'ask', shell: 'ask', network: true },
      notifs: { approvals: 'push+sound', completions: 'silent', mentions: 'push' },
    };
    store.set(s => ({ agents: [...s.agents, agent], currentAgentId: id, showPair: false, toast: `Paired ${name}` }));
    setTimeout(() => store.set({ toast: null }), 2200);
    navigate({ name: 'threads', params: { agentId: id } });
  },
  setTweak: (k, v) => store.set(s => ({ tweaks: { ...s.tweaks, [k]: v } })),
  renameAgent: (aid, name) => store.set(s => ({
    agents: s.agents.map(a => a.id === aid ? { ...a, name, mono: name[0].toUpperCase() } : a),
  })),
};

// selectors
const sel = {
  agents: (s) => s.agents,
  currentAgent: (s) => s.agents.find(a => a.id === s.currentAgentId),
  threadsFor: (aid) => (s) => s.threads.filter(t => t.agentId === aid),
  thread: (tid) => (s) => s.threads.find(t => t.id === tid),
  pendingApprovals: (s) => {
    const out = [];
    s.threads.forEach(t => {
      t.messages.forEach(m => {
        if (m.role === 'approval' && m.status === 'pending') {
          out.push({ thread: t, msg: m, agent: s.agents.find(a => a.id === t.agentId) });
        }
      });
    });
    return out;
  },
  agentsWithPending: (s) => {
    const set = new Set();
    s.threads.forEach(t => {
      t.messages.forEach(m => {
        if (m.role === 'approval' && m.status === 'pending') set.add(t.agentId);
      });
    });
    return set;
  },
};

window.CF = { store, useStore, actions, navigate, back, sel };

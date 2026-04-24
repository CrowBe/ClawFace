// cf-shell.jsx — tokens, data, icons, avatars, root

const CF_COLORS = {
  bg: '#FAF7F0',
  surface: '#FFFFFF',
  surface2: '#F2EEE4',
  surface3: '#E7E2D3',
  border: '#E7E2D3',
  borderStrong: '#D0C9B7',
  ink: '#1A1816',
  ink2: '#48443D',
  muted: '#8A8474',
  accent: '#C8531C',
  accentSoft: '#FBEADD',
  accentInk: '#8A3810',
  success: '#3F8A5B',
  successSoft: '#E4F0E8',
  warn: '#B07A11',
  warnSoft: '#F6EBCC',
  danger: '#B23B2A',
};

const CFIcon = {
  menu: (c) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg>,
  plus: (c) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>,
  back: (c) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>,
  chev: (c) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"><path d="M9 6l6 6-6 6"/></svg>,
  dots: (c) => <svg width="20" height="20" viewBox="0 0 24 24" fill={c}><circle cx="5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="19" cy="12" r="1.7"/></svg>,
  search: (c) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>,
  send: (c) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>,
  check: (c) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7"/></svg>,
  x: (c) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>,
  tool: (c) => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"><path d="M14 6l7 7-7 7M3 13h18"/></svg>,
  // tab icons
  tAgents: (c) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8"><circle cx="12" cy="8" r="3.5"/><path d="M4 20c0-4 4-6 8-6s8 2 8 6"/></svg>,
  tAlerts: (c) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round"><path d="M6 9a6 6 0 0 1 12 0v4l1.5 3h-15L6 13z"/><path d="M10 19a2 2 0 0 0 4 0"/></svg>,
  tMe: (c) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8"><circle cx="12" cy="9" r="3.5"/><path d="M5 20c1-4 4-5 7-5s6 1 7 5"/></svg>,
};

function CFAvatar({ agent, size = 40, dot }) {
  if (!agent) return null;
  const r = Math.round(size * 0.32);
  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <div style={{
        width: size, height: size, borderRadius: r,
        background: agent.tint, color: agent.inkOnTint || CF_COLORS.ink,
        display: 'grid', placeItems: 'center',
        fontFamily: '-apple-system, system-ui', fontWeight: 600,
        fontSize: size * 0.4, letterSpacing: -0.5,
      }}>{agent.mono}</div>
      {dot && dot !== 'off' && (
        <div style={{
          position: 'absolute', bottom: -2, right: -2,
          width: size * 0.3, height: size * 0.3, borderRadius: '50%',
          background: dot === 'online' ? CF_COLORS.success : dot === 'ask' ? CF_COLORS.accent : CF_COLORS.muted,
          border: `2px solid ${CF_COLORS.bg}`,
        }} />
      )}
    </div>
  );
}

// Seed data
const CF_AGENTS = [
  { id: 'grep',  name: 'Grep Norton',      mono: 'GN', tint: '#EADFC5', role: 'code · bug finder',   online: true,  host: 'mbp-noah.local', paired: '12d ago' },
  { id: 'shell', name: 'Sir Shellsworth',  mono: 'SS', tint: '#E9D1CA', role: 'ops · butler',         online: true,  host: 'prod-a.tunnel',  paired: '28d ago' },
  { id: 'monet', name: 'Claude Monet',     mono: 'CM', tint: '#D6E0CE', role: 'writing · illustration', online: true, host: 'ws.studio', paired: '5d ago' },
  { id: 'query', name: 'Sheryl Query',     mono: 'SQ', tint: '#CCD8E3', role: 'data · sleuth',        online: false, host: 'warehouse',      paired: '3w ago' },
  { id: 'paws',  name: 'Paw Patrol',       mono: 'PP', tint: '#E4D4E6', role: 'notes · archivist',    online: false, host: 'meeting.local',  paired: '10d ago' },
];

const CF_THREADS = {
  grep: [
    { id: 'auth-refactor', title: 'auth refactor', last: '"want me to rotate the secret?"', updated: '2m', unread: 1, asking: true, folder: 'active' },
    { id: 'flaky-ci',      title: 'flaky CI',      last: 'fixed 2 / 3 retries left',        updated: '12m', unread: 3, folder: 'active' },
    { id: 'sqlite-pg',     title: 'migrate SQLite → PG', last: 'drafted plan · needs review', updated: '1h', unread: 0, folder: 'active' },
    { id: 'tidy-utils',    title: 'tidy utils/',   last: 'renamed 14 files ✓',              updated: 'yday', unread: 0, folder: 'done' },
    { id: 'type-audit',    title: 'type audit',    last: 'closed — shipped',                updated: '3d', unread: 0, folder: 'done' },
  ],
  shell: [
    { id: 'deploy-prod', title: 'deploy to staging', last: '"ready to ship?"', updated: '4m', unread: 1, asking: true, folder: 'active' },
    { id: 'ssh-rotate',  title: 'rotate SSH keys',   last: 'done · 3 hosts',    updated: '3h', unread: 0, folder: 'done' },
  ],
  monet: [
    { id: 'landing-copy', title: 'landing copy',  last: 'draft 2 ready for review',        updated: '14m', unread: 1, folder: 'active' },
    { id: 'brand-voice',  title: 'brand voice notes', last: 'snarky but warm, not smarmy', updated: '2h', unread: 0, folder: 'active' },
  ],
  query: [
    { id: 'q3-revenue', title: 'Q3 revenue summary', last: 'ready · tap to open',  updated: '1h', unread: 2, folder: 'active' },
  ],
  paws: [
    { id: 'standup-notes', title: 'Mon standup notes', last: 'archived', updated: 'Mon', unread: 0, folder: 'done' },
  ],
};

const CF_MESSAGES = {
  'grep/auth-refactor': [
    { role: 'me',    text: 'clean up how we store tokens, please' },
    { role: 'agent', text: "On it. Let me find where tokens are referenced…" },
    { role: 'tool',  name: 'grep', args: '"KEY|TOKEN"', result: '8 hits' },
    { role: 'agent', text: "3 files touch them. I'll consolidate into auth/keys.ts. Ready to write?" },
    { role: 'ask',   title: 'Write 3 files', files: ['src/auth/keys.ts', 'src/api/login.ts', 'src/api/refresh.ts'],
      diff: [{k: '-', text: "process.env.JWT_SECRET"}, {k: '+', text: "keys.jwt()"}] },
  ],
  'grep/flaky-ci': [
    { role: 'me', text: 'CI keeps flaking on ImageTest' },
    { role: 'agent', text: 'Looked at the last 10 runs — 2 of 3 retries fix it. Timing-dependent.' },
    { role: 'tool', name: 'read', args: 'tests/image.test.ts', result: 'ok' },
    { role: 'agent', text: "Going to add waitForNextFrame before the pixel check. I'll open a PR."},
    { role: 'resolved', text: 'PR #482 merged · 0 flakes in last 50 runs' },
  ],
  'shell/deploy-prod': [
    { role: 'me',    text: 'deploy the refactor branch to staging pls' },
    { role: 'agent', text: 'Building refactor-auth … (2m 12s). All tests green.' },
    { role: 'tool',  name: 'test', args: 'suite=all', result: '412 passed' },
    { role: 'agent', text: 'Ready to deploy to staging-a.'},
    { role: 'ask',   title: 'Run deploy.sh on staging-a', files: ['script: ops/deploy.sh', 'target: staging-a', 'branch: refactor-auth'] },
  ],
  'monet/landing-copy': [
    { role: 'me', text: 'need headline options for the pricing page' },
    { role: 'agent', text: "Here are 3 — I leaned into the 'predictable, not surprising' angle:" },
    { role: 'agent', text: "1. Pricing that won't send your CFO into therapy.\n2. Flat rates. Sharp tools.\n3. No seats. No tiers. No nonsense." },
  ],
};

const CF_ALERTS = [
  { id: 'a1', kind: 'ask',  agent: 'shell', thread: 'deploy-prod',   title: 'Run deploy.sh on staging-a', when: '4m' },
  { id: 'a2', kind: 'ask',  agent: 'grep',  thread: 'auth-refactor', title: 'Write 3 files — auth refactor', when: '6m' },
  { id: 'a3', kind: 'info', agent: 'monet', thread: 'landing-copy',  title: 'Draft 2 of landing copy ready', when: '14m' },
  { id: 'a4', kind: 'info', agent: 'grep',  thread: 'flaky-ci',      title: 'Fixed 2 flaky tests ✓', when: '22m' },
  { id: 'a5', kind: 'info', agent: 'query', thread: 'q3-revenue',    title: 'Q3 revenue summary ready', when: '1h' },
];

function cfInitialState() {
  return {
    screen: 'agents',
    agentId: 'grep',
    threadId: 'auth-refactor',
    agents: CF_AGENTS,
    threads: CF_THREADS,
    messages: CF_MESSAGES,
    alerts: CF_ALERTS,
    drawerOpen: false,
    agentsView: 'agents', // agents | inbox
    inboxSeen: false,
    tab: 'agents', // agents | alerts | me
  };
}

function cfReducer(s, a) {
  switch (a.type) {
    case 'goTo': {
      const tab = a.screen === 'alerts' ? 'alerts' : a.screen === 'me' ? 'me' : 'agents';
      return { ...s, screen: a.screen, drawerOpen: false, tab };
    }
    case 'setAgent': return { ...s, agentId: a.id };
    case 'setThread': return { ...s, threadId: a.id };
    case 'openDrawer': return { ...s, drawerOpen: true };
    case 'closeDrawer': return { ...s, drawerOpen: false };
    case 'setAgentsView': return { ...s, agentsView: a.v, inboxSeen: s.inboxSeen || a.v === 'inbox' };
    case 'approve':
    case 'deny': {
      // remove ask messages in thread, add resolved, strip alerts
      const [aid, tid] = a.key.split('/');
      const msgs = (s.messages[a.key] || []).filter(m => m.role !== 'ask');
      msgs.push({ role: 'resolved', text: a.type === 'approve' ? 'Approved · running' : 'Denied' });
      if (a.type === 'approve') {
        msgs.push({ role: 'agent', text: 'Done. Will report back when complete.' });
      }
      const threads = { ...s.threads };
      threads[aid] = threads[aid].map(t => t.id === tid ? { ...t, asking: false, unread: 0 } : t);
      return {
        ...s,
        messages: { ...s.messages, [a.key]: msgs },
        alerts: s.alerts.filter(al => !(al.agent === aid && al.thread === tid)),
        threads,
      };
    }
    default: return s;
  }
}

function CFApp() {
  const [state, dispatch] = React.useReducer(cfReducer, null, cfInitialState);
  const { screen } = state;

  const tabHide = screen === 'chat' || screen === 'pair' || screen === 'config';

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: CF_COLORS.bg, color: CF_COLORS.ink, fontFamily: '-apple-system, system-ui, sans-serif', position: 'relative' }}>
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', position: 'relative', WebkitOverflowScrolling: 'touch' }}>
        {screen === 'agents' && <CFAgents state={state} dispatch={dispatch} />}
        {screen === 'threads' && <CFThreads state={state} dispatch={dispatch} />}
        {screen === 'chat' && <CFChat state={state} dispatch={dispatch} />}
        {screen === 'alerts' && <CFAlerts state={state} dispatch={dispatch} />}
        {screen === 'pair' && <CFPair state={state} dispatch={dispatch} />}
        {screen === 'config' && <CFConfig state={state} dispatch={dispatch} />}
        {screen === 'me' && <CFMe state={state} dispatch={dispatch} />}
      </div>

      {state.drawerOpen && <CFDrawer state={state} dispatch={dispatch} />}

      {!tabHide && <CFTabBar state={state} dispatch={dispatch} />}
    </div>
  );
}

function CFTabBar({ state, dispatch }) {
  const asks = state.alerts.filter(a => a.kind === 'ask').length;
  const agentAsks = new Set(state.alerts.filter(a => a.kind === 'ask').map(a => a.agent)).size;
  const tabs = [
    { id: 'agents', label: 'Agents', icon: CFIcon.tAgents, badge: agentAsks, screen: 'agents' },
    { id: 'alerts', label: 'Alerts', icon: CFIcon.tAlerts, screen: 'alerts' },
    { id: 'me',     label: 'Me',     icon: CFIcon.tMe,     screen: 'me' },
  ];
  return (
    <div style={{
      flexShrink: 0,
      display: 'flex', justifyContent: 'space-around',
      padding: '8px 14px 28px',
      background: 'rgba(250,247,240,0.88)',
      backdropFilter: 'blur(20px) saturate(160%)',
      WebkitBackdropFilter: 'blur(20px) saturate(160%)',
      borderTop: `1px solid ${CF_COLORS.border}`,
    }}>
      {tabs.map(t => {
        const on = state.tab === t.id;
        const c = on ? CF_COLORS.ink : CF_COLORS.muted;
        return (
          <button key={t.id} onClick={() => dispatch({ type: 'goTo', screen: t.screen })}
            style={{ flex: 1, background: 'transparent', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '6px 2px', cursor: 'pointer', position: 'relative' }}>
            <div style={{ position: 'relative' }}>
              {t.icon(c)}
              {t.badge > 0 && <span style={{ position: 'absolute', top: -4, right: -8, minWidth: 16, height: 16, padding: '0 5px', background: CF_COLORS.accent, color: '#fff', borderRadius: 8, fontSize: 10, fontWeight: 700, display: 'grid', placeItems: 'center', border: `2px solid ${CF_COLORS.bg}` }}>{t.badge}</span>}
            </div>
            <span style={{ fontSize: 10, color: c, fontWeight: on ? 600 : 500, letterSpacing: 0.1 }}>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

Object.assign(window, { CF_COLORS, CFIcon, CFAvatar, CFApp, cfInitialState, cfReducer });

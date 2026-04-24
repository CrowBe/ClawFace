// Top-level wireframes explorer app
const { useState } = React;

const SCREENS = [
  {
    id: 's1', num: '01',
    label: 'Agent hub',
    intro: 'Your home. Multiple paired agents, live status, and entry points into any ongoing thread.',
    variants: [
      { id: 'list',    name: 'Stacked list',      Comp: Screen1_ListView,
        sticky: 'classic chat-app feel. each row = one agent. status dot + last activity.' },
      { id: 'cards',   name: 'Card deck',          Comp: Screen1_CardStack,
        sticky: 'swipeable cards. feels physical — one agent in focus, others peeking.' },
      { id: 'inbox',   name: 'Unified inbox',      Comp: Screen1_UnifiedInbox,
        sticky: 'no agent-first screen. every event across agents in one timeline. approvals bubble up.' },
    ]
  },
  {
    id: 's2', num: '02',
    label: 'Threads',
    intro: 'Inside an agent. Multiple parallel conversations — needs to scale to dozens.',
    variants: [
      { id: 'flat',    name: 'Flat list',          Comp: Screen2_FlatList,
        sticky: 'simple, searchable, numbered. #1 pinned at top. warning states obvious.' },
      { id: 'folders', name: 'Folders / groups',   Comp: Screen2_Folders,
        sticky: 'buckets for pinned / work / personal / archived. good for 30+ threads.' },
      { id: 'search',  name: 'Cross-agent search', Comp: Screen2_Search,
        sticky: 'global search. filter by agent / type. essential once you have 5 agents running.' },
    ]
  },
  {
    id: 's3', num: '03',
    label: 'Chat + approvals',
    intro: 'The conversation itself — mixing messages, tool calls, and permission prompts.',
    variants: [
      { id: 'chat',     name: 'Inline approvals',  Comp: Screen3_ClassicChat,
        sticky: 'familiar chat. tool calls as dashed blocks. approval cards inline. fast to scan.' },
      { id: 'timeline', name: 'Timeline / steps',  Comp: Screen3_TimelineView,
        sticky: 'treats the agent run as a checklist. great for ops / deploys where each step matters.' },
      { id: 'sheet',    name: 'Approval sheet',    Comp: Screen3_SplitApproval,
        sticky: 'when permission is needed, it takes over the bottom half. hard to miss, easy to act.' },
    ]
  },
  {
    id: 's4', num: '04',
    label: 'QR pairing',
    intro: 'One-step pairing between phone and dev machine. No accounts, no copy-paste.',
    variants: [
      { id: 'scan',    name: 'Scan from phone',    Comp: Screen4_Scan,
        sticky: 'phone is the scanner. desktop shows the QR. standard but works.' },
      { id: 'show',    name: 'Show on phone',      Comp: Screen4_Show,
        sticky: 'flipped: phone shows QR + code, desktop scans. better when laptop has no camera.' },
      { id: 'confirm', name: 'Confirm & name',     Comp: Screen4_Confirm,
        sticky: 'post-scan review: fingerprint, host, tools, lease. name it before it joins.' },
    ]
  },
  {
    id: 's5', num: '05',
    label: 'Switcher + config',
    intro: 'Moving between agents, tuning permissions, and handling alerts.',
    variants: [
      { id: 'drawer',  name: 'Switcher drawer',    Comp: Screen5_Drawer,
        sticky: 'quick-switch panel. ⌘K on desktop, ≡ on phone. shows state per agent.' },
      { id: 'config',  name: 'Per-agent config',   Comp: Screen5_Config,
        sticky: 'permissions as toggles. notification rules per event type. "ask each time" chip.' },
      { id: 'alerts',  name: 'Alerts / notifs',    Comp: Screen5_Notifications,
        sticky: 'approvals stand out (orange). everything else is muted. chronological.' },
    ]
  },
];

function App() {
  const [screenIdx, setScreenIdx] = useState(() => {
    const s = +(localStorage.getItem('cf_screen') || 0);
    return Math.min(Math.max(s, 0), SCREENS.length - 1);
  });
  const [variantIdx, setVariantIdx] = useState(() => +(localStorage.getItem('cf_variant_' + screenIdx) || 0));

  const screen = SCREENS[screenIdx];

  const setScreen = (i) => {
    setScreenIdx(i);
    localStorage.setItem('cf_screen', i);
    const v = +(localStorage.getItem('cf_variant_' + i) || 0);
    setVariantIdx(v);
  };
  const setVariant = (i) => {
    setVariantIdx(i);
    localStorage.setItem('cf_variant_' + screenIdx, i);
  };

  return (
    <div>
      <div className="topbar">
        <div>
          <div className="sub">Wireframes · low-fi</div>
          <h1>ClawFace — mobile agentic client</h1>
        </div>
        <div className="spacer" />
        <div className="sub" style={{ textAlign: 'right' }}>
          5 flows · {SCREENS.reduce((s,sc)=>s+sc.variants.length,0)} variants<br/>
          <span style={{ textTransform: 'none', fontFamily: 'Caveat, cursive', fontSize: 18, color: 'var(--ink)' }}>
            turn on Tweaks ↘
          </span>
        </div>
      </div>

      <div className="legend">
        <span><span className="swatch" style={{ background: 'var(--ink)' }} /> ink / strokes</span>
        <span><span className="swatch" style={{ background: 'var(--accent)' }} /> approvals · warnings</span>
        <span><span className="swatch" style={{ background: 'var(--highlight)' }} /> active / focus</span>
        <span><span className="swatch" style={{ background: 'var(--paper-2)' }} /> surfaces</span>
        <span>handwriting = copy · mono = metadata</span>
      </div>

      <div className="tabs" role="tablist">
        {SCREENS.map((s, i) => (
          <div key={s.id} className="tab" role="tab"
               aria-selected={i === screenIdx}
               onClick={() => setScreen(i)}>
            <span className="num">{s.num}</span>
            {s.label}
          </div>
        ))}
      </div>

      <div className="screen-intro" style={{ marginTop: 16 }}>
        <span className="note">Screen {screen.num} — {screen.label}</span><br/>
        {screen.intro}
      </div>

      <div className="vtabs">
        {screen.variants.map((v, i) => (
          <div key={v.id} className="vtab" role="tab"
               aria-selected={i === variantIdx}
               onClick={() => setVariant(i)}>
            {String.fromCharCode(65 + i)} · {v.name}
          </div>
        ))}
      </div>

      <div className="canvas">
        <div className="phones-row">
          {screen.variants.map((v, i) => {
            const focused = i === variantIdx;
            const Comp = v.Comp;
            return (
              <Phone
                key={v.id}
                label={`option ${String.fromCharCode(65 + i)}`}
                name={v.name}
                sticky={focused ? v.sticky : null}
                rotate={(i % 3) + 1}
              >
                <Comp />
              </Phone>
            );
          })}
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);

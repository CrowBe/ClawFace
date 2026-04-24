// Shared wireframe primitives + per-screen variants for ClawFace
// All components rendered INSIDE .phone-inner (300×620, with top/bottom safe areas)

// ─────────── Phone wrapper ───────────
function Phone({ label, name, sticky, children, rotate }) {
  const rotClass = rotate === 1 ? 'wobble-1' : rotate === 2 ? 'wobble-2' : 'wobble-3';
  return (
    <div className="phone-wrap">
      <div className="phone-label">{label}</div>
      <div className="phone-name">{name}</div>
      <div className={`phone ${rotClass}`}>
        <div className="phone-inner">{children}</div>
      </div>
      {sticky && (
        <div className="annotations">
          {(Array.isArray(sticky) ? sticky : [sticky]).map((s, i) => (
            <div key={i} className="sticky">{s}</div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────── Primitives ───────────
const Squiggle = ({ w = 80, h = 10, color = 'var(--ink)' }) => (
  <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block' }}>
    <path
      d={`M2 ${h/2} Q ${w*0.15} 1, ${w*0.3} ${h/2} T ${w*0.6} ${h/2} T ${w-2} ${h/2}`}
      stroke={color} strokeWidth="1.5" fill="none" opacity="0.5"
    />
  </svg>
);

const Scribble = ({ w = 200, lines = 1, long = 0.9 }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
    {Array.from({ length: lines }).map((_, i) => (
      <Squiggle key={i} w={w * (i === lines - 1 && lines > 1 ? 0.65 : long)} />
    ))}
  </div>
);

// Agent avatars — monogram disks with unique fills
const AGENTS = [
  { id: 'plan',  name: 'Planner',   mono: 'P',  tint: 'var(--paper-2)', online: true },
  { id: 'code',  name: 'CodeHound', mono: 'C',  tint: '#e9dec4',        online: true },
  { id: 'note',  name: 'Scribe',    mono: 'S',  tint: '#dbe4d0',        online: false },
  { id: 'ops',   name: 'OpsBot',    mono: 'O',  tint: '#e8d6d0',        online: true },
  { id: 'data',  name: 'Analyst',   mono: 'A',  tint: '#d6dee8',        online: false },
];
const AgentAvatar = ({ a, size = 38 }) => (
  <div className="avatar" style={{ width: size, height: size, background: a.tint, fontSize: size * 0.55 }}>
    {a.mono}
  </div>
);

// Status bar (faux time + icons) at top of phone-inner
const StatusBar = () => (
  <div className="mono" style={{
    position: 'absolute', top: 10, left: 0, right: 0,
    display: 'flex', justifyContent: 'space-between',
    padding: '0 24px',
    fontSize: 11, color: 'var(--ink)', fontWeight: 600,
  }}>
    <span>9:41</span>
    <span>▮▮▮▯ ◡ ▮▮▮</span>
  </div>
);

// ======================================================
// SCREEN 1: AGENT HUB (multi-agent list / switcher home)
// ======================================================
function Screen1_ListView() {
  return (
    <>
      <StatusBar />
      <div className="sk-title" style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between' }}>
        <span>Agents</span>
        <span className="mono" style={{ fontSize: 12, color: 'var(--muted)' }}>+ add</span>
      </div>
      <div className="sk-sub">5 paired · 3 online</div>
      <div style={{ padding: '0 14px', display: 'flex', flexDirection: 'column', gap: 10, marginTop: 6 }}>
        {AGENTS.map((a, i) => (
          <div key={a.id} className="sk-box" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <AgentAvatar a={a} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 20, fontWeight: 700 }}>{a.name}</span>
                <span className="mono" style={{ fontSize: 9, color: 'var(--muted)' }}>
                  {i === 0 ? '2m' : i === 1 ? '14m' : i === 2 ? 'yday' : i === 3 ? '1h' : '3d'}
                </span>
              </div>
              <Squiggle w={180} />
              {i === 3 && (
                <span className="sk-chip warn" style={{ marginTop: 4, fontSize: 12 }}>
                  needs approval
                </span>
              )}
            </div>
            <span className={`dot ${a.online ? '' : 'off'}`} />
          </div>
        ))}
      </div>
      <TabBar active="agents" />
    </>
  );
}

function Screen1_CardStack() {
  return (
    <>
      <StatusBar />
      <div className="sk-title">Your agents</div>
      <div className="sk-sub">swipe to switch ›</div>
      <div style={{ padding: '10px 14px 0', position: 'relative', height: 380 }}>
        {AGENTS.slice(0, 3).map((a, i) => (
          <div key={a.id} className="sk-box"
            style={{
              position: 'absolute', left: 14 + i * 6, right: 14 + (2 - i) * 6,
              top: i * 18, padding: 16,
              transform: `rotate(${i === 0 ? -1 : i === 1 ? 0.5 : -0.3}deg)`,
              zIndex: 5 - i,
              background: i === 0 ? 'var(--paper)' : 'var(--paper-2)',
            }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 10 }}>
              <AgentAvatar a={a} size={44} />
              <div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{a.name}</div>
                <div className="mono" style={{ fontSize: 10, color: 'var(--muted)' }}>
                  {i === 0 ? '3 active threads' : '—'}
                </div>
              </div>
            </div>
            {i === 0 && (
              <>
                <Scribble w={220} lines={2} />
                <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                  <span className="sk-chip active">thread ◉ refactor</span>
                  <span className="sk-chip">research</span>
                  <span className="sk-chip warn">approve ×1</span>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
      <div style={{ textAlign: 'center', marginTop: 12 }}>
        <span className="mono" style={{ fontSize: 9, color: 'var(--muted)', letterSpacing: 2 }}>
          ● ○ ○ ○ ○
        </span>
      </div>
      <TabBar active="agents" />
    </>
  );
}

function Screen1_UnifiedInbox() {
  const items = [
    { agent: AGENTS[0], title: 'planned roadmap draft', time: '2m', warn: false },
    { agent: AGENTS[3], title: 'ran deploy.sh — needs OK', time: '4m', warn: true },
    { agent: AGENTS[1], title: 'found 3 failing tests', time: '14m', warn: false },
    { agent: AGENTS[2], title: 'meeting notes ready', time: '1h', warn: false },
    { agent: AGENTS[0], title: 'draft reply to alex@', time: '2h', warn: true },
    { agent: AGENTS[4], title: 'Q3 report summary', time: 'y.', warn: false },
  ];
  return (
    <>
      <StatusBar />
      <div className="sk-title" style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between' }}>
        <span>Inbox</span>
        <span className="mono" style={{ fontSize: 11, color: 'var(--accent)' }}>2 to approve</span>
      </div>
      <div className="sk-sub">all agents · all threads</div>
      <div style={{ padding: '0 14px', display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
        {items.map((it, i) => (
          <div key={i} style={{
            display: 'flex', gap: 10, alignItems: 'flex-start',
            padding: '6px 8px',
            borderLeft: `3px solid ${it.warn ? 'var(--accent)' : 'var(--ink)'}`,
            background: it.warn ? 'rgba(230,130,60,0.08)' : 'transparent',
          }}>
            <AgentAvatar a={it.agent} size={28} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 16, lineHeight: 1.1 }}>{it.title}</div>
              <div className="mono" style={{ fontSize: 9, color: 'var(--muted)' }}>
                {it.agent.name.toLowerCase()} · {it.time}
              </div>
            </div>
          </div>
        ))}
      </div>
      <TabBar active="agents" />
    </>
  );
}

// ======================================================
// SCREEN 2: THREADS inside one agent
// ======================================================
function Screen2_FlatList() {
  const threads = [
    { t: 'Roadmap Q3', last: 'let\'s draft 3 options', time: '2m', unread: 3 },
    { t: 'Refactor auth', last: 'ran 14 tests → 2 fail', time: '12m', unread: 0, warn: true },
    { t: 'Brand voice', last: 'which tone feels right?', time: '1h', unread: 1 },
    { t: 'Travel plan', last: 'booked tuesday flight', time: 'yday', unread: 0 },
    { t: 'Weekly review', last: 'compiled 5 themes', time: '2d', unread: 0 },
  ];
  return (
    <>
      <StatusBar />
      <div style={{ display: 'flex', alignItems: 'center', padding: '0 14px 8px', gap: 8 }}>
        <AgentAvatar a={AGENTS[0]} size={30} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 20, fontWeight: 700, lineHeight: 1 }}>Planner</div>
          <div className="mono" style={{ fontSize: 9, color: 'var(--muted)' }}>online · 5 threads</div>
        </div>
        <span className="sk-chip">+ new</span>
      </div>
      <div className="sk-box" style={{
        margin: '0 14px 10px', display: 'flex', alignItems: 'center', gap: 6,
        padding: '6px 10px', background: 'var(--paper-2)'
      }}>
        <span className="mono" style={{ fontSize: 10 }}>⌕</span>
        <Squiggle w={180} />
      </div>
      <div style={{ padding: '0 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {threads.map((th, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, paddingBottom: 8, borderBottom: '1px dashed rgba(0,0,0,0.15)' }}>
            <div style={{
              width: 30, height: 30, borderRadius: 6,
              border: '1.5px solid var(--ink)',
              display: 'flex', alignItems:'center', justifyContent:'center',
              fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, fontWeight: 600,
              background: th.warn ? 'var(--accent)' : 'var(--paper-2)',
              color: th.warn ? 'var(--paper)' : 'var(--ink)',
            }}>#{i+1}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 18, fontWeight: 600 }}>{th.t}</span>
                <span className="mono" style={{ fontSize: 9, color: 'var(--muted)' }}>{th.time}</span>
              </div>
              <div style={{ fontSize: 15, color: 'var(--muted)' }}>{th.last}</div>
            </div>
            {th.unread > 0 && (
              <div style={{
                width: 18, height: 18, borderRadius: 9,
                background: 'var(--ink)', color: 'var(--paper)',
                fontFamily: "'IBM Plex Mono', monospace", fontSize: 10,
                display: 'flex', alignItems:'center', justifyContent:'center', alignSelf: 'center',
              }}>{th.unread}</div>
            )}
          </div>
        ))}
      </div>
      <TabBar active="threads" />
    </>
  );
}

function Screen2_Folders() {
  const groups = [
    { label: 'Pinned', items: ['Roadmap Q3', 'Weekly review'] },
    { label: 'Work', items: ['Refactor auth ⚠', 'Brand voice', 'Launch plan'] },
    { label: 'Personal', items: ['Travel plan', 'Gift ideas'] },
    { label: 'Archived', items: ['— 12 threads —'] },
  ];
  return (
    <>
      <StatusBar />
      <div style={{ display: 'flex', alignItems: 'center', padding: '0 14px 8px', gap: 8 }}>
        <AgentAvatar a={AGENTS[0]} size={30} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 20, fontWeight: 700, lineHeight: 1 }}>Planner</div>
          <div className="mono" style={{ fontSize: 9, color: 'var(--muted)' }}>grouped view</div>
        </div>
        <span className="sk-chip">⚙</span>
      </div>
      <div style={{ padding: '0 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {groups.map((g, gi) => (
          <div key={gi}>
            <div style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 10, color: 'var(--muted)',
              letterSpacing: 1.5, textTransform: 'uppercase',
              display: 'flex', justifyContent: 'space-between',
              padding: '6px 2px 2px',
            }}>
              <span>▾ {g.label}</span><span>{g.items.length}</span>
            </div>
            <div className="sk-box" style={{ padding: 0, background: 'var(--paper)' }}>
              {g.items.map((t, i) => (
                <div key={i} style={{
                  padding: '8px 12px',
                  borderTop: i === 0 ? 'none' : '1px dashed rgba(0,0,0,0.15)',
                  fontSize: 17, display: 'flex', justifyContent: 'space-between',
                }}>
                  <span>{t}</span>
                  <span className="mono" style={{ fontSize: 9, color:'var(--muted)' }}>›</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <TabBar active="threads" />
    </>
  );
}

function Screen2_Search() {
  return (
    <>
      <StatusBar />
      <div className="sk-title">Search</div>
      <div className="sk-sub">across all agents + threads</div>
      <div className="sk-box" style={{
        margin: '0 14px 10px', padding: '8px 10px', background: 'var(--paper-2)',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span className="mono" style={{ fontSize: 11 }}>⌕</span>
        <span style={{ fontSize: 18 }}>"auth refactor"</span>
        <span style={{ flex: 1 }} />
        <span className="mono" style={{ fontSize: 10, color:'var(--muted)' }}>×</span>
      </div>
      <div style={{ padding: '0 14px', display:'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
        <span className="sk-chip active">all</span>
        <span className="sk-chip">messages</span>
        <span className="sk-chip">files</span>
        <span className="sk-chip">approvals</span>
      </div>
      <div className="sk-sub">planner · refactor auth · 12m</div>
      <div style={{ padding: '0 14px', marginBottom: 10 }}>
        <div className="sk-box">
          <Scribble w={220} lines={2} />
          <div className="mono" style={{ fontSize: 9, color: 'var(--muted)', marginTop: 4 }}>
            …rotate tokens on every <mark style={{ background: 'var(--highlight)', padding: '0 3px' }}>auth refactor</mark> cycle…
          </div>
        </div>
      </div>
      <div className="sk-sub">codehound · tests failing · 22m</div>
      <div style={{ padding: '0 14px' }}>
        <div className="sk-box">
          <Scribble w={220} lines={2} />
        </div>
      </div>
      <TabBar active="search" />
    </>
  );
}

// ======================================================
// SCREEN 3: CHAT w/ approval + tool use
// ======================================================
function Screen3_ClassicChat() {
  return (
    <>
      <StatusBar />
      <div style={{ display: 'flex', alignItems: 'center', padding: '0 14px 8px', gap: 8, borderBottom: '1px dashed rgba(0,0,0,0.2)' }}>
        <span className="mono" style={{ fontSize: 14 }}>‹</span>
        <AgentAvatar a={AGENTS[0]} size={28} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1 }}>Roadmap Q3</div>
          <div className="mono" style={{ fontSize: 9, color: 'var(--muted)' }}>planner · thinking…</div>
        </div>
        <span className="sk-chip">⋯</span>
      </div>
      <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Bubble side="user" text="help me plan next quarter" />
        <Bubble side="agent" text="got it. pulling last quarter's retro…" />
        <ToolCallBlock label="read_file · q2-retro.md" />
        <Bubble side="agent" text="3 themes stood out. want me to draft an outline?" />
        <Bubble side="user" text="yes + add timeline" />
        <ApprovalCard />
      </div>
      <Composer />
    </>
  );
}

function Screen3_TimelineView() {
  return (
    <>
      <StatusBar />
      <div style={{ display:'flex', alignItems: 'center', padding: '0 14px 6px', gap: 8 }}>
        <span className="mono" style={{ fontSize: 14 }}>‹</span>
        <AgentAvatar a={AGENTS[3]} size={28} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1 }}>deploy.sh run</div>
          <div className="mono" style={{ fontSize: 9, color: 'var(--muted)' }}>opsbot · step 3 of 6</div>
        </div>
      </div>
      <div style={{ padding: '8px 14px', position: 'relative' }}>
        {/* vertical line */}
        <div style={{ position:'absolute', left: 26, top: 14, bottom: 10, width: 2, background: 'var(--ink)', opacity: 0.2 }} />
        {[
          { st: 'done',    t: 'cloned repo',           sub: '2s' },
          { st: 'done',    t: 'installed deps',        sub: '18s' },
          { st: 'active',  t: 'running tests…',        sub: '2/14' },
          { st: 'wait',    t: 'deploy to staging',     sub: 'needs OK' },
          { st: 'idle',    t: 'smoke test',            sub: '' },
          { st: 'idle',    t: 'promote to prod',       sub: '' },
        ].map((s, i) => (
          <div key={i} style={{ display:'flex', gap: 14, alignItems:'flex-start', padding: '8px 0' }}>
            <div style={{
              width: 20, height: 20, borderRadius: 10,
              border: '1.5px solid var(--ink)',
              background: s.st === 'done' ? 'var(--ink)' :
                          s.st === 'active' ? 'var(--highlight)' :
                          s.st === 'wait' ? 'var(--accent)' : 'var(--paper)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: "'IBM Plex Mono', monospace", fontSize: 10,
              color: s.st === 'done' ? 'var(--paper)' : 'var(--ink)',
              zIndex: 2, flexShrink: 0,
            }}>
              {s.st === 'done' ? '✓' : s.st === 'active' ? '◐' : s.st === 'wait' ? '!' : ''}
            </div>
            <div style={{ flex: 1, paddingTop: 1 }}>
              <div style={{ fontSize: 17, fontWeight: s.st === 'active' || s.st === 'wait' ? 700 : 500 }}>{s.t}</div>
              <div className="mono" style={{ fontSize: 9, color: 'var(--muted)' }}>{s.sub}</div>
              {s.st === 'wait' && (
                <div style={{ display:'flex', gap: 6, marginTop: 6 }}>
                  <span className="sk-chip warn" style={{ fontSize: 13 }}>approve</span>
                  <span className="sk-chip" style={{ fontSize: 13 }}>deny</span>
                  <span className="sk-chip" style={{ fontSize: 13 }}>edit</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      <Composer compact />
    </>
  );
}

function Screen3_SplitApproval() {
  return (
    <>
      <StatusBar />
      <div style={{ display: 'flex', alignItems: 'center', padding: '0 14px 6px', gap: 8 }}>
        <span className="mono" style={{ fontSize: 14 }}>‹</span>
        <div style={{ flex: 1, fontSize: 18, fontWeight: 700 }}>Refactor auth</div>
      </div>
      <div style={{ padding: '4px 14px 8px', display:'flex', flexDirection:'column', gap: 6 }}>
        <Bubble side="agent" text="I'll rotate the secret + update 3 call sites. ready?" />
      </div>

      {/* Approval sheet bottom — takes 55% */}
      <div style={{
        position: 'absolute', bottom: 22, left: 8, right: 8,
        background: 'var(--paper)',
        border: '2px solid var(--ink)',
        borderRadius: 18,
        padding: 12,
        boxShadow: '0 -4px 0 var(--ink), 2px 2px 0 var(--ink)',
      }}>
        <div style={{ display: 'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 8 }}>
          <span style={{ fontSize: 20, fontWeight: 700 }}>Permission needed</span>
          <span className="sk-chip warn" style={{ fontSize: 12 }}>write</span>
        </div>
        <div className="mono" style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8 }}>
          edit_file · 3 files · ~48 LOC
        </div>
        <div style={{
          background: 'var(--paper-2)', border: '1.5px dashed var(--ink)',
          borderRadius: 8, padding: 8, fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 10, lineHeight: 1.4, marginBottom: 10,
        }}>
          <div>+ rotateSecret(old, new)</div>
          <div style={{ color: 'var(--muted)' }}>- const KEY = "legacy"</div>
          <div>+ const KEY = env.KEY</div>
          <div style={{ color: 'var(--muted)' }}>…2 more hunks</div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button style={{
            flex: 2, padding: '8px 10px', border: '1.5px solid var(--ink)',
            background: 'var(--accent)', color: 'var(--paper)',
            borderRadius: 10, fontFamily: "'Caveat', cursive", fontSize: 20,
            boxShadow: '2px 2px 0 var(--ink)', cursor: 'pointer',
          }}>approve ✓</button>
          <button style={{
            flex: 1, padding: '8px 10px', border: '1.5px solid var(--ink)',
            background: 'var(--paper)', borderRadius: 10,
            fontFamily: "'Caveat', cursive", fontSize: 20, cursor: 'pointer',
          }}>deny</button>
          <button style={{
            flex: 1, padding: '8px 10px', border: '1.5px solid var(--ink)',
            background: 'var(--paper)', borderRadius: 10,
            fontFamily: "'Caveat', cursive", fontSize: 20, cursor: 'pointer',
          }}>edit</button>
        </div>
        <div className="mono" style={{ fontSize: 9, color:'var(--muted)', textAlign:'center', marginTop: 8, letterSpacing: 1 }}>
          ⌂ hold to preview diff · swipe ↓ to remind later
        </div>
      </div>
    </>
  );
}

// Shared bubble / tool / approval / composer
function Bubble({ side, text }) {
  const isUser = side === 'user';
  return (
    <div style={{
      alignSelf: isUser ? 'flex-end' : 'flex-start',
      maxWidth: '80%',
      background: isUser ? 'var(--ink)' : 'var(--paper-2)',
      color: isUser ? 'var(--paper)' : 'var(--ink)',
      border: '1.5px solid var(--ink)',
      borderRadius: isUser ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
      padding: '6px 10px',
      fontSize: 16, lineHeight: 1.2,
      boxShadow: '2px 2px 0 rgba(0,0,0,0.08)',
    }}>{text}</div>
  );
}

function ToolCallBlock({ label }) {
  return (
    <div style={{
      alignSelf: 'flex-start', maxWidth: '90%',
      border: '1.5px dashed var(--ink)', borderRadius: 10,
      padding: '4px 10px',
      fontFamily: "'IBM Plex Mono', monospace", fontSize: 11,
      background: 'var(--paper-2)',
      display: 'flex', gap: 8, alignItems: 'center',
    }}>
      <span>⚙</span>
      <span style={{ flex: 1 }}>{label}</span>
      <span style={{ color: 'var(--muted)' }}>done</span>
    </div>
  );
}

function ApprovalCard() {
  return (
    <div style={{
      alignSelf: 'stretch', border: '2px solid var(--ink)',
      borderRadius: 12, padding: 10, background: 'rgba(230,130,60,0.10)',
      boxShadow: '2px 2px 0 var(--ink)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems:'center' }}>
        <span style={{ fontSize: 18, fontWeight: 700 }}>Run create_doc?</span>
        <span className="sk-chip warn" style={{ fontSize: 12 }}>approve</span>
      </div>
      <div className="mono" style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>
        will create: “Q3 Outline.md”
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        <span className="sk-chip active" style={{ fontSize: 14 }}>✓ yes</span>
        <span className="sk-chip" style={{ fontSize: 14 }}>✗ no</span>
        <span className="sk-chip" style={{ fontSize: 14 }}>always for this thread</span>
      </div>
    </div>
  );
}

function Composer({ compact }) {
  return (
    <div style={{
      position: 'absolute', bottom: 28, left: 14, right: 14,
      display: 'flex', gap: 6, alignItems: 'center',
      background: 'var(--paper)',
      border: '1.5px solid var(--ink)', borderRadius: 20,
      padding: '4px 6px 4px 12px',
      boxShadow: '2px 2px 0 rgba(0,0,0,0.08)',
    }}>
      <span className="mono" style={{ fontSize: 12, color:'var(--muted)' }}>+</span>
      <span style={{ flex: 1, fontSize: 16, color: 'var(--muted)' }}>message…</span>
      <div style={{
        width: 30, height: 30, borderRadius: 15, background: 'var(--ink)',
        color: 'var(--paper)', fontSize: 14, fontWeight: 700,
        display:'flex', alignItems:'center', justifyContent:'center',
        fontFamily: "'IBM Plex Mono', monospace",
      }}>↑</div>
    </div>
  );
}

// ======================================================
// SCREEN 4: QR PAIRING
// ======================================================
function FakeQR({ size = 150 }) {
  // deterministic pseudo-random squares for a QR look
  const cells = 17;
  const grid = [];
  let seed = 42;
  const rand = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  for (let y = 0; y < cells; y++) for (let x = 0; x < cells; x++) grid.push(rand() > 0.5);
  const s = size / cells;
  return (
    <div style={{
      width: size + 20, height: size + 20, padding: 10,
      background: 'var(--paper)', border: '2px solid var(--ink)',
      borderRadius: 12, boxShadow: '3px 3px 0 var(--ink)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <svg width={size} height={size}>
        {grid.map((v, i) => v && (
          <rect key={i} x={(i % cells) * s} y={Math.floor(i / cells) * s}
                width={s} height={s} fill="var(--ink)" />
        ))}
        {/* anchor squares */}
        {[[0,0],[cells-7,0],[0,cells-7]].map(([x,y], i) => (
          <g key={i}>
            <rect x={x*s} y={y*s} width={s*7} height={s*7} fill="var(--paper)" />
            <rect x={x*s} y={y*s} width={s*7} height={s*7} fill="none" stroke="var(--ink)" strokeWidth="3" />
            <rect x={(x+2)*s} y={(y+2)*s} width={s*3} height={s*3} fill="var(--ink)" />
          </g>
        ))}
      </svg>
    </div>
  );
}

function Screen4_Scan() {
  return (
    <>
      <StatusBar />
      <div className="sk-title">Pair an agent</div>
      <div className="sk-sub">point camera at QR on your machine</div>
      <div style={{
        margin: '12px 14px', height: 280,
        border: '2px solid var(--ink)', borderRadius: 16,
        background: '#1a1815', position: 'relative', overflow: 'hidden',
        boxShadow: '3px 3px 0 var(--ink)',
      }}>
        {/* viewfinder corners */}
        {[[10,10,0],[10,10,1],[10,10,2],[10,10,3]].map(([a,b,c]) => {
          const pos = [{top:10,left:10},{top:10,right:10},{bottom:10,left:10},{bottom:10,right:10}][c];
          return (
            <div key={c} style={{
              position: 'absolute', ...pos,
              width: 28, height: 28,
              borderTop: c < 2 ? '3px solid var(--paper)' : 'none',
              borderBottom: c >= 2 ? '3px solid var(--paper)' : 'none',
              borderLeft: c % 2 === 0 ? '3px solid var(--paper)' : 'none',
              borderRight: c % 2 === 1 ? '3px solid var(--paper)' : 'none',
            }} />
          );
        })}
        <div style={{
          position: 'absolute', top: '48%', left: 0, right: 0, height: 2,
          background: 'var(--accent)',
        }} />
        <div style={{
          position: 'absolute', bottom: 10, left: 0, right: 0,
          textAlign: 'center', color: 'var(--paper)',
          fontFamily: "'Caveat', cursive", fontSize: 18,
        }}>looking for QR…</div>
      </div>
      <div style={{ textAlign: 'center', fontFamily:"'IBM Plex Mono', monospace", fontSize: 10, color:'var(--muted)', letterSpacing: 1 }}>
        — or —
      </div>
      <div style={{ display:'flex', gap: 8, padding: '10px 14px 0', justifyContent:'center' }}>
        <span className="sk-chip">paste link</span>
        <span className="sk-chip">enter code</span>
      </div>
      <TabBar active="add" />
    </>
  );
}

function Screen4_Show() {
  return (
    <>
      <StatusBar />
      <div className="sk-title">Add device</div>
      <div className="sk-sub">run: claw pair · then scan below</div>

      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 10 }}>
        <FakeQR size={160} />
      </div>

      <div style={{ textAlign: 'center', marginTop: 12 }}>
        <div className="mono" style={{ fontSize: 22, letterSpacing: 6, fontWeight: 600 }}>
          4FJ-92K
        </div>
        <div className="mono" style={{ fontSize: 10, color:'var(--muted)', letterSpacing: 1.5 }}>
          expires in 2:48
        </div>
      </div>

      <div style={{ padding: '12px 16px', marginTop: 6 }}>
        <div className="mono" style={{ fontSize: 10, color:'var(--muted)', textTransform:'uppercase', letterSpacing: 1.5 }}>
          steps
        </div>
        <div style={{ fontSize: 17, lineHeight: 1.3, marginTop: 4 }}>
          1. open ClawFace on your phone<br/>
          2. tap + add agent<br/>
          3. scan this QR
        </div>
      </div>

      <TabBar active="add" />
    </>
  );
}

function Screen4_Confirm() {
  return (
    <>
      <StatusBar />
      <div className="sk-title" style={{ paddingTop: 12 }}>Almost there</div>
      <div className="sk-sub">confirm this is your machine</div>

      <div style={{
        margin: '14px 14px 0', padding: 14,
        border: '2px solid var(--ink)', borderRadius: 14,
        background: 'var(--paper-2)', boxShadow: '3px 3px 0 var(--ink)',
      }}>
        <div style={{ display:'flex', alignItems:'center', gap: 10 }}>
          <div style={{ width: 44, height: 44, border: '1.5px solid var(--ink)', borderRadius: 10, background:'var(--paper)', display:'flex', alignItems:'center', justifyContent:'center', fontSize: 24 }}>
            ⬚
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 20, fontWeight: 700, lineHeight: 1 }}>mbp-noah.local</div>
            <div className="mono" style={{ fontSize: 10, color:'var(--muted)' }}>MacBook Pro · 16" · US-West</div>
          </div>
          <span className="sk-chip active">verified</span>
        </div>
        <div style={{
          marginTop: 10, padding: 8, borderTop: '1px dashed rgba(0,0,0,0.2)',
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6,
          fontFamily: "'IBM Plex Mono', monospace", fontSize: 10,
        }}>
          <div><span style={{ color:'var(--muted)' }}>fingerprint</span><br/>7A:F2:91:0D:…</div>
          <div><span style={{ color:'var(--muted)' }}>tools</span><br/>14 available</div>
          <div><span style={{ color:'var(--muted)' }}>paired at</span><br/>9:41 AM</div>
          <div><span style={{ color:'var(--muted)' }}>lease</span><br/>30 days</div>
        </div>
      </div>

      <div style={{ padding: '14px 14px 0' }}>
        <div className="mono" style={{ fontSize: 10, color:'var(--muted)', textTransform:'uppercase', letterSpacing: 1.5, marginBottom: 4 }}>
          name this agent
        </div>
        <div className="sk-box" style={{ padding: '8px 10px', fontSize: 20 }}>Planner<span style={{ color: 'var(--muted)' }}>|</span></div>
      </div>

      <div style={{
        position: 'absolute', bottom: 30, left: 14, right: 14,
        display: 'flex', gap: 6,
      }}>
        <button style={{
          flex: 2, padding: '10px 12px', border: '2px solid var(--ink)',
          background: 'var(--accent)', color: 'var(--paper)',
          borderRadius: 12, fontFamily: "'Caveat', cursive", fontSize: 22,
          boxShadow: '2px 2px 0 var(--ink)', cursor: 'pointer',
        }}>pair agent</button>
        <button style={{
          flex: 1, padding: '10px 12px', border: '2px solid var(--ink)',
          background: 'var(--paper)', borderRadius: 12,
          fontFamily: "'Caveat', cursive", fontSize: 22, cursor: 'pointer',
        }}>cancel</button>
      </div>
    </>
  );
}

// ======================================================
// SCREEN 5: AGENT SWITCHER & CONFIG
// ======================================================
function Screen5_Drawer() {
  return (
    <>
      <StatusBar />
      <div style={{ padding: '4px 14px 8px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className="mono" style={{ fontSize: 14 }}>≡</span>
        <div style={{ flex: 1, fontSize: 20, fontWeight: 700 }}>Switch</div>
        <span className="mono" style={{ fontSize: 10, color:'var(--muted)' }}>⌘K</span>
      </div>
      <div className="sk-sub">tap to jump · hold to pin</div>
      <div style={{ padding: '0 14px' }}>
        {AGENTS.map((a, i) => (
          <div key={a.id} style={{
            display:'flex', alignItems:'center', gap: 10, padding: '10px 8px',
            background: i === 0 ? 'var(--highlight)' : 'transparent',
            border: i === 0 ? '1.5px solid var(--ink)' : '1.5px solid transparent',
            borderRadius: 10, marginBottom: 4,
          }}>
            <AgentAvatar a={a} size={32} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 18, fontWeight: 600, lineHeight: 1 }}>
                {a.name} {i === 0 && <span style={{ color:'var(--accent)', fontSize: 14 }}> ◉ active</span>}
              </div>
              <div className="mono" style={{ fontSize: 9, color:'var(--muted)' }}>
                {i === 0 ? '3 threads · online' : i === 1 ? '1 thread · online' : i === 3 ? '2 threads · ⚠ approval' : 'offline'}
              </div>
            </div>
            <span className="mono" style={{ fontSize: 11, color:'var(--muted)' }}>⌘{i+1}</span>
          </div>
        ))}
      </div>
      <div style={{ padding: '12px 14px 0', borderTop: '1px dashed rgba(0,0,0,0.2)', marginTop: 6 }}>
        <div className="mono" style={{ fontSize: 10, color:'var(--muted)', letterSpacing: 1.5 }}>ACTIONS</div>
        <div style={{ fontSize: 17, lineHeight: 1.6, marginTop: 4 }}>
          + pair new agent<br/>
          ⚙ settings<br/>
          ↻ reconnect all
        </div>
      </div>
      <TabBar active="agents" />
    </>
  );
}

function Screen5_Config() {
  return (
    <>
      <StatusBar />
      <div style={{ display: 'flex', alignItems: 'center', padding: '0 14px 8px', gap: 8 }}>
        <span className="mono" style={{ fontSize: 14 }}>‹</span>
        <AgentAvatar a={AGENTS[0]} size={30} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 20, fontWeight: 700, lineHeight: 1 }}>Planner</div>
          <div className="mono" style={{ fontSize: 9, color: 'var(--muted)' }}>settings</div>
        </div>
      </div>

      <ConfigGroup label="IDENTITY">
        <ConfigRow k="name" v="Planner" />
        <ConfigRow k="icon" v="P · cream" />
        <ConfigRow k="host" v="mbp-noah.local" mono />
      </ConfigGroup>

      <ConfigGroup label="PERMISSIONS">
        <ConfigRow k="read files" toggle on />
        <ConfigRow k="write files" toggle on warn="ask each time" />
        <ConfigRow k="run shell" toggle off />
        <ConfigRow k="network" toggle on />
      </ConfigGroup>

      <ConfigGroup label="NOTIFICATIONS">
        <ConfigRow k="mentions" v="push + badge" />
        <ConfigRow k="approvals" v="push + sound" />
        <ConfigRow k="completions" v="silent" />
      </ConfigGroup>

      <div style={{ padding: '6px 14px 0' }}>
        <span className="sk-chip" style={{ color: 'var(--accent)', borderColor:'var(--accent)' }}>
          ⚠ unpair agent
        </span>
      </div>

      <TabBar active="settings" />
    </>
  );
}

function ConfigGroup({ label, children }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div className="mono" style={{ fontSize: 10, color:'var(--muted)', padding: '6px 18px 2px', letterSpacing: 1.5 }}>
        {label}
      </div>
      <div style={{ margin: '0 14px', border: '1.5px solid var(--ink)', borderRadius: 12, background: 'var(--paper)' }}>
        {children}
      </div>
    </div>
  );
}

function ConfigRow({ k, v, toggle, on, warn, mono }) {
  return (
    <div style={{
      display:'flex', alignItems: 'center', padding: '7px 12px',
      borderTop: '1px dashed rgba(0,0,0,0.15)',
      fontSize: 16,
    }}>
      <span style={{ flex: 1 }}>{k}</span>
      {toggle ? (
        <div style={{
          width: 38, height: 22, borderRadius: 11,
          border: '1.5px solid var(--ink)',
          background: on ? 'var(--ink)' : 'var(--paper-2)',
          position: 'relative',
        }}>
          <div style={{
            position:'absolute', top: 2, left: on ? 18 : 2,
            width: 16, height: 16, borderRadius: 8,
            background: 'var(--paper)',
            border: '1.5px solid var(--ink)',
          }} />
        </div>
      ) : (
        <span className={mono ? 'mono' : ''} style={{
          color: 'var(--muted)', fontSize: mono ? 11 : 15,
        }}>{v}</span>
      )}
      {warn && <span className="sk-chip warn" style={{ fontSize: 11, marginLeft: 6, padding: '0 6px' }}>{warn}</span>}
    </div>
  );
}

function Screen5_Notifications() {
  return (
    <>
      <StatusBar />
      <div className="sk-title">Alerts</div>
      <div className="sk-sub">approvals + pings across agents</div>

      <div style={{ padding: '0 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="sk-box" style={{
          borderWidth: 2, background: 'rgba(230,130,60,0.12)',
          boxShadow: '3px 3px 0 var(--ink)',
        }}>
          <div style={{ display: 'flex', gap: 8, alignItems:'center' }}>
            <AgentAvatar a={AGENTS[3]} size={28} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 17, fontWeight: 700, lineHeight: 1 }}>opsbot · deploy.sh</div>
              <div className="mono" style={{ fontSize: 10, color:'var(--muted)' }}>needs approval · just now</div>
            </div>
          </div>
          <div style={{ fontSize: 15, margin: '6px 0 8px' }}>ready to ship to staging?</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <span className="sk-chip warn" style={{ fontSize: 13 }}>approve</span>
            <span className="sk-chip" style={{ fontSize: 13 }}>deny</span>
            <span className="sk-chip" style={{ fontSize: 13 }}>open</span>
          </div>
        </div>

        <div className="sk-box">
          <div style={{ display: 'flex', gap: 8, alignItems:'center' }}>
            <AgentAvatar a={AGENTS[0]} size={28} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 17, fontWeight: 700, lineHeight: 1 }}>planner</div>
              <div className="mono" style={{ fontSize: 10, color:'var(--muted)' }}>@you · 14m</div>
            </div>
          </div>
          <div style={{ fontSize: 15, marginTop: 4 }}>draft ready — mind reviewing the Q3 outline?</div>
        </div>

        <div className="sk-box" style={{ opacity: 0.7 }}>
          <div style={{ display: 'flex', gap: 8, alignItems:'center' }}>
            <AgentAvatar a={AGENTS[1]} size={28} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 17, fontWeight: 700, lineHeight: 1 }}>codehound</div>
              <div className="mono" style={{ fontSize: 10, color:'var(--muted)' }}>done · 22m</div>
            </div>
          </div>
          <div style={{ fontSize: 15, marginTop: 4 }}>fixed 2 flaky tests. passing ✓</div>
        </div>

        <div className="mono" style={{
          fontSize: 10, color:'var(--muted)', textAlign: 'center',
          letterSpacing: 1.5, marginTop: 4,
        }}>
          — earlier —
        </div>

        <div className="sk-box" style={{ opacity: 0.6 }}>
          <div style={{ display: 'flex', gap: 8, alignItems:'center' }}>
            <AgentAvatar a={AGENTS[2]} size={28} />
            <div style={{ fontSize: 14, flex: 1 }}>scribe · notes saved · yday</div>
          </div>
        </div>
      </div>

      <TabBar active="alerts" />
    </>
  );
}

// ─────────── shared tab bar ───────────
function TabBar({ active }) {
  const items = [
    { k: 'agents',   l: 'agents' },
    { k: 'threads',  l: 'threads' },
    { k: 'search',   l: 'search' },
    { k: 'alerts',   l: 'alerts' },
    { k: 'settings', l: 'me' },
  ];
  return (
    <div className="sk-tabbar">
      {items.map(it => (
        <div key={it.k} className={`tabitem ${active === it.k ? 'active' : ''}`}>
          <div className="ico" />
          {it.l}
        </div>
      ))}
    </div>
  );
}

// ======================================================
// Expose to window
// ======================================================
Object.assign(window, {
  Phone,
  Screen1_ListView, Screen1_CardStack, Screen1_UnifiedInbox,
  Screen2_FlatList, Screen2_Folders, Screen2_Search,
  Screen3_ClassicChat, Screen3_TimelineView, Screen3_SplitApproval,
  Screen4_Scan, Screen4_Show, Screen4_Confirm,
  Screen5_Drawer, Screen5_Config, Screen5_Notifications,
});

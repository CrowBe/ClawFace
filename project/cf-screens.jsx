// cf-screens.jsx — per-screen views for ClawFace

const { useState, useEffect } = React;

// ───────────── Agents screen (01 A+C collapsible)
function CFAgents({ state, dispatch }) {
  const asks = state.alerts.filter(a => a.kind === 'ask').length;
  const askingAgents = new Set(state.alerts.filter(a => a.kind === 'ask').map(a => a.agent));
  const viewInbox = state.agentsView === 'inbox';

  return (
    <div style={{ paddingTop: 8, paddingBottom: 100 }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '6px 16px 4px' }}>
        <button onClick={() => dispatch({ type: 'openDrawer' })} style={navBtnStyle}>
          {CFIcon.menu(CF_COLORS.ink2)}
        </button>
        <div style={{ flex: 1 }} />
        <button onClick={() => dispatch({ type: 'goTo', screen: 'pair' })} style={navBtnStyle}>
          {CFIcon.plus(CF_COLORS.ink2)}
        </button>
      </div>

      <div style={{ padding: '4px 20px 8px' }}>
        <div style={{ fontSize: 32, fontWeight: 700, letterSpacing: -0.8, lineHeight: 1.1 }}>Agents</div>
        <div style={{ fontSize: 13, color: CF_COLORS.muted, marginTop: 2 }}>
          {state.agents.filter(a => a.online).length} online · {asks} waiting on you
        </div>
      </div>

      {/* Segmented toggle: Agents | Inbox — collapses after first Inbox tap */}
      {(!state.inboxSeen || asks > 0) && (
        <div style={{ padding: '0 16px 10px', display: 'flex', gap: 4, background: CF_COLORS.surface2, borderRadius: 12, margin: '0 16px 12px', padding: 4 }}>
          <button onClick={() => dispatch({ type: 'setAgentsView', v: 'agents' })}
            style={segStyle(!viewInbox)}>Agents</button>
          <button onClick={() => dispatch({ type: 'setAgentsView', v: 'inbox' })}
            style={segStyle(viewInbox)}>
            Inbox {asks > 0 && <span style={{ marginLeft: 6, background: CF_COLORS.accent, color: '#fff', padding: '1px 7px', borderRadius: 8, fontSize: 11 }}>{asks}</span>}
          </button>
        </div>
      )}

      {!viewInbox ? (
        <div style={{ margin: '0 16px', background: CF_COLORS.surface, borderRadius: 18, overflow: 'hidden', border: `1px solid ${CF_COLORS.border}` }}>
          {state.agents.map((a, i) => (
            <button key={a.id}
              onClick={() => { dispatch({ type: 'setAgent', id: a.id }); dispatch({ type: 'goTo', screen: 'threads' }); }}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 14px', background: 'transparent',
                border: 'none',
                borderTop: i === 0 ? 'none' : `1px solid ${CF_COLORS.border}`,
                cursor: 'pointer', textAlign: 'left',
              }}>
              <CFAvatar agent={a} size={44} dot={askingAgents.has(a.id) ? 'ask' : (a.online ? 'online' : 'off')} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: CF_COLORS.ink, letterSpacing: -0.2 }}>{a.name}</div>
                <div style={{ fontSize: 12, color: CF_COLORS.muted, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {askingAgents.has(a.id) ? 'needs approval' : (state.threads[a.id]?.filter(t => t.unread).length ? `${state.threads[a.id].filter(t => t.unread).length} new` : `${state.threads[a.id]?.length || 0} threads`)}
                </div>
              </div>
              {askingAgents.has(a.id) ? (
                <span style={askStyle}>ask</span>
              ) : (state.threads[a.id]?.reduce((s,t)=>s+t.unread,0) > 0) ? (
                <span style={countStyle}>{state.threads[a.id].reduce((s,t)=>s+t.unread,0)}</span>
              ) : (
                <span style={{ color: CF_COLORS.muted }}>{CFIcon.chev(CF_COLORS.muted)}</span>
              )}
            </button>
          ))}
          <button onClick={() => dispatch({ type: 'goTo', screen: 'pair' })} style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 12,
            padding: '12px 14px', background: 'transparent',
            border: 'none', borderTop: `1px dashed ${CF_COLORS.borderStrong}`,
            cursor: 'pointer', color: CF_COLORS.muted, textAlign: 'left', fontSize: 14,
          }}>
            <div style={{ width: 44, height: 44, borderRadius: 14, border: `1.5px dashed ${CF_COLORS.borderStrong}`, display: 'grid', placeItems: 'center' }}>
              {CFIcon.plus(CF_COLORS.muted)}
            </div>
            <span style={{ fontStyle: 'italic' }}>pair a new agent…</span>
          </button>
        </div>
      ) : (
        <div style={{ margin: '0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {state.alerts.map(al => {
            const ag = state.agents.find(x => x.id === al.agent);
            return (
              <button key={al.id} onClick={() => { dispatch({ type: 'setAgent', id: al.agent }); dispatch({ type: 'setThread', id: al.thread }); dispatch({ type: 'goTo', screen: 'chat' }); }}
                style={{
                  display: 'flex', gap: 10, padding: '10px 12px',
                  background: al.kind === 'ask' ? CF_COLORS.accentSoft : CF_COLORS.surface,
                  border: `1px solid ${al.kind === 'ask' ? 'transparent' : CF_COLORS.border}`,
                  borderLeft: al.kind === 'ask' ? `3px solid ${CF_COLORS.accent}` : `1px solid ${CF_COLORS.border}`,
                  borderRadius: 12, textAlign: 'left', cursor: 'pointer',
                }}>
                <CFAvatar agent={ag} size={32} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, color: CF_COLORS.ink, lineHeight: 1.3 }}>{al.title}</div>
                  <div style={{ fontSize: 11, color: CF_COLORS.muted, marginTop: 3, fontFamily: 'ui-monospace, Menlo, monospace' }}>{ag?.name.toLowerCase()} · {al.when}</div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ───────────── Threads screen (02 A + folders toggle)
function CFThreads({ state, dispatch }) {
  const agent = state.agents.find(a => a.id === state.agentId);
  const threads = state.threads[state.agentId] || [];
  const [mode, setMode] = useState('flat');
  const active = threads.filter(t => t.folder === 'active');
  const done = threads.filter(t => t.folder === 'done');

  return (
    <div style={{ paddingBottom: 100 }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '6px 16px', gap: 10 }}>
        <button onClick={() => dispatch({ type: 'goTo', screen: 'agents' })} style={navBtnStyle}>
          {CFIcon.back(CF_COLORS.ink2)}
        </button>
        <CFAvatar agent={agent} size={34} dot={agent.online ? 'online' : 'off'} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: -0.2 }}>{agent.name}</div>
          <div style={{ fontSize: 11, color: CF_COLORS.muted, fontFamily: 'ui-monospace, Menlo, monospace' }}>{agent.role}</div>
        </div>
        <button onClick={() => dispatch({ type: 'goTo', screen: 'config' })} style={navBtnStyle}>
          {CFIcon.dots(CF_COLORS.ink2)}
        </button>
      </div>

      {/* flat / folders */}
      <div style={{ display: 'flex', gap: 4, padding: 4, margin: '8px 16px 10px', background: CF_COLORS.surface2, borderRadius: 12 }}>
        <button onClick={() => setMode('flat')} style={segStyle(mode === 'flat')}>Flat</button>
        <button onClick={() => setMode('folders')} style={segStyle(mode === 'folders')}>Folders</button>
      </div>

      {/* search */}
      <div style={{ margin: '0 16px 12px', background: CF_COLORS.surface2, borderRadius: 12, padding: '9px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
        {CFIcon.search(CF_COLORS.muted)}
        <span style={{ flex: 1, color: CF_COLORS.muted, fontSize: 14 }}>Search threads</span>
        <span style={{ color: CF_COLORS.accent, fontSize: 13, fontWeight: 500 }}>+ new</span>
      </div>

      {mode === 'flat' ? (
        <div style={{ margin: '0 16px', background: CF_COLORS.surface, borderRadius: 18, overflow: 'hidden', border: `1px solid ${CF_COLORS.border}` }}>
          {threads.map((t, i) => <ThreadRow key={t.id} t={t} onOpen={() => { dispatch({ type: 'setThread', id: t.id }); dispatch({ type: 'goTo', screen: 'chat' }); }} first={i === 0} />)}
        </div>
      ) : (
        <div style={{ margin: '0 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <FolderGroup title="Active" items={active} dispatch={dispatch} />
          <FolderGroup title="Done" items={done} dispatch={dispatch} />
        </div>
      )}
    </div>
  );
}

function FolderGroup({ title, items, dispatch }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: CF_COLORS.muted, letterSpacing: 1.2, textTransform: 'uppercase', padding: '0 8px 6px', fontFamily: 'ui-monospace, Menlo, monospace' }}>{title} · {items.length}</div>
      <div style={{ background: CF_COLORS.surface, borderRadius: 18, overflow: 'hidden', border: `1px solid ${CF_COLORS.border}` }}>
        {items.map((t, i) => <ThreadRow key={t.id} t={t} first={i === 0} onOpen={() => { dispatch({ type: 'setThread', id: t.id }); dispatch({ type: 'goTo', screen: 'chat' }); }} />)}
      </div>
    </div>
  );
}

function ThreadRow({ t, onOpen, first }) {
  return (
    <button onClick={onOpen} style={{
      width: '100%', display: 'flex', gap: 12, padding: '12px 14px',
      background: 'transparent', border: 'none',
      borderTop: first ? 'none' : `1px solid ${CF_COLORS.border}`,
      textAlign: 'left', cursor: 'pointer',
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 9,
        background: t.asking ? CF_COLORS.accent : CF_COLORS.surface2,
        color: t.asking ? '#fff' : CF_COLORS.ink2,
        border: `1px solid ${t.asking ? CF_COLORS.accent : CF_COLORS.border}`,
        display: 'grid', placeItems: 'center', flexShrink: 0,
        fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 11, fontWeight: 600,
      }}>#{t.id.slice(0, 2)}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: CF_COLORS.ink, letterSpacing: -0.2 }}>{t.title}</div>
          <div style={{ fontSize: 11, color: CF_COLORS.muted, fontFamily: 'ui-monospace, Menlo, monospace' }}>{t.updated}</div>
        </div>
        <div style={{ fontSize: 13, color: CF_COLORS.muted, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.last}</div>
      </div>
      {t.unread > 0 && !t.asking && <span style={countStyle}>{t.unread}</span>}
      {t.asking && <span style={askStyle}>ask</span>}
    </button>
  );
}

// ───────────── Chat screen (03 A with header menu)
function CFChat({ state, dispatch }) {
  const agent = state.agents.find(a => a.id === state.agentId);
  const thread = state.threads[state.agentId]?.find(t => t.id === state.threadId);
  const key = `${state.agentId}/${state.threadId}`;
  const msgs = state.messages[key] || [];
  const [showMenu, setShowMenu] = useState(false);
  const [autoApprove, setAutoApprove] = useState(false);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '6px 16px 10px', gap: 10, borderBottom: `1px solid ${CF_COLORS.border}`, background: CF_COLORS.bg }}>
        <button onClick={() => dispatch({ type: 'goTo', screen: 'threads' })} style={navBtnStyle}>
          {CFIcon.back(CF_COLORS.ink2)}
        </button>
        <CFAvatar agent={agent} size={30} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: -0.2 }}>{thread?.title}</div>
          <div style={{ fontSize: 11, color: CF_COLORS.muted, fontFamily: 'ui-monospace, Menlo, monospace' }}>{agent.name} · typing…</div>
        </div>
        <button onClick={() => setShowMenu(v => !v)} style={navBtnStyle}>
          {CFIcon.dots(CF_COLORS.ink2)}
        </button>
      </div>

      {showMenu && (
        <div style={{
          position: 'absolute', top: 88, right: 14, zIndex: 100,
          background: CF_COLORS.surface, borderRadius: 14, padding: 6,
          border: `1px solid ${CF_COLORS.border}`,
          boxShadow: '0 10px 30px rgba(0,0,0,0.12)', minWidth: 200,
        }}>
          <MenuItem label="Auto-approve in thread" right={<Toggle on={autoApprove} onClick={() => setAutoApprove(!autoApprove)} />} />
          <MenuItem label="Mute" />
          <MenuItem label="Rename" />
          <MenuItem label="Export transcript" />
          <MenuItem label="Archive" danger />
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 14px 10px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {msgs.map((m, i) => <Bubble key={i} m={m} dispatch={dispatch} state={state} />)}
        <div style={{ alignSelf: 'flex-start', display: 'flex', gap: 4, padding: '8px 14px', background: CF_COLORS.surface, border: `1px solid ${CF_COLORS.border}`, borderRadius: 14, borderBottomLeftRadius: 4 }}>
          {[0,1,2].map(i => <span key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: CF_COLORS.muted, animation: `dot 1.4s ${i * 0.2}s infinite` }} />)}
        </div>
      </div>

      <div style={{ padding: '8px 12px 14px', borderTop: `1px solid ${CF_COLORS.border}`, background: CF_COLORS.bg, display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, background: CF_COLORS.surface2, borderRadius: 22, padding: '10px 14px', fontSize: 14, color: CF_COLORS.muted, border: `1px solid ${CF_COLORS.border}` }}>
          Reply to {agent.name.split(' ')[0]}…
        </div>
        <button style={{ width: 40, height: 40, borderRadius: '50%', background: CF_COLORS.ink, border: 'none', display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
          {CFIcon.send('#fff')}
        </button>
      </div>
    </div>
  );
}

function Bubble({ m, dispatch, state }) {
  if (m.role === 'me') {
    return <div style={{ alignSelf: 'flex-end', maxWidth: '82%', background: CF_COLORS.ink, color: '#FAF6ED', padding: '9px 13px', borderRadius: 18, borderBottomRightRadius: 5, fontSize: 14, lineHeight: 1.4 }}>{m.text}</div>;
  }
  if (m.role === 'agent') {
    return <div style={{ alignSelf: 'flex-start', maxWidth: '82%', background: CF_COLORS.surface, color: CF_COLORS.ink, padding: '9px 13px', borderRadius: 18, borderBottomLeftRadius: 5, fontSize: 14, lineHeight: 1.4, border: `1px solid ${CF_COLORS.border}` }}>{m.text}</div>;
  }
  if (m.role === 'tool') {
    return (
      <div style={{ alignSelf: 'flex-start', maxWidth: '92%', background: CF_COLORS.surface2, border: `1px solid ${CF_COLORS.border}`, borderRadius: 10, padding: '7px 10px', display: 'flex', gap: 8, alignItems: 'center', fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 11, color: CF_COLORS.ink2 }}>
        {CFIcon.tool(CF_COLORS.muted)}
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name} · {m.args}</span>
        <span style={{ color: CF_COLORS.success, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>{m.result}</span>
      </div>
    );
  }
  if (m.role === 'ask') {
    const key = `${state.agentId}/${state.threadId}`;
    return (
      <div style={{
        alignSelf: 'stretch', background: CF_COLORS.accentSoft,
        border: `1px solid ${CF_COLORS.accent}`, borderRadius: 16, padding: 14,
        display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: CF_COLORS.accent }} />
          <span style={{ fontSize: 11, color: CF_COLORS.accentInk, textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 600 }}>Permission request</span>
        </div>
        <div style={{ fontSize: 15, fontWeight: 600, color: CF_COLORS.ink, letterSpacing: -0.2 }}>{m.title}</div>
        <div style={{ background: CF_COLORS.surface, border: `1px solid ${CF_COLORS.border}`, borderRadius: 10, padding: '8px 10px', fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 11, color: CF_COLORS.ink2, lineHeight: 1.6 }}>
          {m.files.map((f, i) => <div key={i}>{f}</div>)}
          {m.diff && m.diff.length > 0 && (
            <div style={{ marginTop: 6, paddingTop: 6, borderTop: `1px dashed ${CF_COLORS.border}` }}>
              {m.diff.map((d, i) => (
                <div key={i} style={{ color: d.k === '+' ? CF_COLORS.success : CF_COLORS.danger, textDecoration: d.k === '-' ? 'line-through' : 'none' }}>
                  {d.k} {d.text}
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => dispatch({ type: 'approve', key })} style={{ flex: 1, padding: '9px 14px', borderRadius: 11, background: CF_COLORS.ink, color: '#fff', border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            {CFIcon.check('#fff')} Approve
          </button>
          <button onClick={() => dispatch({ type: 'deny', key })} style={{ padding: '9px 14px', borderRadius: 11, background: CF_COLORS.surface, color: CF_COLORS.ink2, border: `1px solid ${CF_COLORS.border}`, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
            Deny
          </button>
          <button style={{ padding: '9px 14px', borderRadius: 11, background: 'transparent', color: CF_COLORS.ink2, border: `1px solid ${CF_COLORS.border}`, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
            Edit
          </button>
        </div>
      </div>
    );
  }
  if (m.role === 'resolved') {
    return <div style={{ alignSelf: 'stretch', background: CF_COLORS.successSoft, border: `1px solid ${CF_COLORS.success}`, borderRadius: 14, padding: '10px 12px', display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: CF_COLORS.success, fontWeight: 500 }}>
      {CFIcon.check(CF_COLORS.success)} {m.text}
    </div>;
  }
  return null;
}

function MenuItem({ label, right, danger }) {
  return (
    <div style={{ padding: '9px 12px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', borderRadius: 10, fontSize: 14, color: danger ? CF_COLORS.danger : CF_COLORS.ink }}>
      <span style={{ flex: 1 }}>{label}</span>
      {right}
    </div>
  );
}

function Toggle({ on, onClick }) {
  return (
    <div onClick={onClick} style={{
      width: 40, height: 24, borderRadius: 12,
      background: on ? CF_COLORS.success : CF_COLORS.surface3,
      position: 'relative', cursor: 'pointer', transition: 'background 0.18s',
    }}>
      <div style={{ position: 'absolute', top: 2, left: on ? 18 : 2, width: 20, height: 20, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 0.18s' }} />
    </div>
  );
}

// ───────────── Alerts
function CFAlerts({ state, dispatch }) {
  return (
    <div style={{ paddingBottom: 100 }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '6px 16px' }}>
        <button onClick={() => dispatch({ type: 'openDrawer' })} style={navBtnStyle}>{CFIcon.menu(CF_COLORS.ink2)}</button>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 13, color: CF_COLORS.accent, fontWeight: 500 }}>Mark all read</span>
      </div>
      <div style={{ padding: '4px 20px 12px' }}>
        <div style={{ fontSize: 32, fontWeight: 700, letterSpacing: -0.8, lineHeight: 1.1 }}>Alerts</div>
        <div style={{ fontSize: 13, color: CF_COLORS.muted, marginTop: 2 }}>Approvals and activity from all agents</div>
      </div>

      <div style={{ margin: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {state.alerts.filter(a => a.kind === 'ask').map(al => {
          const ag = state.agents.find(x => x.id === al.agent);
          return (
            <div key={al.id} style={{
              background: CF_COLORS.accentSoft, borderRadius: 16, padding: 14,
              border: `1px solid ${CF_COLORS.accent}`,
              display: 'flex', flexDirection: 'column', gap: 10,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <CFAvatar agent={ag} size={32} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: CF_COLORS.ink }}>{ag.name} · {al.thread}</div>
                  <div style={{ fontSize: 11, color: CF_COLORS.accentInk, fontFamily: 'ui-monospace, Menlo, monospace' }}>needs approval · {al.when}</div>
                </div>
              </div>
              <div style={{ fontSize: 15, color: CF_COLORS.ink }}>{al.title}</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => dispatch({ type: 'approve', key: `${al.agent}/${al.thread}` })}
                  style={{ flex: 1, padding: '9px 0', borderRadius: 11, background: CF_COLORS.ink, color: '#fff', border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                  Approve
                </button>
                <button onClick={() => dispatch({ type: 'deny', key: `${al.agent}/${al.thread}` })}
                  style={{ padding: '9px 18px', borderRadius: 11, background: CF_COLORS.surface, color: CF_COLORS.ink2, border: `1px solid ${CF_COLORS.border}`, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
                  Deny
                </button>
                <button onClick={() => { dispatch({ type: 'setAgent', id: al.agent }); dispatch({ type: 'setThread', id: al.thread }); dispatch({ type: 'goTo', screen: 'chat' }); }}
                  style={{ padding: '9px 14px', borderRadius: 11, background: 'transparent', color: CF_COLORS.ink2, border: `1px solid ${CF_COLORS.border}`, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
                  Open
                </button>
              </div>
            </div>
          );
        })}

        <div style={{ fontSize: 11, color: CF_COLORS.muted, letterSpacing: 1.2, textTransform: 'uppercase', padding: '8px 0 0', fontFamily: 'ui-monospace, Menlo, monospace' }}>Earlier</div>

        {state.alerts.filter(a => a.kind === 'info').map(al => {
          const ag = state.agents.find(x => x.id === al.agent);
          return (
            <button key={al.id} onClick={() => { dispatch({ type: 'setAgent', id: al.agent }); dispatch({ type: 'setThread', id: al.thread }); dispatch({ type: 'goTo', screen: 'chat' }); }}
              style={{ display: 'flex', gap: 10, padding: '10px 12px', background: CF_COLORS.surface, border: `1px solid ${CF_COLORS.border}`, borderRadius: 12, textAlign: 'left', cursor: 'pointer' }}>
              <CFAvatar agent={ag} size={30} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: CF_COLORS.ink }}>{al.title}</div>
                <div style={{ fontSize: 11, color: CF_COLORS.muted, fontFamily: 'ui-monospace, Menlo, monospace', marginTop: 2 }}>{ag.name.toLowerCase()} · {al.when}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ───────────── Pair
function CFPair({ state, dispatch }) {
  const [stage, setStage] = useState('scan');

  useEffect(() => {
    if (stage === 'scan') {
      const t = setTimeout(() => setStage('found'), 2800);
      return () => clearTimeout(t);
    }
  }, [stage]);

  return (
    <div style={{ paddingBottom: 100 }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '6px 16px' }}>
        <button onClick={() => dispatch({ type: 'goTo', screen: 'agents' })} style={navBtnStyle}>{CFIcon.x(CF_COLORS.ink2)}</button>
        <div style={{ flex: 1 }} />
      </div>
      <div style={{ padding: '4px 20px 12px' }}>
        <div style={{ fontSize: 32, fontWeight: 700, letterSpacing: -0.8, lineHeight: 1.1 }}>Pair agent</div>
        <div style={{ fontSize: 13, color: CF_COLORS.muted, marginTop: 4 }}>
          {stage === 'scan' && 'Point your camera at the QR code shown in OpenClaw on your machine.'}
          {stage === 'found' && 'Found a machine. Confirm the fingerprint matches.'}
          {stage === 'done' && 'Agent paired. Give them a name.'}
        </div>
      </div>

      {stage === 'scan' && (
        <div style={{ margin: '0 16px', aspectRatio: '1/1', background: '#1A1815', borderRadius: 24, position: 'relative', overflow: 'hidden' }}>
          {[['tl', 'top: 16px; left: 16px', 'border-top-width: 3px; border-left-width: 3px'],
            ['tr', 'top: 16px; right: 16px', 'border-top-width: 3px; border-right-width: 3px'],
            ['bl', 'bottom: 16px; left: 16px', 'border-bottom-width: 3px; border-left-width: 3px'],
            ['br', 'bottom: 16px; right: 16px', 'border-bottom-width: 3px; border-right-width: 3px']].map(([k, pos, bw]) => (
            <div key={k} style={{ position: 'absolute', width: 40, height: 40, borderColor: CF_COLORS.accent, borderStyle: 'solid', borderWidth: 0, ...Object.fromEntries(pos.split(';').map(s => s.trim().split(':').map(x => x.trim()))), ...Object.fromEntries(bw.split(';').map(s => s.trim().split(':').map(x => x.trim()))) }} />
          ))}
          <div style={{ position: 'absolute', left: '14%', right: '14%', top: '50%', height: 2, background: CF_COLORS.accent, boxShadow: `0 0 14px ${CF_COLORS.accent}`, animation: 'scan 2.4s ease-in-out infinite' }} />
          <div style={{ position: 'absolute', bottom: 20, left: 0, right: 0, textAlign: 'center', color: 'rgba(255,255,255,0.7)', fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 11, letterSpacing: 1 }}>LOOKING FOR QR…</div>
        </div>
      )}

      {stage === 'found' && (
        <div style={{ margin: '0 16px', background: CF_COLORS.surface, borderRadius: 24, padding: 20, border: `1px solid ${CF_COLORS.border}` }}>
          <div style={{ fontSize: 11, color: CF_COLORS.muted, letterSpacing: 1.2, textTransform: 'uppercase', fontFamily: 'ui-monospace, Menlo, monospace' }}>Machine</div>
          <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4, letterSpacing: -0.5 }}>studio.local</div>
          <div style={{ marginTop: 14, padding: 12, background: CF_COLORS.surface2, borderRadius: 12, fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 12, color: CF_COLORS.ink2, wordBreak: 'break-all' }}>
            fp: 4a:8f:e2:9c:b1:77:3d:28<br/>
            ed25519 · openclaw 0.4.2
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button onClick={() => setStage('done')} style={{ flex: 1, padding: '12px', borderRadius: 12, background: CF_COLORS.ink, color: '#fff', border: 'none', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>Confirm & pair</button>
            <button onClick={() => setStage('scan')} style={{ padding: '12px 18px', borderRadius: 12, background: CF_COLORS.surface, color: CF_COLORS.ink2, border: `1px solid ${CF_COLORS.border}`, fontSize: 15, cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {stage === 'done' && (
        <div style={{ margin: '0 16px', background: CF_COLORS.surface, borderRadius: 24, padding: 20, border: `1px solid ${CF_COLORS.border}`, textAlign: 'center' }}>
          <div style={{ width: 60, height: 60, borderRadius: 20, background: CF_COLORS.successSoft, display: 'grid', placeItems: 'center', margin: '0 auto 12px' }}>
            {CFIcon.check(CF_COLORS.success)}
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.3 }}>Paired!</div>
          <div style={{ fontSize: 13, color: CF_COLORS.muted, marginTop: 6 }}>Name this agent so you can find them later.</div>
          <input placeholder="Betty Shellstein" style={{ width: '100%', marginTop: 14, padding: '12px 14px', borderRadius: 12, border: `1px solid ${CF_COLORS.border}`, fontSize: 15, background: CF_COLORS.surface2, textAlign: 'center', fontFamily: '-apple-system, system-ui', outline: 'none', boxSizing: 'border-box' }} />
          <button onClick={() => dispatch({ type: 'goTo', screen: 'agents' })} style={{ width: '100%', marginTop: 10, padding: '12px', borderRadius: 12, background: CF_COLORS.ink, color: '#fff', border: 'none', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>Done</button>
        </div>
      )}

      <div style={{ textAlign: 'center', padding: '20px 0 0', fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 10, color: CF_COLORS.muted, letterSpacing: 1 }}>— OR —</div>
      <div style={{ margin: '10px 16px', background: CF_COLORS.surface, borderRadius: 18, border: `1px solid ${CF_COLORS.border}`, overflow: 'hidden' }}>
        <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', borderBottom: `1px solid ${CF_COLORS.border}` }}>
          <span style={{ flex: 1, fontSize: 14 }}>Paste link</span>
          <span style={{ color: CF_COLORS.muted, fontSize: 12, fontFamily: 'ui-monospace, Menlo, monospace' }}>clawface://…</span>
        </div>
        <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center' }}>
          <span style={{ flex: 1, fontSize: 14 }}>Enter code</span>
          <span style={{ color: CF_COLORS.muted, fontSize: 13, fontFamily: 'ui-monospace, Menlo, monospace' }}>_ _ _-_ _ _ _</span>
        </div>
      </div>
    </div>
  );
}

// ───────────── Config (per-agent, from ⋯)
function CFConfig({ state, dispatch }) {
  const agent = state.agents.find(a => a.id === state.agentId);
  const [perms, setPerms] = useState({ read: true, write: 'ask', shell: false, net: 'ask' });

  return (
    <div style={{ paddingBottom: 100 }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '6px 16px', gap: 10 }}>
        <button onClick={() => dispatch({ type: 'goTo', screen: 'threads' })} style={navBtnStyle}>{CFIcon.back(CF_COLORS.ink2)}</button>
        <div style={{ flex: 1 }} />
      </div>
      <div style={{ padding: '4px 20px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
        <CFAvatar agent={agent} size={56} dot={agent.online ? 'online' : 'off'} />
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.4 }}>{agent.name}</div>
          <div style={{ fontSize: 12, color: CF_COLORS.muted, fontFamily: 'ui-monospace, Menlo, monospace' }}>{agent.host} · paired {agent.paired}</div>
        </div>
      </div>

      <Group title="Identity">
        <Row k="Nickname" v={agent.name} chev />
        <Row k="Avatar color" v={<span style={{ width: 20, height: 20, borderRadius: 6, background: agent.tint, display: 'inline-block', border: `1px solid ${CF_COLORS.border}` }} />} chev />
        <Row k="Status" v="Online · 12m" />
      </Group>

      <Group title="Permissions">
        <Row k="Read files" v={<Toggle on={perms.read} onClick={() => setPerms(p => ({...p, read: !p.read}))} />} />
        <Row k="Write files" v={<><span style={{ fontSize: 11, color: CF_COLORS.warn, background: CF_COLORS.warnSoft, padding: '2px 8px', borderRadius: 6, marginRight: 8, fontWeight: 500 }}>ask each</span><Toggle on={perms.write !== false} onClick={() => setPerms(p => ({...p, write: p.write === false ? 'ask' : false}))} /></>} />
        <Row k="Run shell" v={<Toggle on={perms.shell} onClick={() => setPerms(p => ({...p, shell: !p.shell}))} />} />
        <Row k="Network" v={<><span style={{ fontSize: 11, color: CF_COLORS.warn, background: CF_COLORS.warnSoft, padding: '2px 8px', borderRadius: 6, marginRight: 8, fontWeight: 500 }}>ask each</span><Toggle on={perms.net !== false} onClick={() => setPerms(p => ({...p, net: p.net === false ? 'ask' : false}))} /></>} />
      </Group>

      <Group title="Notifications">
        <Row k="Approval requests" v="Push + sound" chev />
        <Row k="Completions" v="Silent" chev />
        <Row k="Quiet hours" v="10p–8a" chev />
      </Group>

      <div style={{ padding: '20px 20px 0' }}>
        <button style={{ width: '100%', padding: '12px', borderRadius: 12, background: 'transparent', color: CF_COLORS.danger, border: `1px solid ${CF_COLORS.danger}`, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>Unpair agent</button>
      </div>
    </div>
  );
}

function Group({ title, children }) {
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ padding: '0 28px 6px', fontSize: 11, color: CF_COLORS.muted, letterSpacing: 1.2, textTransform: 'uppercase', fontFamily: 'ui-monospace, Menlo, monospace' }}>{title}</div>
      <div style={{ margin: '0 16px', background: CF_COLORS.surface, borderRadius: 18, overflow: 'hidden', border: `1px solid ${CF_COLORS.border}` }}>
        {children}
      </div>
    </div>
  );
}
function Row({ k, v, chev }) {
  return (
    <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10, borderTop: `1px solid ${CF_COLORS.border}`, fontSize: 14 }}>
      <span style={{ flex: 1, color: CF_COLORS.ink }}>{k}</span>
      <span style={{ color: CF_COLORS.muted, display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>{v}</span>
      {chev && CFIcon.chev(CF_COLORS.muted)}
    </div>
  );
}

// ───────────── Me / Settings
function CFMe({ state, dispatch }) {
  return (
    <div style={{ paddingBottom: 100 }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '6px 16px' }}>
        <button onClick={() => dispatch({ type: 'openDrawer' })} style={navBtnStyle}>{CFIcon.menu(CF_COLORS.ink2)}</button>
      </div>
      <div style={{ padding: '4px 20px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 56, height: 56, borderRadius: 18, background: '#D9CDEC', color: CF_COLORS.ink, display: 'grid', placeItems: 'center', fontSize: 24, fontWeight: 600 }}>N</div>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.4 }}>Noah</div>
          <div style={{ fontSize: 12, color: CF_COLORS.muted, fontFamily: 'ui-monospace, Menlo, monospace' }}>noah@example.com · Pro plan</div>
        </div>
      </div>
      <Group title="Device">
        <Row k="Biometric unlock" v={<Toggle on onClick={() => {}} />} />
        <Row k="Push notifications" v={<Toggle on onClick={() => {}} />} />
      </Group>
      <Group title="Appearance">
        <Row k="Theme" v="Light" chev />
        <Row k="Bubble density" v="Comfortable" chev />
      </Group>
      <Group title="About">
        <Row k="Version" v="0.4.2" />
        <Row k="Privacy" v="" chev />
        <Row k="Sign out" v="" chev />
      </Group>
    </div>
  );
}

// ───────────── Drawer
function CFDrawer({ state, dispatch }) {
  return (
    <>
      <div onClick={() => dispatch({ type: 'closeDrawer' })} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 200, animation: 'fade 0.2s' }} />
      <div style={{
        position: 'absolute', top: 54, left: 12, right: 12, zIndex: 210,
        background: CF_COLORS.surface, borderRadius: 22,
        padding: 14, boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
        animation: 'slideDown 0.24s cubic-bezier(.2,.9,.2,1)',
        border: `1px solid ${CF_COLORS.border}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: -0.3 }}>Switch agent</div>
          <div style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 10, color: CF_COLORS.muted, letterSpacing: 1.2, textTransform: 'uppercase' }}>Long-press tab bar</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {state.agents.map((a, i) => {
            const asking = state.alerts.some(al => al.kind === 'ask' && al.agent === a.id);
            const active = a.id === state.agentId;
            return (
              <button key={a.id}
                onClick={() => { dispatch({ type: 'setAgent', id: a.id }); dispatch({ type: 'goTo', screen: 'threads' }); dispatch({ type: 'closeDrawer' }); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 10px', borderRadius: 12,
                  background: active ? CF_COLORS.surface2 : 'transparent',
                  border: 'none', cursor: 'pointer', textAlign: 'left',
                }}>
                <CFAvatar agent={a} size={34} dot={asking ? 'ask' : (a.online ? 'online' : 'off')} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: CF_COLORS.ink, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {a.name}
                    {active && <span style={{ fontSize: 10, color: CF_COLORS.accent, fontWeight: 500 }}>● active</span>}
                  </div>
                  <div style={{ fontSize: 11, color: asking ? CF_COLORS.accent : CF_COLORS.muted, fontFamily: 'ui-monospace, Menlo, monospace' }}>
                    {asking ? 'needs approval' : `${a.role} · ${a.online ? 'online' : 'offline'}`}
                  </div>
                </div>
                <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 10, color: CF_COLORS.muted, background: CF_COLORS.surface2, padding: '2px 5px', borderRadius: 5 }}>⌘{i+1}</span>
              </button>
            );
          })}
        </div>
        <div style={{ borderTop: `1px dashed ${CF_COLORS.border}`, marginTop: 8, paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <button onClick={() => { dispatch({ type: 'goTo', screen: 'pair' }); dispatch({ type: 'closeDrawer' }); }} style={drawerItemStyle}>
            <span style={{ width: 34, height: 34, borderRadius: 10, background: CF_COLORS.surface2, border: `1px dashed ${CF_COLORS.borderStrong}`, display: 'grid', placeItems: 'center' }}>{CFIcon.plus(CF_COLORS.ink2)}</span>
            <span>Pair new agent</span>
          </button>
          <button style={drawerItemStyle}>
            <span style={{ width: 34, height: 34, borderRadius: 10, background: CF_COLORS.surface2, display: 'grid', placeItems: 'center', color: CF_COLORS.ink2 }}>↻</span>
            <span>Reconnect all</span>
          </button>
        </div>
      </div>
    </>
  );
}

// ───────────── Shared styles
const navBtnStyle = {
  width: 38, height: 38, borderRadius: 12,
  background: 'transparent', border: 'none',
  display: 'grid', placeItems: 'center', cursor: 'pointer',
};
const askStyle = {
  background: CF_COLORS.accent, color: '#fff',
  padding: '3px 9px', borderRadius: 8, fontSize: 11, fontWeight: 600,
  textTransform: 'uppercase', letterSpacing: 0.5,
};
const countStyle = {
  background: CF_COLORS.ink, color: CF_COLORS.bg,
  minWidth: 20, height: 20, padding: '0 6px', borderRadius: 10,
  fontSize: 11, fontWeight: 600,
  display: 'grid', placeItems: 'center',
};
const segStyle = (on) => ({
  flex: 1, padding: '7px 0', borderRadius: 9,
  background: on ? CF_COLORS.surface : 'transparent',
  color: on ? CF_COLORS.ink : CF_COLORS.ink2,
  border: 'none', fontSize: 13, fontWeight: on ? 600 : 500, cursor: 'pointer',
  fontFamily: '-apple-system, system-ui, sans-serif',
  boxShadow: on ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
});
const drawerItemStyle = {
  display: 'flex', alignItems: 'center', gap: 10,
  padding: '8px 10px', borderRadius: 12,
  background: 'transparent', border: 'none', cursor: 'pointer',
  textAlign: 'left', fontSize: 14, color: CF_COLORS.ink,
  fontFamily: '-apple-system, system-ui, sans-serif', fontWeight: 500,
};

Object.assign(window, { CFAgents, CFThreads, CFChat, CFAlerts, CFPair, CFConfig, CFMe, CFDrawer });

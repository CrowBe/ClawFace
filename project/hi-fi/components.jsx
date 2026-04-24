// Primitives + icons for ClawFace hi-fi
const { useState: uS1, useEffect: uE1, useRef: uR1 } = React;

// ── Icons (20px stroke, rounded) ────────────────────
const Icon = ({ d, size = 20, stroke = 1.8, fill = 'none', style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor"
    strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" style={style}>
    {typeof d === 'string' ? <path d={d}/> : d}
  </svg>
);
const I = {
  menu: <Icon d="M3 6h18M3 12h18M3 18h18"/>,
  plus: <Icon d="M12 5v14M5 12h14"/>,
  close: <Icon d="M6 6l12 12M18 6L6 18"/>,
  back: <Icon d="M15 6l-6 6 6 6"/>,
  more: <Icon d={<g><circle cx="5" cy="12" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="19" cy="12" r="1.2" fill="currentColor"/></g>}/>,
  search: <Icon d={<g><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></g>}/>,
  gear: <Icon d={<g><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4 12H1M23 12h-3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/></g>}/>,
  send: <Icon d="M4 12l16-8-4 18-5-7-7-3z"/>,
  users: <Icon d={<g><circle cx="9" cy="8" r="4"/><path d="M2 20c0-4 3-6 7-6s7 2 7 6"/><circle cx="17" cy="9" r="3"/><path d="M22 20c0-3-2-5-5-5"/></g>}/>,
  inbox: <Icon d={<g><path d="M3 13l3-8h12l3 8v6H3z"/><path d="M3 13h5l1 3h6l1-3h5"/></g>}/>,
  bell: <Icon d={<g><path d="M6 8a6 6 0 0112 0c0 7 3 8 3 8H3s3-1 3-8z"/><path d="M10 21a2 2 0 004 0"/></g>}/>,
  person: <Icon d={<g><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-7 8-7s8 3 8 7"/></g>}/>,
  qr: <Icon d={<g><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3M21 14v7h-7"/></g>}/>,
  check: <Icon d="M5 12l5 5 9-10"/>,
  x: <Icon d="M6 6l12 12M18 6L6 18"/>,
  dot: <Icon d={<circle cx="12" cy="12" r="3" fill="currentColor"/>}/>,
  chevR: <Icon d="M9 6l6 6-6 6" size={16} stroke={2.2}/>,
  flash: <Icon d="M13 2L4 14h7l-1 8 9-12h-7z"/>,
  terminal: <Icon d={<g><path d="M5 8l3 4-3 4"/><path d="M12 16h6"/><rect x="2" y="4" width="20" height="16" rx="2"/></g>}/>,
  file: <Icon d={<g><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/></g>}/>,
  shield: <Icon d="M12 2l8 3v7c0 5-4 9-8 10-4-1-8-5-8-10V5z"/>,
  wifi: <Icon d={<g><path d="M2 8a15 15 0 0120 0"/><path d="M5 12a10 10 0 0114 0"/><path d="M8.5 15.5a5 5 0 017 0"/><circle cx="12" cy="19" r="1" fill="currentColor"/></g>}/>,
  pencil: <Icon d="M15 4l5 5L9 20H4v-5z"/>,
  unpair: <Icon d="M12 2l-4 4 4 4M8 6h8a4 4 0 014 4v0M12 22l4-4-4-4M16 18H8a4 4 0 01-4-4v0"/>,
  copy: <Icon d={<g><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V5a2 2 0 012-2h8a2 2 0 012 2v1"/></g>}/>,
};
window.I = I;

// ── Avatar ─────────────────────────────────────────
function Avatar({ agent, size = 40, showDot = true, attention = false }) {
  const r = size * 0.27;
  return (
    <div style={{
      width: size, height: size, borderRadius: r,
      background: agent.tint, display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: '-apple-system, system-ui', fontWeight: 600,
      fontSize: size * 0.42, color: '#2A2824', position: 'relative', flexShrink: 0,
      letterSpacing: -0.5,
    }}>
      {agent.mono}
      {showDot && (
        <div style={{
          position: 'absolute', bottom: -1, right: -1,
          width: Math.max(9, size * 0.26), height: Math.max(9, size * 0.26),
          borderRadius: '50%', border: '2px solid #F7F5F0',
          background: attention ? '#D9541A' : agent.online ? '#3E8E5B' : '#B8B3A5',
          boxShadow: attention ? '0 0 0 0 rgba(217,84,26,0.6)' : 'none',
          animation: attention ? 'pulseDot 1.8s infinite' : 'none',
        }}/>
      )}
    </div>
  );
}
window.Avatar = Avatar;

// ── Row ────────────────────────────────────────────
function Row({ left, title, subtitle, right, onClick, accent, divider = true, style }) {
  return (
    <div onClick={onClick} style={{
      display: 'flex', gap: 12, alignItems: 'center',
      padding: '12px 20px', cursor: onClick ? 'pointer' : 'default',
      borderBottom: divider ? '0.5px solid rgba(60,60,67,0.1)' : 'none',
      background: accent ? 'rgba(217,84,26,0.06)' : 'transparent',
      borderLeft: accent ? '3px solid #D9541A' : '3px solid transparent',
      paddingLeft: accent ? 17 : 20,
      ...style,
    }}>
      {left}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 16, fontWeight: 500, color: '#1A1916', letterSpacing: -0.2, lineHeight: 1.25 }}>{title}</div>
        {subtitle && <div style={{ fontSize: 13, color: '#7C7868', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{subtitle}</div>}
      </div>
      {right && <div style={{ flexShrink: 0 }}>{right}</div>}
    </div>
  );
}
window.Row = Row;

// ── Pill button ────────────────────────────────────
function Pill({ onClick, active, warn, children, style }) {
  const bg = active ? '#1A1916' : warn ? '#FDEEE4' : '#EEEADD';
  const color = active ? '#F7F5F0' : warn ? '#D9541A' : '#3A3830';
  return (
    <button onClick={onClick} style={{
      border: 'none', padding: '6px 12px', borderRadius: 999,
      background: bg, color, fontSize: 13, fontWeight: 500,
      cursor: 'pointer', fontFamily: 'inherit',
      display: 'inline-flex', alignItems: 'center', gap: 6,
      ...style,
    }}>{children}</button>
  );
}
window.Pill = Pill;

// ── Segmented control ─────────────────────────────
function Segmented({ value, onChange, options }) {
  return (
    <div style={{
      display: 'flex', padding: 3, borderRadius: 10,
      background: '#EEEADD', gap: 2,
    }}>
      {options.map(o => (
        <button key={o.value} onClick={() => onChange(o.value)} style={{
          flex: 1, padding: '6px 10px', border: 'none',
          borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer',
          fontFamily: 'inherit',
          background: value === o.value ? '#F7F5F0' : 'transparent',
          color: value === o.value ? '#1A1916' : '#7C7868',
          boxShadow: value === o.value ? '0 1px 2px rgba(0,0,0,0.04)' : 'none',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}>{o.label}{o.badge != null && (
          <span style={{
            background: value === o.value ? '#D9541A' : '#D9541A', color: '#fff',
            fontSize: 10, fontWeight: 600, padding: '0 5px', borderRadius: 6, minWidth: 14,
            height: 14, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}>{o.badge}</span>
        )}</button>
      ))}
    </div>
  );
}
window.Segmented = Segmented;

// ── Toggle ─────────────────────────────────────────
function Toggle({ value, onChange }) {
  return (
    <button onClick={() => onChange(!value)} style={{
      width: 48, height: 28, borderRadius: 14, border: 'none',
      background: value ? '#3E8E5B' : '#D5D0C2',
      position: 'relative', cursor: 'pointer', transition: 'background 0.18s',
      padding: 0, flexShrink: 0,
    }}>
      <div style={{
        position: 'absolute', top: 2, left: value ? 22 : 2,
        width: 24, height: 24, borderRadius: '50%',
        background: '#fff', transition: 'left 0.18s',
        boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
      }}/>
    </button>
  );
}
window.Toggle = Toggle;

// ── Tool call chip ────────────────────────────────
function ToolCall({ msg }) {
  return (
    <div style={{
      alignSelf: 'flex-start', maxWidth: '90%',
      background: '#F0ECE0', border: '0.5px solid rgba(60,60,67,0.1)',
      borderRadius: 12, padding: '8px 10px',
      display: 'flex', gap: 8, alignItems: 'center',
      fontFamily: 'ui-monospace, "SF Mono", monospace', fontSize: 11, color: '#5A5749',
    }}>
      <span style={{ color: '#8A8778' }}>{I.terminal}</span>
      <span style={{ fontWeight: 600 }}>{msg.name}</span>
      {msg.arg && <span style={{ color: '#7C7868' }}>{msg.arg}</span>}
      <span style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
        {msg.result && <span style={{ color: '#7C7868' }}>{msg.result}</span>}
        <span style={{
          fontSize: 9, letterSpacing: 0.5, textTransform: 'uppercase',
          color: msg.status === 'done' ? '#3E8E5B' : '#D9541A', fontWeight: 700,
        }}>{msg.status}</span>
      </span>
    </div>
  );
}
window.ToolCall = ToolCall;

// ── Approval card (in chat stream) ─────────────────
function ApprovalCard({ msg, onApprove, onDeny }) {
  const pending = msg.status === 'pending';
  const color = msg.status === 'approved' ? '#3E8E5B' : msg.status === 'denied' ? '#7C7868' : '#D9541A';
  return (
    <div style={{
      alignSelf: 'stretch', margin: '4px 0',
      background: pending ? '#FEF6EF' : '#F7F5F0',
      border: `1px solid ${pending ? '#F5CBA6' : 'rgba(60,60,67,0.1)'}`,
      borderRadius: 16, padding: 14, display: 'flex', flexDirection: 'column', gap: 10,
      opacity: pending ? 1 : 0.75,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ color }}>{I.shield}</div>
        <div style={{ fontSize: 15, fontWeight: 600, color: '#1A1916' }}>{msg.summary}</div>
        <div style={{ marginLeft: 'auto', fontSize: 10, letterSpacing: 0.6, textTransform: 'uppercase', color, fontWeight: 700 }}>
          {msg.status}
        </div>
      </div>
      {msg.files && (
        <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, color: '#5A5749', lineHeight: 1.6 }}>
          {msg.files.map((f, i) => <div key={i}>{f}</div>)}
        </div>
      )}
      {msg.diff && (
        <div style={{
          background: '#FAF7EE', border: '0.5px solid rgba(60,60,67,0.08)',
          borderRadius: 10, padding: 10, fontFamily: 'ui-monospace, monospace',
          fontSize: 11, lineHeight: 1.7,
        }}>
          {msg.diff.map((d, i) => (
            <div key={i} style={{
              color: d.type === 'plus' ? '#2F6F46' : d.type === 'minus' ? '#A6392B' : '#5A5749',
              textDecoration: d.type === 'minus' ? 'line-through' : 'none',
            }}>
              <span style={{ opacity: 0.5, marginRight: 6 }}>
                {d.type === 'plus' ? '+' : d.type === 'minus' ? '−' : '›'}
              </span>
              {d.text}
            </div>
          ))}
        </div>
      )}
      {pending && (
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onDeny} style={{
            flex: 1, padding: '10px', borderRadius: 10, border: '1px solid rgba(60,60,67,0.15)',
            background: '#fff', color: '#3A3830', fontWeight: 600, fontSize: 14,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>Deny</button>
          <button onClick={onApprove} style={{
            flex: 2, padding: '10px', borderRadius: 10, border: 'none',
            background: '#1A1916', color: '#F7F5F0', fontWeight: 600, fontSize: 14,
            cursor: 'pointer', fontFamily: 'inherit',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
            <span style={{ width: 16, height: 16 }}>{I.check}</span>
            Approve
          </button>
        </div>
      )}
    </div>
  );
}
window.ApprovalCard = ApprovalCard;

// ── Message bubble ────────────────────────────────
function Bubble({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <div style={{
      alignSelf: isUser ? 'flex-end' : 'flex-start',
      maxWidth: '80%', padding: '9px 13px', borderRadius: 18,
      background: isUser ? '#1A1916' : '#F0ECE0',
      color: isUser ? '#F7F5F0' : '#1A1916',
      fontSize: 15, lineHeight: 1.35, letterSpacing: -0.15,
      borderBottomRightRadius: isUser ? 6 : 18,
      borderBottomLeftRadius: isUser ? 18 : 6,
    }}>
      {msg.text}
    </div>
  );
}
window.Bubble = Bubble;

// ── TabBar ─────────────────────────────────────────
function TabBar() {
  const { useStore, navigate, sel } = window.CF;
  const route = useStore(s => s.route);
  const pending = useStore(sel.pendingApprovals).length;
  const agentsWithPending = useStore(sel.agentsWithPending).size;

  const tabs = [
    { id: 'agents', icon: I.users, label: 'Agents', route: { name: 'agents' }, badge: agentsWithPending || null },
    { id: 'alerts', icon: I.bell, label: 'Alerts', route: { name: 'alerts' }, badge: pending || null },
    { id: 'me', icon: I.person, label: 'Me', route: { name: 'me' } },
  ];
  const isActive = (tab) => {
    if (tab.id === 'agents') return ['agents','threads','chat'].includes(route.name);
    return route.name === tab.id;
  };
  return (
    <div style={{
      flexShrink: 0, padding: '8px 12px 24px',
      background: 'rgba(247,245,240,0.92)', backdropFilter: 'blur(20px) saturate(180%)',
      WebkitBackdropFilter: 'blur(20px) saturate(180%)',
      borderTop: '0.5px solid rgba(60,60,67,0.12)',
      display: 'flex', justifyContent: 'space-around',
    }}>
      {tabs.map(t => {
        const active = isActive(t);
        return (
          <button key={t.id} onClick={() => navigate(t.route)} style={{
            flex: 1, background: 'none', border: 'none', cursor: 'pointer',
            padding: '6px 4px', display: 'flex', flexDirection: 'column',
            alignItems: 'center', gap: 3, color: active ? '#1A1916' : '#8A8778',
            position: 'relative', fontFamily: 'inherit',
          }}>
            {t.icon}
            <span style={{ fontSize: 10, fontWeight: 500, letterSpacing: 0.2 }}>{t.label}</span>
            {t.badge && (
              <span style={{
                position: 'absolute', top: 2, right: '28%',
                background: '#D9541A', color: '#fff',
                minWidth: 16, height: 16, padding: '0 4px', borderRadius: 8,
                fontSize: 10, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '1.5px solid #F7F5F0',
              }}>{t.badge}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
window.TabBar = TabBar;

// ── TopBar (header on every screen) ───────────────
function TopBar({ title, subtitle, leading, trailing, large = true }) {
  const { actions } = window.CF;
  const Leading = leading ?? (
    <button onClick={() => actions.toggleDrawer(true)} style={{
      width: 38, height: 38, borderRadius: 12, border: 'none',
      background: 'rgba(238,234,221,0.6)', cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#1A1916',
    }}>{I.menu}</button>
  );
  return (
    <div style={{ padding: '8px 16px 12px', background: '#F7F5F0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 38 }}>
        {Leading}
        <div style={{ flex: 1 }}/>
        {trailing}
      </div>
      {large && (
        <div style={{ padding: '10px 4px 4px' }}>
          <div style={{
            fontSize: 32, fontWeight: 700, letterSpacing: -0.8,
            color: '#1A1916', lineHeight: 1.1,
          }}>{title}</div>
          {subtitle && <div style={{ fontSize: 13, color: '#7C7868', marginTop: 4 }}>{subtitle}</div>}
        </div>
      )}
    </div>
  );
}
window.TopBar = TopBar;

// ── Toast ─────────────────────────────────────────
function Toast() {
  const { useStore } = window.CF;
  const toast = useStore(s => s.toast);
  if (!toast) return null;
  return (
    <div style={{
      position: 'absolute', top: 70, left: '50%', transform: 'translateX(-50%)',
      background: 'rgba(26,25,22,0.92)', color: '#F7F5F0',
      padding: '10px 18px', borderRadius: 999, fontSize: 13, fontWeight: 500,
      zIndex: 300, boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
      backdropFilter: 'blur(12px)',
      animation: 'toastIn 0.25s',
    }}>{toast}</div>
  );
}
window.Toast = Toast;

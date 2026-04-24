// cf-ui.jsx — shared primitives for ClawFace hi-fi

const CF_COLORS = {
  bg: '#F7F4EC',
  surface: '#FFFFFF',
  surface2: '#F0ECE2',
  surface3: '#E6E1D4',
  border: '#E2DDCF',
  borderStrong: '#CFC9BA',
  ink: '#1A1815',
  ink2: '#4A463E',
  muted: '#8E8978',
  accent: '#D9541A',
  accentSoft: '#FDEEE4',
  accentInk: '#8A2E0D',
  success: '#3E8E5B',
  successSoft: '#E5F1E9',
  warn: '#B88615',
  warnSoft: '#FBF0D4',
  danger: '#B33B2A',
};

// Simple avatar monogram
function CFAvatar({ agent, size = 40, dot }) {
  const a = typeof agent === 'string' ? CF_AGENTS.find(x => x.id === agent) : agent;
  if (!a) return null;
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.32,
      background: a.tint, color: CF_COLORS.ink,
      display: 'grid', placeItems: 'center',
      fontFamily: '-apple-system, system-ui, sans-serif',
      fontWeight: 600, fontSize: size * 0.42,
      flexShrink: 0, position: 'relative',
      letterSpacing: -0.5,
    }}>
      {a.mono}
      {dot && (
        <span style={{
          position: 'absolute', right: -2, bottom: -2,
          width: size * 0.3, height: size * 0.3, borderRadius: '50%',
          background: dot === 'ask' ? CF_COLORS.accent : (a.online ? CF_COLORS.success : CF_COLORS.muted),
          border: `2px solid ${CF_COLORS.bg}`,
          boxShadow: dot === 'ask' ? `0 0 0 2px ${CF_COLORS.accentSoft}` : 'none',
        }} />
      )}
    </div>
  );
}

// Pill button / chip
function CFChip({ active, accent, children, onClick, style }) {
  return (
    <button onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '6px 12px', borderRadius: 999,
      fontFamily: '-apple-system, system-ui, sans-serif',
      fontSize: 13, fontWeight: 500,
      background: active ? CF_COLORS.ink : (accent ? CF_COLORS.accentSoft : CF_COLORS.surface),
      color: active ? CF_COLORS.bg : (accent ? CF_COLORS.accentInk : CF_COLORS.ink2),
      border: `1px solid ${active ? CF_COLORS.ink : (accent ? 'transparent' : CF_COLORS.border)}`,
      cursor: 'pointer', whiteSpace: 'nowrap',
      ...style,
    }}>{children}</button>
  );
}

// Icons — tiny line-set
const CFIcon = {
  menu: (c = 'currentColor') => <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M4 7h16M4 12h16M4 17h10" stroke={c} strokeWidth="2" strokeLinecap="round"/></svg>,
  plus: (c = 'currentColor') => <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke={c} strokeWidth="2" strokeLinecap="round"/></svg>,
  search: (c = 'currentColor') => <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke={c} strokeWidth="2"/><path d="M21 21l-4-4" stroke={c} strokeWidth="2" strokeLinecap="round"/></svg>,
  chev: (c = 'currentColor') => <svg width="8" height="14" viewBox="0 0 8 14"><path d="M1 1l6 6-6 6" stroke={c} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  back: (c = 'currentColor') => <svg width="11" height="18" viewBox="0 0 11 18"><path d="M10 1L1 9l9 8" stroke={c} strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  dots: (c = 'currentColor') => <svg width="18" height="5" viewBox="0 0 22 6"><circle cx="3" cy="3" r="2" fill={c}/><circle cx="11" cy="3" r="2" fill={c}/><circle cx="19" cy="3" r="2" fill={c}/></svg>,
  send: (c = 'currentColor') => <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 19V5M5 12l7-7 7 7" stroke={c} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  check: (c = 'currentColor') => <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M4 12l5 5L20 6" stroke={c} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  x: (c = 'currentColor') => <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke={c} strokeWidth="2.2" strokeLinecap="round"/></svg>,
  bell: (c = 'currentColor') => <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M6 10a6 6 0 0112 0v4l2 3H4l2-3v-4zM9 19a3 3 0 006 0" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  grid: (c = 'currentColor') => <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="7" height="7" rx="1.5" stroke={c} strokeWidth="1.7"/><rect x="14" y="3" width="7" height="7" rx="1.5" stroke={c} strokeWidth="1.7"/><rect x="3" y="14" width="7" height="7" rx="1.5" stroke={c} strokeWidth="1.7"/><rect x="14" y="14" width="7" height="7" rx="1.5" stroke={c} strokeWidth="1.7"/></svg>,
  inbox: (c = 'currentColor') => <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M3 13l3-8h12l3 8M3 13v6a2 2 0 002 2h14a2 2 0 002-2v-6M3 13h5l1 3h6l1-3h5" stroke={c} strokeWidth="1.7" strokeLinejoin="round"/></svg>,
  user: (c = 'currentColor') => <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke={c} strokeWidth="1.7"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" stroke={c} strokeWidth="1.7" strokeLinecap="round"/></svg>,
  camera: (c = 'currentColor') => <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="3" y="7" width="18" height="13" rx="2.5" stroke={c} strokeWidth="1.7"/><path d="M9 7l2-3h2l2 3" stroke={c} strokeWidth="1.7"/><circle cx="12" cy="13.5" r="3.5" stroke={c} strokeWidth="1.7"/></svg>,
  tool: (c = 'currentColor') => <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" stroke={c} strokeWidth="1.8"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1l2.1-2.1M17 7l2.1-2.1" stroke={c} strokeWidth="1.8" strokeLinecap="round"/></svg>,
};

Object.assign(window, { CF_COLORS, CFAvatar, CFChip, CFIcon });

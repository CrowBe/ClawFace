import { create } from 'zustand';
import { SEED_AGENTS, SEED_THREADS, type Agent, type Thread, type Message } from '@/data/seed';

interface State {
  agents: Agent[];
  threads: Thread[];
  currentAgentId: string;
  showDrawer: boolean;
  toast: string | null;

  // derived helpers
  agentsWithPending: () => Set<string>;
  pendingCount: () => number;

  // actions
  setAgent: (id: string) => void;
  toggleDrawer: (v?: boolean) => void;
  resolveApproval: (threadId: string, msgId: number, decision: 'approved' | 'denied') => void;
  sendMessage: (threadId: string, text: string) => void;
  addAgent: (name: string, host: string) => void;
  markThreadRead: (threadId: string) => void;
  setAgentFolders: (agentId: string, v: boolean) => void;
  setAgentPerm: (agentId: string, key: string, val: boolean | 'ask') => void;
  dismissToast: () => void;
}

export const useStore = create<State>((set, get) => ({
  agents: SEED_AGENTS,
  threads: SEED_THREADS,
  currentAgentId: 'grep',
  showDrawer: false,
  toast: null,

  agentsWithPending: () => {
    const s = get();
    const out = new Set<string>();
    s.threads.forEach(t => {
      t.messages.forEach(m => {
        if (m.role === 'approval' && m.status === 'pending') out.add(t.agentId);
      });
    });
    return out;
  },

  pendingCount: () => {
    const s = get();
    let n = 0;
    s.threads.forEach(t => t.messages.forEach(m => { if (m.role === 'approval' && m.status === 'pending') n++; }));
    return n;
  },

  setAgent: (id) => set({ currentAgentId: id, showDrawer: false }),

  toggleDrawer: (v) => set(s => ({ showDrawer: v ?? !s.showDrawer })),

  resolveApproval: (threadId, msgId, decision) => {
    set(s => ({
      threads: s.threads.map(t => {
        if (t.id !== threadId) return t;
        const msgs: Message[] = t.messages.map(m => m.id === msgId ? { ...m, status: decision } : m);
        msgs.push({
          id: Date.now(),
          role: 'agent',
          text: decision === 'approved' ? 'Approved — running now.' : 'Canceled. Let me know what to change.',
          t: 'just now',
        });
        return { ...t, messages: msgs };
      }),
      toast: decision === 'approved' ? 'Approved ✓' : 'Denied',
    }));
    setTimeout(() => set({ toast: null }), 2000);
  },

  sendMessage: (threadId, text) => {
    if (!text.trim()) return;
    set(s => ({
      threads: s.threads.map(t => {
        if (t.id !== threadId) return t;
        const msgs: Message[] = [...t.messages, { id: Date.now(), role: 'user', text, t: 'now' }];
        return { ...t, messages: msgs, updatedMin: 0 };
      }),
    }));
    setTimeout(() => {
      set(s => ({
        threads: s.threads.map(t => {
          if (t.id !== threadId) return t;
          const msgs: Message[] = [...t.messages, { id: Date.now() + 1, role: 'agent', text: 'Got it — on it.', t: 'now' }];
          return { ...t, messages: msgs };
        }),
      }));
    }, 900);
  },

  addAgent: (name, host) => {
    const id = 'agent-' + Date.now();
    const newAgent: Agent = {
      id, name, mono: name.slice(0, 2).toUpperCase(), tint: '#E4DBEC',
      role: 'newly paired', host, online: true, paired: 'just now', folders: false,
      perms: { read: true, write: 'ask', shell: 'ask', network: true },
      notifs: { approvals: 'push+sound', completions: 'silent', mentions: 'push' },
    };
    set(s => ({
      agents: [...s.agents, newAgent],
      currentAgentId: id,
      toast: `Paired ${name}`,
    }));
    setTimeout(() => set({ toast: null }), 2200);
  },

  markThreadRead: (threadId) => set(s => ({
    threads: s.threads.map(t => t.id === threadId ? { ...t, unread: 0 } : t),
  })),

  setAgentFolders: (agentId, v) => set(s => ({
    agents: s.agents.map(a => a.id === agentId ? { ...a, folders: v } : a),
  })),

  setAgentPerm: (agentId, key, val) => set(s => ({
    agents: s.agents.map(a => a.id === agentId ? { ...a, perms: { ...a.perms, [key]: val } } : a),
  })),

  dismissToast: () => set({ toast: null }),
}));

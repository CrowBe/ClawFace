import { create } from 'zustand';
import { SEED_AGENTS, SEED_THREADS, type Agent, type Thread, type Message } from '@/data/seed';
import { mockTransport, wsTransport, resolveTransport } from '@/services/transport';
import { debouncedDehydrate, clearPersistedState } from '@/services/persistence';
import { deleteSessionKey } from '@/services/secureStore';

interface AppSettings {
  biometric: boolean;
  pushNotifs: boolean;
  theme: 'light';
}

interface State {
  agents: Agent[];
  threads: Thread[];
  currentAgentId: string;
  showDrawer: boolean;
  toast: string | null;
  settings: AppSettings;

  agentsWithPending: () => Set<string>;
  pendingCount: () => number;

  setAgent: (id: string) => void;
  toggleDrawer: (v?: boolean) => void;
  resolveApproval: (threadId: string, msgId: number, decision: 'approved' | 'denied') => void;
  sendMessage: (threadId: string, text: string) => void;
  addAgent: (name: string, host: string, sessionKey?: string, port?: number) => Agent;
  removeAgent: (agentId: string) => void;
  markThreadRead: (threadId: string) => void;
  setAgentFolders: (agentId: string, v: boolean) => void;
  setAgentPerm: (agentId: string, key: string, val: boolean | 'ask') => void;
  dismissToast: () => void;
  updateSettings: (patch: Partial<AppSettings>) => void;

  signOut: () => Promise<void>;

  appendMessage: (threadId: string, message: Message) => void;
  upsertMessage: (threadId: string, message: Message) => void;
  updateThreadPreview: (threadId: string, preview: string, updatedMin: number) => void;
  setAgentConnection: (agentId: string, online: boolean) => void;
  addThread: (thread: Thread) => void;
}

function subscribeToTransport(store: { getState: () => State }) {
  const unsubMock = mockTransport.subscribe(event => {
    const s = store.getState();
    switch (event.type) {
      case 'message_appended':
        s.appendMessage(event.threadId, event.message);
        break;
      case 'message_upserted':
        s.upsertMessage(event.threadId, event.message);
        break;
      case 'approval_request':
        s.appendMessage(event.threadId, event.message);
        break;
      case 'thread_updated':
        s.addThread(event.thread);
        break;
      case 'connection_changed':
        s.setAgentConnection(event.agentId, event.online);
        break;
    }
  });

  const unsubWs = wsTransport.subscribe(event => {
    const s = store.getState();
    switch (event.type) {
      case 'message_appended':
        s.appendMessage(event.threadId, event.message);
        break;
      case 'message_upserted':
        s.upsertMessage(event.threadId, event.message);
        break;
      case 'approval_request':
        s.appendMessage(event.threadId, event.message);
        break;
      case 'thread_updated':
        s.addThread(event.thread);
        break;
      case 'connection_changed':
        s.setAgentConnection(event.agentId, event.online);
        break;
    }
  });

  return () => { unsubMock(); unsubWs(); };
}

export const useStore = create<State>((set, get) => ({
  agents: SEED_AGENTS,
  threads: SEED_THREADS,
  currentAgentId: SEED_AGENTS[0]?.id ?? '',
  showDrawer: false,
  toast: null,
  settings: { biometric: true, pushNotifs: true, theme: 'light' },

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
        return {
          ...t,
          messages: t.messages.map(m => m.id === msgId ? { ...m, status: decision } : m),
        };
      }),
      toast: decision === 'approved' ? 'Approved ✓' : 'Denied',
    }));
    setTimeout(() => set({ toast: null }), 2000);

    const thread = get().threads.find(t => t.id === threadId);
    if (!thread) return;
    const agent = get().agents.find(a => a.id === thread.agentId);
    if (!agent) return;
    const transport = resolveTransport(agent);
    transport.resolveApproval(threadId, msgId, decision).catch(() => {});
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

    const thread = get().threads.find(t => t.id === threadId);
    if (!thread) return;
    const agent = get().agents.find(a => a.id === thread.agentId);
    if (!agent) return;
    const transport = resolveTransport(agent);
    transport.sendMessage(threadId, text).catch(() => {});
  },

  addAgent: (name, host, sessionKey, port) => {
    const id = 'agent-' + Date.now();
    const newAgent: Agent = {
      id, name, mono: name.slice(0, 2).toUpperCase(), tint: '#E4DBEC',
      role: 'newly paired', host, online: true, paired: 'just now', folders: false,
      perms: { read: true, write: 'ask', shell: 'ask', network: true },
      notifs: { approvals: 'push+sound', completions: 'silent', mentions: 'push' },
      sessionKey,
      port,
    };
    set(s => ({
      agents: [...s.agents, newAgent],
      currentAgentId: id,
      toast: `Paired ${name}`,
    }));
    setTimeout(() => set({ toast: null }), 2200);

    const transport = resolveTransport(newAgent);
    transport.connect(newAgent).catch(() => {});

    return newAgent;
  },

  removeAgent: (agentId) => {
    const agent = get().agents.find(a => a.id === agentId);
    if (agent) {
      const transport = resolveTransport(agent);
      transport.disconnect(agentId);
    }
    set(s => ({
      agents: s.agents.filter(a => a.id !== agentId),
      threads: s.threads.filter(t => t.agentId !== agentId),
    }));
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

  updateSettings: (patch) => set(s => ({ settings: { ...s.settings, ...patch } })),

  signOut: async () => {
    const agents = get().agents;
    agents.forEach(a => {
      try { wsTransport.disconnect(a.id); } catch {}
    });
    await Promise.all(
      agents.map(a => deleteSessionKey(a.id).catch(() => {}))
    );
    await clearPersistedState();
    set({
      agents: [],
      threads: [],
      currentAgentId: '',
      showDrawer: false,
      toast: 'Signed out',
    });
    setTimeout(() => set({ toast: null }), 2000);
  },

  appendMessage: (threadId, message) => set(s => ({
    threads: s.threads.map(t => {
      if (t.id !== threadId) return t;
      return { ...t, messages: [...t.messages, message] };
    }),
  })),

  upsertMessage: (threadId, message) => set(s => ({
    threads: s.threads.map(t => {
      if (t.id !== threadId) return t;
      const existing = t.messages.find(m => m.id === message.id);
      if (existing) {
        return {
          ...t,
          messages: t.messages.map(m =>
            m.id === message.id
              ? { ...m, text: (m.text ?? '') + (message.text ?? '') }
              : m
          ),
        };
      }
      return { ...t, messages: [...t.messages, message] };
    }),
  })),

  updateThreadPreview: (threadId, preview, updatedMin) => set(s => ({
    threads: s.threads.map(t => t.id === threadId ? { ...t, preview, updatedMin } : t),
  })),

  setAgentConnection: (agentId, online) => set(s => ({
    agents: s.agents.map(a => a.id === agentId ? { ...a, online } : a),
  })),

  addThread: (thread) => set(s => {
    const exists = s.threads.find(t => t.id === thread.id);
    if (exists) return { threads: s.threads.map(t => t.id === thread.id ? thread : t) };
    return { threads: [...s.threads, thread] };
  }),
}));

subscribeToTransport(useStore);

useStore.subscribe(state => {
  debouncedDehydrate({
    agents: state.agents,
    threads: state.threads,
    currentAgentId: state.currentAgentId,
  });
});

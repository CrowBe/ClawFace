import { create } from 'zustand';
import { SEED_AGENTS, SEED_THREADS, type Agent, type AgentContext, type Thread, type Message } from '@/data/seed';
import { openClawGatewayTransport, resolveTransport, type TransportListener } from '@/services/transport';
import { debouncedDehydrate, clearPersistedState } from '@/services/persistence';
import { deleteSessionKey, getSessionKey } from '@/services/secureStore';
import { scheduleLocalApprovalNotification } from '@/services/notifications';
import { isPendingHandoff } from '@/domain/workstreams';

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
  addAgent: (name: string, host: string, sessionKey?: string, port?: number, secure?: boolean, context?: AgentContext, transport?: Agent['transport']) => Agent;
  removeAgent: (agentId: string) => void;
  markThreadRead: (threadId: string) => void;
  setAgentFolders: (agentId: string, v: boolean) => void;
  setAgentPerm: (agentId: string, key: string, val: boolean | 'ask') => void;
  dismissToast: () => void;
  updateSettings: (patch: Partial<AppSettings>) => void;

  signOut: () => Promise<void>;
  rehydrateAndConnect: (saved: { agents: Agent[]; threads: Thread[]; currentAgentId: string }) => Promise<void>;

  appendMessage: (threadId: string, message: Message) => void;
  appendMessageDelta: (threadId: string, message: Message) => void;
  upsertMessage: (threadId: string, message: Message) => void;
  upsertApprovalRequest: (threadId: string, message: Message, replay?: boolean) => void;
  updateThreadPreview: (threadId: string, preview: string, updatedMin: number) => void;
  setAgentConnection: (agentId: string, online: boolean) => void;
  setAgentContext: (agentId: string, context: AgentContext) => void;
  addThread: (thread: Thread) => void;
  sweepExpiredApprovals: () => void;
}

function isPendingApproval(message: Message, now = Date.now()) {
  return message.role === 'approval'
    && message.status === 'pending'
    && (message.expiresAt == null || now < message.expiresAt);
}

function scheduleExpirySweep(message: Message, store: { getState: () => State }) {
  if (message.role !== 'approval' || message.expiresAt == null) return;
  const delay = Math.max(message.expiresAt - Date.now(), 0) + 100;
  setTimeout(() => store.getState().sweepExpiredApprovals(), delay);
}

function notifyApprovalRequest(threadId: string, message: Message, store: { getState: () => State }) {
  if (!isPendingApproval(message)) return;

  const s = store.getState();
  if (!s.settings.pushNotifs) return;

  const thread = s.threads.find(t => t.id === threadId);
  if (!thread) return;

  const agent = s.agents.find(a => a.id === thread.agentId);
  if (!agent) return;

  scheduleLocalApprovalNotification({
    agentId: agent.id,
    threadId,
    agentName: agent.name,
    summary: message.summary ?? 'Approval needed',
  }).catch(() => {});
}

function applyTransportEvent(store: { getState: () => State }, event: Parameters<TransportListener>[0]) {
  const s = store.getState();
  switch (event.type) {
    case 'message_appended':
      s.appendMessage(event.threadId, event.message);
      break;
    case 'message_delta_appended':
      s.appendMessageDelta(event.threadId, event.message);
      break;
    case 'message_upserted':
      s.upsertMessage(event.threadId, event.message);
      break;
    case 'approval_request':
      s.upsertApprovalRequest(event.threadId, event.message, event.replay);
      scheduleExpirySweep(event.message, store);
      if (!event.replay) notifyApprovalRequest(event.threadId, event.message, store);
      break;
    case 'thread_updated':
      s.addThread(event.thread);
      break;
    case 'connection_changed':
      s.setAgentConnection(event.agentId, event.online);
      break;
    case 'agent_context_updated':
      s.setAgentContext(event.agentId, event.context);
      break;
    case 'transport_notice':
      break;
  }
}

function subscribeToTransport(store: { getState: () => State }) {
  const unsubGateway = openClawGatewayTransport.subscribe(event => applyTransportEvent(store, event));

  return () => { unsubGateway(); };
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
      if (isPendingHandoff(t)) out.add(t.agentId);
    });
    return out;
  },

  pendingCount: () => {
    const s = get();
    let n = 0;
    s.threads.forEach(t => t.messages.forEach(m => { if (isPendingApproval(m)) n++; }));
    return n;
  },

  setAgent: (id) => set({ currentAgentId: id, showDrawer: false }),

  toggleDrawer: (v) => set(s => ({ showDrawer: v ?? !s.showDrawer })),

  resolveApproval: (threadId, msgId, decision) => {
    const thread = get().threads.find(t => t.id === threadId);
    const approval = thread?.messages.find(m => m.id === msgId && m.role === 'approval');
    if (!thread || !approval?.reqId || !isPendingApproval(approval)) {
      set({ toast: 'Approval request is stale' });
      setTimeout(() => set({ toast: null }), 2000);
      return;
    }

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

    const agent = get().agents.find(a => a.id === thread.agentId);
    if (!agent) return;
    const transport = resolveTransport(agent);
    transport.resolveApproval(agent.id, threadId, msgId, approval.reqId, decision).catch(() => {});
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
    transport.sendMessage(agent.id, threadId, text).catch(() => {});
  },

  addAgent: (name, host, sessionKey, port, secure, context, transportKind = 'openclaw-gateway') => {
    const id = 'agent-' + Date.now();
    const newAgent: Agent = {
      id, name, mono: name.slice(0, 2).toUpperCase(), tint: '#E4DBEC',
      role: 'OpenClaw Gateway', host, mode: 'direct', transport: transportKind, online: true, paired: 'just now', folders: false,
      perms: { read: true, write: 'ask', shell: 'ask', network: true },
      notifs: { approvals: 'push+sound', completions: 'silent', mentions: 'push' },
      sessionKey,
      port,
      secure,
      context,
    };
    set(s => ({
      agents: [...s.agents, newAgent],
      currentAgentId: id,
      toast: `Paired ${name}`,
    }));
    setTimeout(() => set({ toast: null }), 2200);

    return newAgent;
  },

  removeAgent: (agentId) => {
    const agent = get().agents.find(a => a.id === agentId);
    if (agent) {
      const transport = resolveTransport(agent);
      transport.revoke(agentId).catch(() => transport.disconnect(agentId));
      deleteSessionKey(agentId).catch(() => {});
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
    await Promise.all(agents.map(a => resolveTransport(a).revoke(a.id).catch(() => {})));
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

  rehydrateAndConnect: async (saved) => {
    const store = get();
    const agents = await Promise.all(
      (saved.agents.length ? saved.agents : store.agents).map(async agent => {
        const sessionKey = await getSessionKey(agent.id).catch(() => null);
        const hydratedAgent = { ...agent, sessionKey: sessionKey ?? undefined, transport: 'openclaw-gateway' as const, online: false };
        resolveTransport(hydratedAgent).connect(hydratedAgent).catch(() => {});
        return hydratedAgent;
      })
    );

    set({
      agents,
      threads: saved.threads.length ? saved.threads : store.threads,
      currentAgentId: saved.currentAgentId || store.currentAgentId,
    });
  },

  appendMessage: (threadId, message) => set(s => ({
    threads: s.threads.map(t => {
      if (t.id !== threadId) return t;
      return { ...t, messages: [...t.messages, message] };
    }),
  })),

  appendMessageDelta: (threadId, message) => set(s => ({
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

  upsertMessage: (threadId, message) => set(s => ({
    threads: s.threads.map(t => {
      if (t.id !== threadId) return t;
      const existing = t.messages.find(m => m.id === message.id);
      if (existing) {
        return { ...t, messages: t.messages.map(m => m.id === message.id ? { ...m, ...message } : m) };
      }
      return { ...t, messages: [...t.messages, message] };
    }),
  })),

  upsertApprovalRequest: (threadId, message) => set(s => ({
    threads: s.threads.map(t => {
      if (t.id !== threadId) return t;
      const existing = t.messages.find(m =>
        (message.reqId != null && m.reqId === message.reqId)
        || m.id === message.id
      );
      if (existing) {
        return {
          ...t,
          messages: t.messages.map(m =>
            ((message.reqId != null && m.reqId === message.reqId) || m.id === message.id)
              ? { ...m, ...message }
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

  setAgentContext: (agentId, context) => set(s => ({
    agents: s.agents.map(a => a.id === agentId ? { ...a, context: { ...a.context, ...context } } : a),
  })),

  addThread: (thread) => set(s => {
    const exists = s.threads.find(t => t.id === thread.id);
    if (exists) {
      return {
        threads: s.threads.map(t => t.id === thread.id
          ? { ...t, ...thread, messages: thread.messages.length > 0 ? thread.messages : t.messages }
          : t
        ),
      };
    }
    return { threads: [...s.threads, thread] };
  }),

  sweepExpiredApprovals: () => set(s => ({ threads: [...s.threads] })),
}));

subscribeToTransport(useStore);

useStore.subscribe(state => {
  debouncedDehydrate({
    agents: state.agents.map(({ sessionKey: _sessionKey, ...agent }) => agent),
    threads: state.threads,
    currentAgentId: state.currentAgentId,
  });
});

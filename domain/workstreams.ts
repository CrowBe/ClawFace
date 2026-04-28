import type { Agent, AgentContext, Thread } from '@/data/seed';

export type WorkstreamId = string;
export type ParticipantId = string;

export interface TrustedAgentParticipant {
  kind: 'trusted_agent';
  id: ParticipantId;
  agentId: string;
  name: string;
}

export type Participant = TrustedAgentParticipant;

export interface WorkstreamThread {
  thread: Thread;
  participants: Participant[];
  agentContext?: AgentContext;
}

export interface Workstream {
  id: WorkstreamId;
  title: string;
  agentId: string;
  threadIds: string[];
  agentContext?: AgentContext;
}

export interface AgentWorkstreamSummary {
  agent: Agent;
  threadCount: number;
  unreadCount: number;
  needsHandoff: boolean;
}

const DEFAULT_THREAD_GROUP = 'General';

export function isPendingHandoff(thread: Thread, now = Date.now()) {
  return thread.messages.some(message =>
    message.role === 'approval'
    && message.status === 'pending'
    && (message.expiresAt == null || now < message.expiresAt)
  );
}

export function getAgentThreads(threads: Thread[], agentId: string) {
  return threads.filter(thread => thread.agentId === agentId);
}

export function searchThreads(threads: Thread[], query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return threads;
  return threads.filter(thread =>
    thread.title.toLowerCase().includes(q)
    || thread.preview.toLowerCase().includes(q)
  );
}

export function groupThreadsByWorkstreamFolder(threads: Thread[]) {
  return threads.reduce<Record<string, Thread[]>>((acc, thread) => {
    const key = thread.folder ?? DEFAULT_THREAD_GROUP;
    acc[key] = [...(acc[key] ?? []), thread];
    return acc;
  }, {});
}

export function getInboxThreads(threads: Thread[]) {
  return threads.filter(thread => isPendingHandoff(thread) || thread.unread > 0);
}

export function getAgentWorkstreamSummaries(
  agents: Agent[],
  threads: Thread[],
): AgentWorkstreamSummary[] {
  return agents.map(agent => {
    const agentThreads = getAgentThreads(threads, agent.id);
    return {
      agent,
      threadCount: agentThreads.length,
      unreadCount: agentThreads.reduce((sum, thread) => sum + thread.unread, 0),
      needsHandoff: agentThreads.some(isPendingHandoff),
    };
  });
}

export function getThreadRoute(threads: Thread[], threadId: string) {
  const thread = threads.find(t => t.id === threadId);
  return thread ? { agentId: thread.agentId, threadId: thread.id } : null;
}

export function getThreadParticipant(thread: Thread, agents: Agent[]): Participant | null {
  const agent = agents.find(a => a.id === thread.agentId);
  if (!agent) return null;
  return {
    kind: 'trusted_agent',
    id: `trusted-agent:${agent.id}`,
    agentId: agent.id,
    name: agent.name,
  };
}

export function getThreadWithParticipants(thread: Thread, agents: Agent[]): WorkstreamThread {
  const participant = getThreadParticipant(thread, agents);
  return {
    thread,
    participants: participant ? [participant] : [],
    agentContext: thread.context ?? agents.find(a => a.id === thread.agentId)?.context,
  };
}

export function deriveWorkstreamFromSingleAgentThread(thread: Thread, agents: Agent[]): Workstream {
  const agent = agents.find(a => a.id === thread.agentId);
  return {
    id: `workstream:${thread.id}`,
    title: thread.title,
    agentId: thread.agentId,
    threadIds: [thread.id],
    agentContext: thread.context ?? agent?.context,
  };
}

export function formatAgentContext(agent: Agent) {
  if (!agent.context) return agent.role;
  const label = agent.context.repoName ?? 'repo';
  const branch = agent.context.branch ? ` · ${agent.context.branch}` : '';
  const runtime = agent.context.openclawSessionId ?? agent.context.openclawThreadId ?? 'OpenClaw';
  return `${label}${branch} · ${runtime}`;
}

export function formatThreadContext(thread: Thread, agent: Agent) {
  const context = thread.context ?? agent.context;
  if (!context) return `${agent.name} · typing…`;
  const label = context.repoPath ?? context.repoName ?? 'repo';
  const runtime = context.openclawThreadId ?? context.openclawSessionId ?? 'OpenClaw';
  return `${label} · ${runtime}`;
}

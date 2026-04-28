import AsyncStorage from '@react-native-async-storage/async-storage';
import { SEED_AGENTS, SEED_THREADS, type Agent, type AgentContext, type Thread } from '@/data/seed';

const STORAGE_KEY = 'clawface_state';
const SCHEMA_VERSION = 4;

interface PersistedState {
  version: number;
  state: {
    agents: Agent[];
    threads: Thread[];
    currentAgentId: string;
  };
}

type PersistedAppState = PersistedState['state'];

type PersistedAgent = Agent | (Omit<Agent, 'mode' | 'transport'> & { mode?: Agent['mode']; transport?: Agent['transport']; relayUrl?: string });

type LegacyAgentContext = AgentContext & {
  openclawSessionId?: string;
  openclawThreadId?: string;
};

export async function hydrateState(): Promise<{ agents: Agent[]; threads: Thread[]; currentAgentId: string } | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as PersistedState;
    if (parsed.version > SCHEMA_VERSION) return null;

    return migrateState(parsed.state, parsed.version);
  } catch {
    return null;
  }
}

function migrateState(state: PersistedAppState, fromVersion: number): PersistedAppState {
  let next = state;

  if (fromVersion < 1) throw new Error(`Unsupported schema version: ${fromVersion}`);

  if (fromVersion < 2) {
    next = migrateV1ToV2(next);
  }
  if (fromVersion < 3) {
    next = migrateV2ToV3(next);
  }
  if (fromVersion < 4) {
    next = migrateV3ToV4(next);
  }

  return next;
}

function migrateV1ToV2(state: PersistedAppState): PersistedAppState {
  return {
    ...state,
    agents: state.agents.map(agent => {
      const persisted = agent as PersistedAgent;
      return {
        ...persisted,
        mode: persisted.mode ?? 'direct',
      } satisfies Agent;
    }),
  };
}

// V2 -> V3: rename vendor-leaked AgentContext fields
//   openclawSessionId -> agentSessionId
//   openclawThreadId  -> agentThreadId
// New code only reads the neutral names; carry old values forward where the
// new ones are absent so previously paired agents keep their context display.
function migrateAgentContext(context: AgentContext | undefined): AgentContext | undefined {
  if (!context) return context;
  const legacy = context as LegacyAgentContext;
  return {
    repoPath: legacy.repoPath,
    repoName: legacy.repoName,
    branch: legacy.branch,
    agentSessionId: legacy.agentSessionId ?? legacy.openclawSessionId,
    agentThreadId: legacy.agentThreadId ?? legacy.openclawThreadId,
  };
}

function migrateV2ToV3(state: PersistedAppState): PersistedAppState {
  return {
    ...state,
    agents: state.agents.map(agent => ({
      ...agent,
      context: migrateAgentContext(agent.context),
    })),
    threads: state.threads.map(thread => ({
      ...thread,
      context: migrateAgentContext(thread.context),
    })),
  };
}


function migrateV3ToV4(state: PersistedAppState): PersistedAppState {
  return {
    ...state,
    agents: state.agents.map(agent => {
      const persisted = agent as PersistedAgent;
      return {
        ...persisted,
        mode: persisted.mode ?? 'direct',
        transport: persisted.transport ?? 'legacy-websocket',
      } satisfies Agent;
    }),
  };
}

export async function dehydrateState(state: {
  agents: Agent[];
  threads: Thread[];
  currentAgentId: string;
}): Promise<void> {
  try {
    const data: PersistedState = { version: SCHEMA_VERSION, state };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
  }
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

export function debouncedDehydrate(state: {
  agents: Agent[];
  threads: Thread[];
  currentAgentId: string;
}): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    dehydrateState(state).catch(() => {});
  }, 500);
}

export async function clearPersistedState(): Promise<void> {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
  }
}

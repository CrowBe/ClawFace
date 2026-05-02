import AsyncStorage from '@react-native-async-storage/async-storage';
import { SEED_AGENTS, SEED_THREADS, type Agent, type Thread } from '@/data/seed';

const STORAGE_KEY = 'clawface_state';
const SCHEMA_VERSION = 5;

interface PersistedState {
  version: number;
  state: {
    agents: Agent[];
    threads: Thread[];
    currentAgentId: string;
  };
}

export async function hydrateState(): Promise<{ agents: Agent[]; threads: Thread[]; currentAgentId: string } | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as PersistedState;
    if (parsed.version !== SCHEMA_VERSION) return null;

    return parsed.state;
  } catch {
    return null;
  }
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

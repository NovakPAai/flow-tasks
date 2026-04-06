import { create } from 'zustand';
import type { Workspace } from '../types';
import * as workspacesApi from '../api/workspaces';

interface WorkspaceState {
  workspaces: Workspace[];
  current: Workspace | null;
  loading: boolean;
  load: () => Promise<void>;
  create: (payload: { name: string; slug: string; description?: string }) => Promise<Workspace>;
  setCurrent: (ws: Workspace | null) => void;
  incrementBoardCount: (workspaceId: string) => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  workspaces: [],
  current: null,
  loading: false,

  load: async () => {
    set({ loading: true });
    try {
      const workspaces = await workspacesApi.listWorkspaces();
      set({ workspaces, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  create: async (payload) => {
    const ws = await workspacesApi.createWorkspace(payload);
    // Reload to get fresh boardCount/memberCount from server
    await get().load();
    // Return the freshly loaded workspace (with correct counts)
    const fresh = get().workspaces.find(w => w.id === ws.id) ?? ws;
    return fresh;
  },

  setCurrent: (current) => set({ current }),

  incrementBoardCount: (workspaceId: string) => {
    set((s) => ({
      workspaces: s.workspaces.map(w =>
        w.id === workspaceId
          ? { ...w, boardCount: (w.boardCount ?? 0) + 1 }
          : w
      ),
    }));
  },
}));

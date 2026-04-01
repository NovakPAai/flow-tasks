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
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
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
    set((s) => ({ workspaces: [...s.workspaces, ws] }));
    return ws;
  },

  setCurrent: (current) => set({ current }),
}));

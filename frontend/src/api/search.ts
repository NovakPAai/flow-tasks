import api from './client';

export interface SearchTask {
  id: string;
  title: string;
  issueKey: string;
  priority?: string | null;
  status: { id: string; name: string; color: string; category: string };
  board: {
    id: string;
    name: string;
    prefix: string;
    workspace: { id: string; name: string; slug: string };
  };
}

export interface SearchBoard {
  id: string;
  name: string;
  prefix: string;
  workspace: { id: string; name: string; slug: string };
}

export interface SearchWorkspace {
  id: string;
  name: string;
  slug: string;
}

export interface SearchResults {
  tasks: SearchTask[];
  boards: SearchBoard[];
  workspaces: SearchWorkspace[];
}

export async function search(q: string, limit = 5): Promise<SearchResults> {
  const { data } = await api.get<SearchResults>('/search', { params: { q, limit } });
  return data;
}

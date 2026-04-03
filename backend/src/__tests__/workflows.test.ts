import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { auth, registerUser, createWorkspace, cleanupTestData, api, uid } from './helpers.js';

describe('Workflows', () => {
  let ownerToken: string;
  let memberToken: string;
  let workspaceId: string;
  let defaultWorkflowId: string;

  beforeAll(async () => {
    const owner  = await registerUser();
    const member = await registerUser();
    ownerToken  = owner.token;
    memberToken = member.token;

    const ws = await createWorkspace(ownerToken);
    workspaceId = ws.id;
    const memberId = (await api.get('/api/auth/me').set(auth(memberToken))).body.id;
    await api.post(`/api/workspaces/${workspaceId}/members`).set(auth(ownerToken))
      .send({ userId: memberId, role: 'MEMBER' });

    // Get default workflow created with workspace
    const wsDetail = await api.get(`/api/workspaces/${workspaceId}`).set(auth(ownerToken));
    defaultWorkflowId = wsDetail.body.workflows[0].id;
  });

  afterAll(cleanupTestData);

  describe('GET /api/workspaces/:wid/workflows', () => {
    it('returns workflows for workspace', async () => {
      const res = await api.get(`/api/workspaces/${workspaceId}/workflows`).set(auth(ownerToken));
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });
  });

  describe('POST /api/workspaces/:wid/workflows', () => {
    it('creates a workflow as OWNER', async () => {
      const res = await api.post(`/api/workspaces/${workspaceId}/workflows`)
        .set(auth(ownerToken))
        .send({ name: `Workflow ${uid()}`, mode: 'BIDIRECTIONAL' });
      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
    });

    it('returns 403 for MEMBER', async () => {
      const res = await api.post(`/api/workspaces/${workspaceId}/workflows`)
        .set(auth(memberToken)).send({ name: `WF ${uid()}` });
      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/workflows/:id', () => {
    it('returns workflow with statuses and transitions', async () => {
      const res = await api.get(`/api/workflows/${defaultWorkflowId}`).set(auth(ownerToken));
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.statuses)).toBe(true);
      expect(res.body.statuses.length).toBeGreaterThan(0);
    });
  });

  describe('Workflow statuses', () => {
    let workflowId: string;

    beforeAll(async () => {
      const res = await api.post(`/api/workspaces/${workspaceId}/workflows`)
        .set(auth(ownerToken)).send({ name: `Status Test WF ${uid()}`, mode: 'CUSTOM' });
      workflowId = res.body.id;
    });

    it('POST adds a status', async () => {
      const res = await api.post(`/api/workflows/${workflowId}/statuses`)
        .set(auth(ownerToken))
        .send({ name: 'In Review', color: '#FF9900', category: 'IN_PROGRESS' });
      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
    });

    it('PATCH updates a status', async () => {
      const create = await api.post(`/api/workflows/${workflowId}/statuses`)
        .set(auth(ownerToken)).send({ name: 'Old Name', color: '#AABBCC', category: 'OPEN' });
      const statusId = create.body.id;
      const res = await api.patch(`/api/workflow-statuses/${statusId}`)
        .set(auth(ownerToken)).send({ name: 'New Name' });
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('New Name');
    });
  });

  describe('PATCH /api/workflows/:id', () => {
    it('updates workflow name', async () => {
      const res = await api.patch(`/api/workflows/${defaultWorkflowId}`)
        .set(auth(ownerToken)).send({ name: 'Renamed Workflow' });
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Renamed Workflow');
    });
  });
});

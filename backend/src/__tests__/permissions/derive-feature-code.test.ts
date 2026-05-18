import { describe, it, expect } from 'vitest';
import { deriveFeatureCode } from '../../shared/utils/permissions.js';

/**
 * Test matrix for deriveFeatureCode(permission)
 * Source: docs/design/feature-permissions.md §5 + tasks/feature-permissions-acl/plan.md Step 1.3
 *
 * Maps permission codes to workspace-level FeatureCode that gates them.
 * Returns null for permissions that are NOT gated by any workspace feature
 * (core operations, admin operations, and the WS_* feature codes themselves).
 */

describe('deriveFeatureCode — workspace feature gating map', () => {
  describe('WS_COMMENTS gates all comment-related permissions', () => {
    it('COMMENT_READ → WS_COMMENTS', () => {
      expect(deriveFeatureCode('COMMENT_READ')).toBe('WS_COMMENTS');
    });
    it('COMMENT_CREATE → WS_COMMENTS', () => {
      expect(deriveFeatureCode('COMMENT_CREATE')).toBe('WS_COMMENTS');
    });
    it('COMMENT_UPDATE_OWN → WS_COMMENTS', () => {
      expect(deriveFeatureCode('COMMENT_UPDATE_OWN')).toBe('WS_COMMENTS');
    });
    it('COMMENT_DELETE_OWN → WS_COMMENTS', () => {
      expect(deriveFeatureCode('COMMENT_DELETE_OWN')).toBe('WS_COMMENTS');
    });
    it('COMMENT_DELETE_ANY → WS_COMMENTS', () => {
      expect(deriveFeatureCode('COMMENT_DELETE_ANY')).toBe('WS_COMMENTS');
    });
  });

  describe('WS_CHECKLISTS gates checklist permissions', () => {
    it('CHECKLIST_READ → WS_CHECKLISTS', () => {
      expect(deriveFeatureCode('CHECKLIST_READ')).toBe('WS_CHECKLISTS');
    });
    it('CHECKLIST_WRITE → WS_CHECKLISTS', () => {
      expect(deriveFeatureCode('CHECKLIST_WRITE')).toBe('WS_CHECKLISTS');
    });
  });

  describe('WS_LABELS gates label permissions', () => {
    it('LABEL_READ → WS_LABELS', () => {
      expect(deriveFeatureCode('LABEL_READ')).toBe('WS_LABELS');
    });
    it('LABEL_CREATE → WS_LABELS', () => {
      expect(deriveFeatureCode('LABEL_CREATE')).toBe('WS_LABELS');
    });
    it('LABEL_UPDATE → WS_LABELS', () => {
      expect(deriveFeatureCode('LABEL_UPDATE')).toBe('WS_LABELS');
    });
    it('LABEL_DELETE → WS_LABELS', () => {
      expect(deriveFeatureCode('LABEL_DELETE')).toBe('WS_LABELS');
    });
  });

  describe('WS_BULK_OPS gates bulk task editing', () => {
    it('TASK_BULK_EDIT → WS_BULK_OPS', () => {
      expect(deriveFeatureCode('TASK_BULK_EDIT')).toBe('WS_BULK_OPS');
    });
  });

  describe('WS_EXPORT gates CSV export', () => {
    it('TASK_EXPORT → WS_EXPORT', () => {
      expect(deriveFeatureCode('TASK_EXPORT')).toBe('WS_EXPORT');
    });
  });

  describe('WS_HISTORY_UI gates history viewing in UI', () => {
    it('HISTORY_READ → WS_HISTORY_UI', () => {
      expect(deriveFeatureCode('HISTORY_READ')).toBe('WS_HISTORY_UI');
    });
  });

  describe('Core permissions are NOT gated by workspace features', () => {
    it.each([
      'TASK_READ',
      'TASK_CREATE',
      'TASK_UPDATE',
      'TASK_DELETE',
      'TASK_REASSIGN',
      'BOARD_READ',
      'BOARD_CREATE',
      'BOARD_UPDATE',
      'BOARD_DELETE',
      'BOARD_MANAGE_COLUMNS',
      'BOARD_MANAGE_ACL',
      'WORKFLOW_READ',
      'WORKFLOW_CREATE',
      'WORKFLOW_UPDATE',
      'WORKFLOW_DELETE',
      'WORKSPACE_READ',
    ])('%s → null (core, not gated)', (perm) => {
      expect(deriveFeatureCode(perm as never)).toBeNull();
    });
  });

  describe('Workspace-level admin permissions are NOT gated', () => {
    it.each([
      'WS_INVITE_MEMBER',
      'WS_REMOVE_MEMBER',
      'WS_CHANGE_MEMBER_ROLE',
      'WS_EDIT_SETTINGS',
      'WS_EDIT_SECURITY',
      'WS_TOGGLE_FEATURES',
      'WS_DELETE',
      'WS_RESTORE_FROM_TRASH',
    ])('%s → null (workspace admin, not gated)', (perm) => {
      expect(deriveFeatureCode(perm as never)).toBeNull();
    });
  });

  describe('System admin permissions are NOT gated by workspace features', () => {
    it.each([
      'ADMIN_USERS',
      'ADMIN_ROLES',
      'ADMIN_PERMISSIONS',
      'ADMIN_AUDIT',
      'ADMIN_FEATURE_FLAGS',
      'ADMIN_SYSTEM_CONFIG',
    ])('%s → null (system admin, not gated)', (perm) => {
      expect(deriveFeatureCode(perm as never)).toBeNull();
    });
  });
});

export type TechSegment = 'iia' | 'fpp' | 'up' | 'uo' | 'hi';
export type SiemEventType =
  | 'auth'
  | 'admin_task'
  | 'admin_audit'
  | 'power_users_audit'
  | 'users_audit'
  | 'system_audit';

export const SIEM_SYSTEM = 'flowtasks';
export const SIEM_ENV = (process.env.SIEM_ENV ?? process.env.NODE_ENV ?? 'dev').toUpperCase();
export const SIEM_DC = process.env.SIEM_DC ?? 'unknown';

export function siemTags(type: SiemEventType, segment: TechSegment): string[] {
  return [SIEM_SYSTEM, type, segment, SIEM_ENV, SIEM_DC];
}

// Maps action string → [SiemEventType, TechSegment]
export const ACTION_TAGS: Record<string, [SiemEventType, TechSegment]> = {
  'auth.login':               ['auth',              'iia'],
  'auth.login.sso':           ['auth',              'iia'],
  'auth.logout':              ['auth',              'iia'],
  'auth.lockout':             ['auth',              'iia'],
  'auth.session.expired':     ['auth',              'iia'],
  'auth.credential.change':   ['auth',              'iia'],
  'auth.apikey.use':          ['auth',              'iia'],
  'auth.apikey.fail':         ['auth',              'iia'],
  'admin.user.create':        ['admin_task',         'iia'],
  'admin.user.delete':        ['admin_task',         'iia'],
  'admin.user.deactivate':    ['admin_task',         'iia'],
  'admin.user.activate':      ['admin_task',         'iia'],
  'admin.user.set_superadmin':['admin_task',         'iia'],
  'admin.user.role_change':   ['admin_task',         'iia'],
  'admin.config.change':      ['admin_audit',        'iia'],
  'admin.audit.settings.change': ['admin_audit',     'iia'],
  'admin.mfa.config.change':  ['admin_audit',        'iia'],
  'admin.crypto.key.rotate':  ['admin_audit',        'iia'],
  'request.approve':          ['admin_task',         'iia'],
  'request.reject':           ['admin_task',         'iia'],
  'task.create':              ['users_audit',        'fpp'],
  'task.update':              ['users_audit',        'fpp'],
  'task.delete':              ['users_audit',        'fpp'],
  'data.export':              ['power_users_audit',  'hi'],
  'workspace.created':        ['admin_task',         'uo'],
  'workspace.deleted':        ['admin_task',         'uo'],
  'workspace.member_added':   ['admin_task',         'iia'],
  'workspace.member_removed': ['admin_task',         'iia'],
  'workspace.member_role_changed': ['admin_task',    'iia'],
  'system.service.start':     ['system_audit',       'iia'],
  'system.service.stop':      ['system_audit',       'iia'],
  'system.update.install':    ['system_audit',       'iia'],
  'system.validation.error':  ['system_audit',       'iia'],
  'system.log.transport.error': ['system_audit',     'iia'],
};

export function tagsForAction(action: string): string[] {
  const entry = ACTION_TAGS[action];
  if (entry) return siemTags(entry[0], entry[1]);
  return siemTags('system_audit', 'iia');
}

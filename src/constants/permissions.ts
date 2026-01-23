export const PERMISSIONS = {
  // User permissions
  USERS_VIEW: 'users:view',
  USERS_CREATE: 'users:create',
  USERS_UPDATE: 'users:update',
  USERS_DELETE: 'users:delete',

  // Role permissions
  ROLES_VIEW: 'roles:view',
  ROLES_CREATE: 'roles:create',
  ROLES_UPDATE: 'roles:update',
  ROLES_DELETE: 'roles:delete',

  // Permission permissions
  PERMISSIONS_VIEW: 'permissions:view',
  PERMISSIONS_CREATE: 'permissions:create',
  PERMISSIONS_UPDATE: 'permissions:update',
  PERMISSIONS_DELETE: 'permissions:delete',

  // Department permissions
  DEPARTMENTS_VIEW: 'departments:view',
  DEPARTMENTS_CREATE: 'departments:create',
  DEPARTMENTS_UPDATE: 'departments:update',
  DEPARTMENTS_DELETE: 'departments:delete',

  // Location permissions
  LOCATIONS_VIEW: 'locations:view',
  LOCATIONS_CREATE: 'locations:create',
  LOCATIONS_UPDATE: 'locations:update',
  LOCATIONS_DELETE: 'locations:delete',

  // Classification permissions
  CLASSIFICATIONS_VIEW: 'classifications:view',
  CLASSIFICATIONS_CREATE: 'classifications:create',
  CLASSIFICATIONS_UPDATE: 'classifications:update',
  CLASSIFICATIONS_DELETE: 'classifications:delete',

  // Workflow permissions
  WORKFLOWS_VIEW: 'workflows:view',
  WORKFLOWS_CREATE: 'workflows:create',
  WORKFLOWS_UPDATE: 'workflows:update',
  WORKFLOWS_DELETE: 'workflows:delete',

  // Incident permissions
  INCIDENTS_VIEW: 'incidents:view',
  INCIDENTS_VIEW_ALL: 'incidents:view_all',
  INCIDENTS_CREATE: 'incidents:create',
  INCIDENTS_UPDATE: 'incidents:update',
  INCIDENTS_DELETE: 'incidents:delete',
  INCIDENTS_TRANSITION: 'incidents:transition',
  INCIDENTS_ASSIGN: 'incidents:assign',
  INCIDENTS_COMMENT: 'incidents:comment',
  INCIDENTS_MANAGE_SLA: 'incidents:manage_sla',

  // Request permissions
  REQUESTS_VIEW: 'requests:view',
  REQUESTS_VIEW_ALL: 'requests:view_all',
  REQUESTS_CREATE: 'requests:create',
  REQUESTS_UPDATE: 'requests:update',
  REQUESTS_DELETE: 'requests:delete',
  REQUESTS_TRANSITION: 'requests:transition',
  REQUESTS_ASSIGN: 'requests:assign',
  REQUESTS_COMMENT: 'requests:comment',

  // Complaint permissions
  COMPLAINTS_VIEW: 'complaints:view',
  COMPLAINTS_VIEW_ALL: 'complaints:view_all',
  COMPLAINTS_CREATE: 'complaints:create',
  COMPLAINTS_UPDATE: 'complaints:update',
  COMPLAINTS_DELETE: 'complaints:delete',
  COMPLAINTS_TRANSITION: 'complaints:transition',
  COMPLAINTS_ASSIGN: 'complaints:assign',
  COMPLAINTS_COMMENT: 'complaints:comment',

  // Query permissions
  QUERIES_VIEW: 'queries:view',
  QUERIES_VIEW_ALL: 'queries:view_all',
  QUERIES_CREATE: 'queries:create',
  QUERIES_UPDATE: 'queries:update',
  QUERIES_DELETE: 'queries:delete',
  QUERIES_TRANSITION: 'queries:transition',
  QUERIES_ASSIGN: 'queries:assign',
  QUERIES_COMMENT: 'queries:comment',

  // Report permissions
  REPORTS_VIEW: 'reports:view',
  REPORTS_CREATE: 'reports:create',
  REPORTS_UPDATE: 'reports:update',
  REPORTS_DELETE: 'reports:delete',

  // Action log permissions
  ACTION_LOGS_VIEW: 'action-logs:view',
  ACTION_LOGS_DELETE: 'action-logs:delete',

  // Lookup permissions
  LOOKUPS_VIEW: 'lookups:view',
  LOOKUPS_CREATE: 'lookups:create',
  LOOKUPS_UPDATE: 'lookups:update',
  LOOKUPS_DELETE: 'lookups:delete',
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

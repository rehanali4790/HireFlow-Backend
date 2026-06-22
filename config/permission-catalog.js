const permissionResources = [
  { id: 'overview', name: 'Overview', description: 'Overview page access', category: 'page', sort_order: 10 },
  { id: 'jobs', name: 'Jobs', description: 'Jobs page access', category: 'page', sort_order: 20 },
  { id: 'applications', name: 'Approvals', description: 'Approvals page access', category: 'page', sort_order: 30 },
  { id: 'candidates', name: 'Candidates', description: 'Candidates page access', category: 'page', sort_order: 40 },
  { id: 'tests', name: 'Tests', description: 'Tests page access', category: 'page', sort_order: 50 },
  { id: 'ai_interviews', name: 'Interviews', description: 'Interviews page access', category: 'page', sort_order: 60 },
  { id: 'chats', name: 'Chats', description: 'Candidate and HOD chat access', category: 'page', sort_order: 70 },
  { id: 'users', name: 'Team', description: 'Team page access', category: 'page', sort_order: 80 },
  { id: 'roles', name: 'Permissions', description: 'Permissions page access', category: 'page', sort_order: 90 },
  { id: 'settings', name: 'Settings', description: 'Settings page access', category: 'page', sort_order: 100 },
  { id: 'analytics', name: 'Analytics', description: 'Analytics access', category: 'task', sort_order: 110 },
  { id: 'interviews', name: 'Interviews', description: 'Interview rounds access', category: 'task', sort_order: 120 },
  { id: 'offers', name: 'Offers', description: 'Offers access', category: 'task', sort_order: 130 },
  { id: 'email_templates', name: 'Email Templates', description: 'Create and manage email templates', category: 'task', sort_order: 140 },
  { id: 'bulk_upload', name: 'Bulk Upload', description: 'Upload candidates or resumes in bulk', category: 'task', sort_order: 150 },
  { id: 'uploads', name: 'Uploads', description: 'Upload resumes, videos, logos, and other media', category: 'task', sort_order: 160 },
];

function getPermissionResources() {
  return permissionResources;
}

function getPermissionResourceIds() {
  return permissionResources.map((resource) => resource.id);
}

module.exports = {
  getPermissionResources,
  getPermissionResourceIds,
};

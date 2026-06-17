// Predefined permission keys. Admin can combine these freely into custom roles.

const PERMISSIONS = [
  // Leads
  { key: 'leads.read.own',    category: 'Leads', description: 'View leads assigned to me' },
  { key: 'leads.read.all',    category: 'Leads', description: 'View all leads across the firm' },
  { key: 'leads.create',      category: 'Leads', description: 'Create new leads manually' },
  { key: 'leads.update.own',  category: 'Leads', description: 'Edit leads assigned to me' },
  { key: 'leads.update.all',  category: 'Leads', description: 'Edit any lead' },
  { key: 'leads.delete',      category: 'Leads', description: 'Delete leads' },
  { key: 'leads.reassign',    category: 'Leads', description: 'Reassign a lead to a different consultant' },

  // Inbox / Messages
  { key: 'inbox.read.own',     category: 'Inbox',    description: 'See own conversations' },
  { key: 'inbox.read.all',     category: 'Inbox',    description: 'See all conversations' },
  { key: 'messages.send.own',  category: 'Messages', description: 'Reply on own conversations' },
  { key: 'messages.send.all',  category: 'Messages', description: 'Reply on any conversation' },

  // Notes / Reminders
  { key: 'notes.read.own',        category: 'Notes',     description: 'Read notes on own leads' },
  { key: 'notes.read.all',        category: 'Notes',     description: 'Read all notes' },
  { key: 'notes.create.own',      category: 'Notes',     description: 'Add notes on own leads' },
  { key: 'notes.create.all',      category: 'Notes',     description: 'Add notes on any lead' },
  { key: 'reminders.manage.own',  category: 'Reminders', description: 'Manage reminders on own leads' },
  { key: 'reminders.manage.all',  category: 'Reminders', description: 'Manage reminders on any lead' },

  // Users & Roles
  { key: 'users.read',     category: 'Users', description: 'View user list' },
  { key: 'users.create',   category: 'Users', description: 'Create new users' },
  { key: 'users.update',   category: 'Users', description: 'Edit users' },
  { key: 'users.delete',   category: 'Users', description: 'Delete / deactivate users' },
  { key: 'roles.read',     category: 'Roles', description: 'View roles and permissions' },
  { key: 'roles.manage',   category: 'Roles', description: 'Create, edit, and assign permissions to roles' },

  // Case types
  { key: 'case_types.manage', category: 'Settings', description: 'Manage case types' },

  // Client profile & documents
  { key: 'clients.read.own',       category: 'Clients',   description: 'View client profiles for own leads' },
  { key: 'clients.read.all',       category: 'Clients',   description: 'View all client profiles' },
  { key: 'clients.update.own',     category: 'Clients',   description: 'Edit client profiles for own leads' },
  { key: 'clients.update.all',     category: 'Clients',   description: 'Edit any client profile' },
  { key: 'family.manage.own',      category: 'Clients',   description: 'Manage family members for own clients' },
  { key: 'family.manage.all',      category: 'Clients',   description: 'Manage family members for any client' },
  { key: 'documents.upload.own',   category: 'Documents', description: 'Upload documents for own clients' },
  { key: 'documents.upload.all',   category: 'Documents', description: 'Upload documents for any client' },
  { key: 'documents.download.own', category: 'Documents', description: 'Download documents from own clients' },
  { key: 'documents.download.all', category: 'Documents', description: 'Download documents from any client' },
  { key: 'documents.delete',       category: 'Documents', description: 'Delete documents' },

  // Channel accounts
  { key: 'channel_accounts.manage', category: 'Settings', description: 'Manage channel accounts (WhatsApp numbers, emails, bots)' },
];

const DEFAULT_ROLES = {
  ADMIN: {
    description: 'Full access to everything',
    isSystem: true,
    permissions: PERMISSIONS.map((p) => p.key), // all permissions
  },
  MANAGER: {
    description: 'See and manage all leads, but cannot manage users or roles',
    isSystem: true,
    permissions: [
      'leads.read.all', 'leads.create', 'leads.update.all', 'leads.delete', 'leads.reassign',
      'inbox.read.all', 'messages.send.all',
      'notes.read.all', 'notes.create.all', 'reminders.manage.all',
      'users.read', 'roles.read',
      'case_types.manage',
      'clients.read.all', 'clients.update.all', 'family.manage.all',
      'documents.upload.all', 'documents.download.all', 'documents.delete',
      'channel_accounts.manage',
    ],
  },
  CONSULTANT: {
    description: 'Manage own assigned leads',
    isSystem: true,
    permissions: [
      'leads.read.own', 'leads.update.own',
      'inbox.read.own', 'messages.send.own',
      'notes.read.own', 'notes.create.own', 'reminders.manage.own',
      'users.read', 'roles.read',
      'clients.read.own', 'clients.update.own', 'family.manage.own',
      'documents.upload.own', 'documents.download.own',
    ],
  },
};

module.exports = { PERMISSIONS, DEFAULT_ROLES };

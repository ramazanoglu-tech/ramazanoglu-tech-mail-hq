// =============================================================================
// RAMAZANOĞLU TECH MAIL HQ - TYPE DEFINITIONS
// =============================================================================

export interface EmailAlias {
  id: string;
  email: string;
  display_name: string;
  department_badge: string;
  signature_html: string | null;
  is_active: boolean;
  created_at: string;
}

export type EmailDirection = 'INBOUND' | 'OUTBOUND';

export interface EmailAttachment {
  id: string;
  email_id: string;
  filename: string;
  mime_type: string | null;
  size_bytes: number;
  cloud_storage_url: string;
  created_at: string;
}

export interface Email {
  id: string;
  message_id: string;
  thread_id: string | null;
  alias_target: string;
  from_name: string | null;
  from_address: string;
  to_addresses: string[];
  cc_addresses: string[];
  bcc_addresses: string[];
  subject: string;
  body_text: string | null;
  body_html: string | null;
  is_read: boolean;
  is_starred: boolean;
  is_archived: boolean;
  direction: EmailDirection;
  received_at: string;
  raw_headers?: Record<string, unknown> | null;
  attachments?: EmailAttachment[];
}

export interface SendEmailPayload {
  from_alias: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body_text?: string;
  body_html: string;
  in_reply_to?: string;
  thread_id?: string;
}

export interface SyncStatus {
  imap_connected: boolean;
  last_sync_time: string | null;
  sync_active: boolean;
  inbox_total: number;
  domain_filtered_count: number;
  connected_clients: number;
  database_status: 'CONNECTED' | 'DISCONNECTED' | 'MOCK_STORE';
}

export interface WebSocketMessage {
  type: 'EMAIL_RECEIVED' | 'EMAIL_SENT' | 'EMAIL_UPDATED' | 'SYNC_STATUS' | 'PONG' | 'ERROR';
  payload: unknown;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// User accounts
// ---------------------------------------------------------------------------

export type UserRole = 'owner' | 'admin' | 'member';

export interface User {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  role: UserRole;
  /** Mail identities this user may read/send as. '*' = every identity (owner always has it). */
  alias_access: string[];
  is_active: boolean;
  must_change_password: boolean;
  /** Bumped on password change / disable so every previously issued JWT stops working. */
  token_version: number;
  last_login_at: string | null;
  created_at: string;
}

/** What is safe to send to a browser. */
export type PublicUser = Omit<User, 'password_hash' | 'token_version'>;

export interface AuditEntry {
  id: string;
  user_id: string | null;
  user_email: string;
  action: string;
  target: string | null;
  ip: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

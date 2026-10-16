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

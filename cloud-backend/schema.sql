-- =============================================================================
-- RAMAZANOĞLU TECH MAIL HQ - CLOUD POSTGRESQL SCHEMA
-- Compatible with Supabase, Neon, AWS RDS, or any standard PostgreSQL 14+
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. DEPARTMENT & IDENTITY ALIASES TABLE
CREATE TABLE IF NOT EXISTS aliases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    department_badge VARCHAR(50) NOT NULL,
    signature_html TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. EMAILS TABLE (STRICT DOMAIN ISOLATION REPOSITORY)
CREATE TABLE IF NOT EXISTS emails (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id VARCHAR(512) UNIQUE NOT NULL,
    thread_id VARCHAR(512),
    alias_target VARCHAR(255) NOT NULL, -- Matched @ramazanoglu.tech alias
    from_name VARCHAR(255),
    from_address VARCHAR(255) NOT NULL,
    to_addresses TEXT[] NOT NULL,
    cc_addresses TEXT[] DEFAULT '{}',
    bcc_addresses TEXT[] DEFAULT '{}',
    subject TEXT NOT NULL,
    body_text TEXT,
    body_html TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    is_starred BOOLEAN DEFAULT FALSE,
    is_archived BOOLEAN DEFAULT FALSE,
    direction VARCHAR(20) NOT NULL CHECK (direction IN ('INBOUND', 'OUTBOUND')),
    received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    raw_headers JSONB
);

-- 3. ATTACHMENTS TABLE
CREATE TABLE IF NOT EXISTS attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email_id UUID NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
    filename VARCHAR(512) NOT NULL,
    mime_type VARCHAR(128),
    size_bytes BIGINT NOT NULL,
    cloud_storage_url TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. SYSTEM LOGS & AUDIT TRAIL TABLE
CREATE TABLE IF NOT EXISTS sync_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(50) NOT NULL,
    details TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- INDEXES FOR HIGH-PERFORMANCE SUPER ADMIN SEARCH & FILTERING
CREATE INDEX IF NOT EXISTS idx_emails_alias_target ON emails(alias_target);
CREATE INDEX IF NOT EXISTS idx_emails_received_at ON emails(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_emails_is_read ON emails(is_read);
CREATE INDEX IF NOT EXISTS idx_emails_direction ON emails(direction);
CREATE INDEX IF NOT EXISTS idx_emails_thread_id ON emails(thread_id);
CREATE INDEX IF NOT EXISTS idx_emails_message_id ON emails(message_id);
CREATE INDEX IF NOT EXISTS idx_attachments_email_id ON attachments(email_id);

-- SEED DATA: OFFICIAL RAMAZANOĞLU TECH DEPARTMENT ALIASES & SWISS SIGNATURES
INSERT INTO aliases (email, display_name, department_badge, signature_html, is_active)
VALUES
(
    'yusuf@ramazanoglu.tech',
    'Yusuf Ramazanoğlu',
    '[YUSUF]',
    '<div style="font-family: ''Inter'', -apple-system, BlinkMacSystemFont, sans-serif; font-size: 13px; color: #111111; line-height: 1.6; margin-top: 24px; padding-top: 16px; border-top: 1px solid #E2E2DC;">
        <div style="font-weight: 700; letter-spacing: -0.01em; color: #111111;">Yusuf Ramazanoğlu</div>
        <div style="font-family: ''JetBrains Mono'', monospace; font-size: 11px; color: #666662; text-transform: uppercase; margin-top: 2px;">Founder & Chief Technology Architect</div>
        <div style="margin-top: 8px; color: #666662; font-size: 12px;">Ramazanoğlu Technologies Inc. &bull; <a href="https://ramazanoglu.tech" style="color: #111111; text-decoration: underline;">ramazanoglu.tech</a></div>
        <div style="font-family: ''JetBrains Mono'', monospace; font-size: 11px; color: #999990; margin-top: 4px;">Direct: yusuf@ramazanoglu.tech</div>
    </div>',
    TRUE
),
(
    'info@ramazanoglu.tech',
    'Ramazanoğlu Tech Desk',
    '[INFO]',
    '<div style="font-family: ''Inter'', -apple-system, BlinkMacSystemFont, sans-serif; font-size: 13px; color: #111111; line-height: 1.6; margin-top: 24px; padding-top: 16px; border-top: 1px solid #E2E2DC;">
        <div style="font-weight: 700; letter-spacing: -0.01em; color: #111111;">Ramazanoğlu Tech &bull; Central Desk</div>
        <div style="font-family: ''JetBrains Mono'', monospace; font-size: 11px; color: #666662; text-transform: uppercase; margin-top: 2px;">General Corporate Inquiries</div>
        <div style="margin-top: 8px; color: #666662; font-size: 12px;">Ramazanoğlu Technologies Inc. &bull; <a href="https://ramazanoglu.tech" style="color: #111111; text-decoration: underline;">ramazanoglu.tech</a></div>
        <div style="font-family: ''JetBrains Mono'', monospace; font-size: 11px; color: #999990; margin-top: 4px;">info@ramazanoglu.tech</div>
    </div>',
    TRUE
),
(
    'contact@ramazanoglu.tech',
    'Ramazanoğlu Tech Relations',
    '[CONTACT]',
    '<div style="font-family: ''Inter'', -apple-system, BlinkMacSystemFont, sans-serif; font-size: 13px; color: #111111; line-height: 1.6; margin-top: 24px; padding-top: 16px; border-top: 1px solid #E2E2DC;">
        <div style="font-weight: 700; letter-spacing: -0.01em; color: #111111;">Ramazanoğlu Tech &bull; Global Relations</div>
        <div style="font-family: ''JetBrains Mono'', monospace; font-size: 11px; color: #666662; text-transform: uppercase; margin-top: 2px;">Partnerships & Strategic Alliances</div>
        <div style="margin-top: 8px; color: #666662; font-size: 12px;">Ramazanoğlu Technologies Inc. &bull; <a href="https://ramazanoglu.tech" style="color: #111111; text-decoration: underline;">ramazanoglu.tech</a></div>
        <div style="font-family: ''JetBrains Mono'', monospace; font-size: 11px; color: #999990; margin-top: 4px;">contact@ramazanoglu.tech</div>
    </div>',
    TRUE
),
(
    'support@ramazanoglu.tech',
    'Ramazanoğlu Tech Support',
    '[SUPPORT]',
    '<div style="font-family: ''Inter'', -apple-system, BlinkMacSystemFont, sans-serif; font-size: 13px; color: #111111; line-height: 1.6; margin-top: 24px; padding-top: 16px; border-top: 1px solid #E2E2DC;">
        <div style="font-weight: 700; letter-spacing: -0.01em; color: #111111;">Ramazanoğlu Tech &bull; Engineering Support</div>
        <div style="font-family: ''JetBrains Mono'', monospace; font-size: 11px; color: #666662; text-transform: uppercase; margin-top: 2px;">Mission-Critical Systems & SLA Operations</div>
        <div style="margin-top: 8px; color: #666662; font-size: 12px;">Ramazanoğlu Technologies Inc. &bull; <a href="https://ramazanoglu.tech" style="color: #111111; text-decoration: underline;">ramazanoglu.tech</a></div>
        <div style="font-family: ''JetBrains Mono'', monospace; font-size: 11px; color: #999990; margin-top: 4px;">support@ramazanoglu.tech</div>
    </div>',
    TRUE
),
(
    'billing@ramazanoglu.tech',
    'Ramazanoğlu Tech Finance',
    '[BILLING]',
    '<div style="font-family: ''Inter'', -apple-system, BlinkMacSystemFont, sans-serif; font-size: 13px; color: #111111; line-height: 1.6; margin-top: 24px; padding-top: 16px; border-top: 1px solid #E2E2DC;">
        <div style="font-weight: 700; letter-spacing: -0.01em; color: #111111;">Ramazanoğlu Tech &bull; Finance & Cloud Ops</div>
        <div style="font-family: ''JetBrains Mono'', monospace; font-size: 11px; color: #666662; text-transform: uppercase; margin-top: 2px;">Invoicing, Accounts & Enterprise Contracts</div>
        <div style="margin-top: 8px; color: #666662; font-size: 12px;">Ramazanoğlu Technologies Inc. &bull; <a href="https://ramazanoglu.tech" style="color: #111111; text-decoration: underline;">ramazanoglu.tech</a></div>
        <div style="font-family: ''JetBrains Mono'', monospace; font-size: 11px; color: #999990; margin-top: 4px;">billing@ramazanoglu.tech</div>
    </div>',
    TRUE
),
(
    'rd@ramazanoglu.tech',
    'Ramazanoğlu Tech R&D Lab',
    '[R&D]',
    '<div style="font-family: ''Inter'', -apple-system, BlinkMacSystemFont, sans-serif; font-size: 13px; color: #111111; line-height: 1.6; margin-top: 24px; padding-top: 16px; border-top: 1px solid #E2E2DC;">
        <div style="font-weight: 700; letter-spacing: -0.01em; color: #111111;">Ramazanoğlu Tech &bull; Advanced R&D Lab</div>
        <div style="font-family: ''JetBrains Mono'', monospace; font-size: 11px; color: #666662; text-transform: uppercase; margin-top: 2px;">Applied AI & High-Performance Distributed Systems</div>
        <div style="margin-top: 8px; color: #666662; font-size: 12px;">Ramazanoğlu Technologies Inc. &bull; <a href="https://ramazanoglu.tech" style="color: #111111; text-decoration: underline;">ramazanoglu.tech</a></div>
        <div style="font-family: ''JetBrains Mono'', monospace; font-size: 11px; color: #999990; margin-top: 4px;">rd@ramazanoglu.tech</div>
    </div>',
    TRUE
)
ON CONFLICT (email) DO NOTHING;

-- =============================================================================
-- USER ACCOUNTS (per-user login, roles, per-identity access) + AUDIT TRAIL
-- Mirrors src/accountSchema.ts, which is also applied automatically at startup.
-- =============================================================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
    alias_access TEXT[] NOT NULL DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    must_change_password BOOLEAN NOT NULL DEFAULT TRUE,
    token_version INTEGER NOT NULL DEFAULT 0,
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    user_email VARCHAR(255) NOT NULL,
    action VARCHAR(64) NOT NULL,
    target TEXT,
    ip VARCHAR(64),
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

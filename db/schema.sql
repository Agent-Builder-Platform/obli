-- ============================================================
-- Obli — AI Agent Platform
-- Supabase Schema
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ────────────────────────────────────────────────────────────
-- PROFILES
-- ────────────────────────────────────────────────────────────
CREATE TABLE profiles (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username     TEXT UNIQUE,
  display_name TEXT,
  bio          TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX profiles_username_idx ON profiles (username);

-- ────────────────────────────────────────────────────────────
-- SYSTEM PROMPTS
-- ────────────────────────────────────────────────────────────
CREATE TABLE system_prompts (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,  -- NULL = system default (owned by no one)
  name        TEXT NOT NULL,
  content     TEXT NOT NULL,
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- AGENTS
-- ────────────────────────────────────────────────────────────
CREATE TABLE agents (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name                TEXT NOT NULL,
  model               TEXT NOT NULL,
  description         TEXT,
  system_prompt_id    UUID REFERENCES system_prompts(id) ON DELETE SET NULL,
  knowledge_base_ids  UUID[] DEFAULT '{}',
  visibility          TEXT DEFAULT 'private' CHECK (visibility IN ('private', 'team', 'public')),
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- CONVERSATIONS
-- ────────────────────────────────────────────────────────────
CREATE TABLE conversations (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  agent_id    UUID REFERENCES agents(id) ON DELETE CASCADE NOT NULL,
  title       TEXT DEFAULT 'New conversation',
  messages    JSONB DEFAULT '[]',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- UPDATED_AT TRIGGER
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER agents_updated_at BEFORE UPDATE ON agents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER system_prompts_updated_at BEFORE UPDATE ON system_prompts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER conversations_updated_at BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ────────────────────────────────────────────────────────────
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Agents policies
CREATE POLICY "agents_select" ON agents
  FOR SELECT USING (
    user_id = auth.uid()
    OR visibility = 'public'
    OR visibility = 'team'
  );
CREATE POLICY "agents_insert" ON agents
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "agents_update" ON agents
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "agents_delete" ON agents
  FOR DELETE USING (user_id = auth.uid());

-- System prompts policies
-- Anyone (authenticated or not) can read system defaults (user_id IS NULL)
-- Users can read and manage their own prompts
CREATE POLICY "prompts_select" ON system_prompts
  FOR SELECT USING (user_id IS NULL OR user_id = auth.uid());
CREATE POLICY "prompts_insert" ON system_prompts
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "prompts_update" ON system_prompts
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "prompts_delete" ON system_prompts
  FOR DELETE USING (user_id = auth.uid());

-- Conversations policies
CREATE POLICY "conversations_all" ON conversations
  FOR ALL USING (user_id = auth.uid());

-- Profiles policies
CREATE POLICY "profiles_select" ON profiles
  FOR SELECT USING (id = auth.uid());
CREATE POLICY "profiles_insert" ON profiles
  FOR INSERT WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_update" ON profiles
  FOR UPDATE USING (id = auth.uid());

-- ────────────────────────────────────────────────────────────
-- KNOWLEDGE BASES
-- ────────────────────────────────────────────────────────────
-- A user-owned container for related documents. Versioning of
-- re-uploaded files is scoped within a single knowledge base.
CREATE TABLE knowledge_bases (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name         TEXT NOT NULL,
  description  TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX knowledge_bases_user_idx ON knowledge_bases (user_id);

CREATE TRIGGER knowledge_bases_updated_at BEFORE UPDATE ON knowledge_bases
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE knowledge_bases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "knowledge_bases_all" ON knowledge_bases
  FOR ALL USING (user_id = auth.uid());

-- ────────────────────────────────────────────────────────────
-- KNOWLEDGE BASE DOCUMENTS
-- ────────────────────────────────────────────────────────────
-- Stores metadata about uploaded knowledge-base files. The raw
-- text is chunked and embedded into Qdrant; this table is the
-- source-of-truth for versioning and ownership.
CREATE TABLE knowledge_documents (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  knowledge_base_id UUID REFERENCES knowledge_bases(id) ON DELETE CASCADE NOT NULL,
  user_id           UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  filename          TEXT NOT NULL,
  content_type      TEXT,
  byte_size         BIGINT,
  file_hash         TEXT,
  version           INT NOT NULL DEFAULT 1,
  num_chunks        INT NOT NULL DEFAULT 0,
  is_latest         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX knowledge_documents_kb_idx
  ON knowledge_documents (knowledge_base_id, filename, version DESC);

CREATE TRIGGER knowledge_documents_updated_at BEFORE UPDATE ON knowledge_documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE knowledge_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "knowledge_documents_all" ON knowledge_documents
  FOR ALL USING (user_id = auth.uid());

-- ────────────────────────────────────────────────────────────
-- WAITLIST
-- ────────────────────────────────────────────────────────────
CREATE TABLE waitlist (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  email       TEXT NOT NULL UNIQUE,
  role        TEXT,
  company     TEXT,
  reason      TEXT NOT NULL,
  use_type    TEXT NOT NULL CHECK (use_type IN ('personal', 'team', 'enterprise')),
  team_size   TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Only the service role (backend) can insert/read; no direct client access
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────
-- SEED DEFAULT SYSTEM PROMPTS
-- ────────────────────────────────────────────────────────────
-- Run db/seed_defaults.py to insert the default system prompts.
-- Prompt content lives in db/default_prompts/*.txt
-- ============================================================
-- Obli — AI Agent Platform
-- Supabase Schema
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id            UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name               TEXT NOT NULL,
  model              TEXT NOT NULL,
  description        TEXT,
  system_prompt_ids  UUID[] DEFAULT '{}',
  visibility         TEXT DEFAULT 'private' CHECK (visibility IN ('private', 'team', 'public')),
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
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

-- ────────────────────────────────────────────────────────────
-- SEED DEFAULT SYSTEM PROMPTS
-- ────────────────────────────────────────────────────────────
-- Run db/seed_defaults.py to insert the default system prompts.
-- Prompt content lives in db/default_prompts/*.txt
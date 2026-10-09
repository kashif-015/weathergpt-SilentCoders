-- ==============================================================================
-- WeatherGPT: Context-Aware Conversations and Persistent Message Storage
-- Migration: 20261010000000_create_conversations_and_messages.sql
-- ==============================================================================

-- Enable UUID extension if not already present
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Conversations Table
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'New Chat',
    context JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Messages Table
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'tool', 'system')),
    content TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. Indexes for fast retrieval and ownership
CREATE INDEX IF NOT EXISTS idx_conversations_user_id_updated_at 
    ON public.conversations (user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversations_created_at 
    ON public.conversations (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id_created_at 
    ON public.messages (conversation_id, created_at ASC);

-- 4. Automatic updated_at trigger for conversations
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_conversations_updated_at ON public.conversations;
CREATE TRIGGER trigger_conversations_updated_at
    BEFORE UPDATE ON public.conversations
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- 5. Enable Row Level Security (RLS)
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies for conversations
-- Authenticated users can view their own conversations
DROP POLICY IF EXISTS "Users can view their own conversations" ON public.conversations;
CREATE POLICY "Users can view their own conversations"
    ON public.conversations
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- Authenticated users can insert their own conversations
DROP POLICY IF EXISTS "Users can insert their own conversations" ON public.conversations;
CREATE POLICY "Users can insert their own conversations"
    ON public.conversations
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Authenticated users can update their own conversations
DROP POLICY IF EXISTS "Users can update their own conversations" ON public.conversations;
CREATE POLICY "Users can update their own conversations"
    ON public.conversations
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Authenticated users can delete their own conversations
DROP POLICY IF EXISTS "Users can delete their own conversations" ON public.conversations;
CREATE POLICY "Users can delete their own conversations"
    ON public.conversations
    FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- 7. RLS Policies for messages (enforced via parent conversation ownership)
-- Authenticated users can view messages of their conversations
DROP POLICY IF EXISTS "Users can view messages from their conversations" ON public.messages;
CREATE POLICY "Users can view messages from their conversations"
    ON public.messages
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.conversations c
            WHERE c.id = messages.conversation_id
            AND c.user_id = auth.uid()
        )
    );

-- Authenticated users can insert messages into their conversations
DROP POLICY IF EXISTS "Users can insert messages into their conversations" ON public.messages;
CREATE POLICY "Users can insert messages into their conversations"
    ON public.messages
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.conversations c
            WHERE c.id = messages.conversation_id
            AND c.user_id = auth.uid()
        )
    );

-- Authenticated users can delete messages from their conversations
DROP POLICY IF EXISTS "Users can delete messages from their conversations" ON public.messages;
CREATE POLICY "Users can delete messages from their conversations"
    ON public.messages
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.conversations c
            WHERE c.id = messages.conversation_id
            AND c.user_id = auth.uid()
        )
    );

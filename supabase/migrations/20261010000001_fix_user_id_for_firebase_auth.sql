-- ==============================================================================
-- WeatherGPT: Fix user_id column to support Firebase UID strings
-- Firebase UIDs are strings (not UUIDs) so we cannot use a FK to auth.users
-- Migration: 20261010000001_fix_user_id_for_firebase_auth.sql
-- ==============================================================================

-- 1. Drop old Supabase auth.uid()-based RLS policies FIRST
-- (PostgreSQL does not allow altering column type if policies depend on it)
DROP POLICY IF EXISTS "Users can view their own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can insert their own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can update their own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can delete their own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can view messages from their conversations" ON public.messages;
DROP POLICY IF EXISTS "Users can insert messages into their conversations" ON public.messages;
DROP POLICY IF EXISTS "Users can delete messages from their conversations" ON public.messages;

-- 2. Drop the foreign key constraint on user_id
ALTER TABLE public.conversations
    DROP CONSTRAINT IF EXISTS conversations_user_id_fkey;

-- 3. Change user_id column type from UUID to TEXT
ALTER TABLE public.conversations
    ALTER COLUMN user_id TYPE TEXT USING user_id::text;

-- 4. Allow NULL user_id (for anonymous/guest conversations)
ALTER TABLE public.conversations
    ALTER COLUMN user_id DROP NOT NULL;

-- 5. Update indexes
DROP INDEX IF EXISTS idx_conversations_user_id_updated_at;
CREATE INDEX IF NOT EXISTS idx_conversations_user_id_updated_at
    ON public.conversations (user_id, updated_at DESC)
    WHERE user_id IS NOT NULL;

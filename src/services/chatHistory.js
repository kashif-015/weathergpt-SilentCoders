/**
 * WeatherGPT — Chat History Persistence Layer
 * Uses localStorage for offline access and Supabase for signed-in users.
 */

import { supabase } from './supabaseClient.js';
import { getFirebaseAuthToken } from './firebaseClient.js';

const STORAGE_KEY_PREFIX = 'weathergpt_chat_history:';
const GUEST_STORAGE_KEY = 'weathergpt_chat_history:guest';
const MAX_CONVERSATIONS = 50;
let activeStorageKey = GUEST_STORAGE_KEY;
// Supabase writes are asynchronous. Keep writes for each account/conversation
// ordered so a slow "user message" save cannot overwrite the later assistant
// response after it has already been persisted.
const cloudWriteQueues = new Map();

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function enqueueCloudWrite(userEmail, conversationId, operation) {
  const key = `${userEmail}:${conversationId}`;
  const previous = cloudWriteQueues.get(key) || Promise.resolve();
  const next = previous
    .catch(() => undefined) // a failed earlier save must not block later ones
    .then(operation);
  cloudWriteQueues.set(key, next);
  return next.finally(() => {
    if (cloudWriteQueues.get(key) === next) cloudWriteQueues.delete(key);
  });
}

// Keep each account's history in a separate local cache. This means logging
// out hides the account's conversations without deleting them.
export function setHistoryUser(email) {
  const normalizedEmail = normalizeEmail(email);
  activeStorageKey = normalizedEmail ? `${STORAGE_KEY_PREFIX}${normalizedEmail}` : GUEST_STORAGE_KEY;
}

function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function getAutoTitle(messages, lang = 'en') {
  const firstUserMsg = messages.find(m => m.role === 'user');
  if (!firstUserMsg) return lang === 'hi' ? 'नई बातचीत' : 'New Chat';
  const text = firstUserMsg.text || '';
  return text.length > 50 ? text.slice(0, 50) + '…' : text;
}

function groupByDate(conversations, lang = 'en') {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  const weekAgo = new Date(today); weekAgo.setDate(weekAgo.getDate() - 7);
  const monthAgo = new Date(today); monthAgo.setDate(monthAgo.getDate() - 30);

  const groups = {
    today: { label: lang === 'hi' ? 'आज' : 'Today', items: [] },
    yesterday: { label: lang === 'hi' ? 'कल' : 'Yesterday', items: [] },
    week: { label: lang === 'hi' ? 'पिछले 7 दिन' : 'Previous 7 Days', items: [] },
    month: { label: lang === 'hi' ? 'पिछले 30 दिन' : 'Previous 30 Days', items: [] },
    older: { label: lang === 'hi' ? 'पुराने' : 'Older', items: [] },
  };

  conversations.forEach(conv => {
    const d = new Date(conv.updatedAt);
    if (d >= today) groups.today.items.push(conv);
    else if (d >= yesterday) groups.yesterday.items.push(conv);
    else if (d >= weekAgo) groups.week.items.push(conv);
    else if (d >= monthAgo) groups.month.items.push(conv);
    else groups.older.items.push(conv);
  });

  return Object.values(groups).filter(g => g.items.length > 0);
}

// Load all conversations from localStorage
export function loadAllConversations() {
  try {
    const raw = localStorage.getItem(activeStorageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Save all conversations to localStorage
function saveAllConversations(conversations) {
  try {
    const trimmed = conversations.slice(0, MAX_CONVERSATIONS);
    localStorage.setItem(activeStorageKey, JSON.stringify(trimmed));
  } catch (e) {
    console.warn('Chat history save error:', e);
  }
}

// Create a new conversation
export function createConversation(lang = 'en') {
  const conv = {
    id: generateId(),
    title: lang === 'hi' ? 'नई बातचीत' : 'New Chat',
    messages: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const all = loadAllConversations();
  all.unshift(conv);
  saveAllConversations(all);
  return conv;
}

// Save/update a conversation's messages
export function saveConversation(conversationId, messages, lang = 'en') {
  const all = loadAllConversations();
  const idx = all.findIndex(c => c.id === conversationId);

  if (idx >= 0) {
    all[idx].messages = messages;
    all[idx].updatedAt = new Date().toISOString();
    all[idx].title = getAutoTitle(messages, lang);
    // Move to top
    const updated = all.splice(idx, 1)[0];
    all.unshift(updated);
  } else {
    all.unshift({
      id: conversationId,
      title: getAutoTitle(messages, lang),
      messages,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  saveAllConversations(all);
}

// Load a specific conversation
export function loadConversation(conversationId) {
  const all = loadAllConversations();
  return all.find(c => c.id === conversationId) || null;
}

// Delete a conversation
export function deleteConversation(conversationId) {
  let all = loadAllConversations();
  all = all.filter(c => c.id !== conversationId);
  saveAllConversations(all);
  return all;
}

// Rename a conversation
export function renameConversation(conversationId, newTitle) {
  const all = loadAllConversations();
  const conv = all.find(c => c.id === conversationId);
  if (conv) {
    conv.title = newTitle;
    saveAllConversations(all);
  }
}

// Clear all history
export function clearAllHistory() {
  try {
    localStorage.removeItem(activeStorageKey);
  } catch {}
}

/** Fetches a user's conversation records from Supabase and refreshes
 * the local offline cache. A network/database failure deliberately leaves the
 * local cache untouched. */
export async function hydrateConversationsFromSupabase(userEmail, authToken = null) {
  const email = normalizeEmail(userEmail);
  if (!email) return loadAllConversations();

  try {
    const token = authToken || (await getFirebaseAuthToken());
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch('/api/conversations', { headers });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.conversations)) {
        const cloudConversations = data.conversations.map((row) => ({
          id: row.id,
          title: row.title || 'New Chat',
          context: row.context || {},
          messages: [],
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        }));

        const mergedById = new Map();
        [...loadAllConversations(), ...cloudConversations].forEach((conv) => {
          const existing = mergedById.get(conv.id);
          if (!existing || new Date(conv.updatedAt) >= new Date(existing.updatedAt)) {
            mergedById.set(conv.id, {
              ...conv,
              messages: (existing && existing.messages?.length) ? existing.messages : conv.messages,
            });
          }
        });

        const sorted = [...mergedById.values()]
          .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
          .slice(0, MAX_CONVERSATIONS);
        saveAllConversations(sorted);
        return sorted;
      }
    }
  } catch (err) {
    console.warn('[ChatHistory] /api/conversations fetch warning:', err.message);
  }

  return loadAllConversations();
}

export async function syncConversationToSupabase(userEmail, conversationId, authToken = null) {
  // Syncing is now automatically handled per-turn by the /api/chat orchestration endpoint
  // which saves messages and updated context in Supabase PostgreSQL transactionally.
  return Promise.resolve();
}

export async function deleteConversationFromSupabase(userEmail, conversationId, authToken = null) {
  if (!conversationId) return;
  try {
    const token = authToken || (await getFirebaseAuthToken());
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    await fetch(`/api/conversations/${conversationId}`, { method: 'DELETE', headers });
  } catch (err) {
    console.warn('[ChatHistory] Supabase delete warning:', err.message);
  }
}

export async function syncAllConversationsToSupabase(userEmail) {
  const email = normalizeEmail(userEmail);
  if (!email) return;
  const results = await Promise.allSettled(
    loadAllConversations().map((conversation) => syncConversationToSupabase(email, conversation.id))
  );
  const failed = results.find((result) => result.status === 'rejected');
  if (failed) throw failed.reason;
}

export { groupByDate, generateId };

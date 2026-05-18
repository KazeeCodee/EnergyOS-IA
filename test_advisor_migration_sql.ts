import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sql = readFileSync('src/db/migrations/002_advisor_conversation_memory.sql', 'utf8');

for (const table of [
  'advisor_conversations',
  'advisor_messages',
  'advisor_memory_items',
]) {
  assert.match(sql, new RegExp(`create table if not exists public.${table}`, 'i'));
}

assert.match(sql, /conversation_id uuid not null/i);
assert.match(sql, /user_id uuid not null/i);
assert.match(sql, /nemo text not null/i);
assert.match(sql, /status text not null/i);

console.log('advisor migration sql tests passed');

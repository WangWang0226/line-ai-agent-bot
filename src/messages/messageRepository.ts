import { supabaseDelete, supabaseInsert, supabaseSelect } from '../db/supabase';

type DbGroup = { id: string; line_group_id: string };
type DbUser = { id: string; line_user_id: string };
type DbMessage = {
  id: string;
  content: string;
  created_at: string;
  users?: { display_name: string | null; line_user_id: string } | null;
};

type DbMessageId = {
  id: string;
};

export async function upsertGroup(lineGroupId: string): Promise<DbGroup> {
  const [group] = await supabaseInsert<DbGroup>('groups', { line_group_id: lineGroupId }, 'line_group_id');
  return group;
}

export async function upsertUser(lineUserId: string): Promise<DbUser> {
  const [user] = await supabaseInsert<DbUser>('users', { line_user_id: lineUserId }, 'line_user_id');
  return user;
}

export async function insertMessage(data: {
  groupId: string;
  userId: string;
  lineMessageId: string;
  content: string;
}): Promise<DbMessage | null> {
  const existing = await supabaseSelect<DbMessage>('messages', {
    select: 'id,content,created_at',
    line_message_id: `eq.${data.lineMessageId}`,
    limit: 1,
  });
  if (existing.length > 0) return null;

  const rows = await supabaseInsert<DbMessage>('messages', {
    group_id: data.groupId,
    user_id: data.userId,
    line_message_id: data.lineMessageId,
    content: data.content,
  }, 'line_message_id');
  return rows[0] ?? null;
}

export async function getRecentMessages(groupId: string, limit: number): Promise<DbMessage[]> {
  return supabaseSelect<DbMessage>('messages', {
    select: 'id,content,created_at,users(display_name,line_user_id)',
    group_id: `eq.${groupId}`,
    order: 'created_at.desc',
    limit,
  });
}

export async function getMessageIdsOlderThan(groupId: string, cutoffIso: string): Promise<string[]> {
  const rows = await supabaseSelect<DbMessageId>('messages', {
    select: 'id',
    group_id: `eq.${groupId}`,
    created_at: `lt.${cutoffIso}`,
    limit: 1000,
  });
  return rows.map((row) => row.id);
}

export async function getMessageIdsPastGroupLimit(groupId: string, maxMessages: number): Promise<string[]> {
  const rows = await supabaseSelect<DbMessageId>('messages', {
    select: 'id',
    group_id: `eq.${groupId}`,
    order: 'created_at.desc',
    offset: maxMessages,
    limit: 1000,
  });
  return rows.map((row) => row.id);
}

export async function deleteMessagesByIds(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await supabaseDelete('messages', { id: `in.(${ids.join(',')})` });
}

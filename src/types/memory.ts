export type MemoryCategory =
  | 'decision'
  | 'plan'
  | 'recommendation'
  | 'preference'
  | 'fact'
  | 'resource'
  | 'event'
  | 'other';

export type MemoryRecord = {
  id: string;
  groupId: string;
  content: string;
  summary?: string | null;
  category: MemoryCategory;
  importance: number;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
  similarity?: number;
};

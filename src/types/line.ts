export type LineWebhookBody = {
  events?: LineEvent[];
};

export type LineEvent = {
  type?: string;
  replyToken?: string;
  source?: {
    type?: string;
    groupId?: string;
    userId?: string;
  };
  message?: {
    id?: string;
    type?: string;
    text?: string;
    mention?: {
      mentionees?: Array<{
        isSelf?: boolean;
        userId?: string;
        displayName?: string;
      }>;
    };
  };
};

export type Role = 'user' | 'assistant' | 'system';

export type ConnectionState = 'idle' | 'connecting' | 'connected' | 'error';

export type Message = {
  id: string;
  role: Role;
  content: string;
  imageUri?: string;
  streaming?: boolean;
};

export type PermissionReply = 'once' | 'always' | 'reject';

export type PermissionRequestStatus = 'pending' | 'submitting' | 'error';

export type PermissionRequest = {
  id: string;
  sessionId: string;
  permission: string;
  patterns: string[];
  always: string[];
  filepath: string;
  parentDir: string;
  messageId: string;
  callId: string;
  status: PermissionRequestStatus;
  error: string;
  createdAt: number;
};

export type QuestionOption = {
  label: string;
  description: string;
};

export type QuestionPrompt = {
  header: string;
  question: string;
  multiple: boolean;
  customEnabled: boolean;
  options: QuestionOption[];
};

export type QuestionRequestStatus = 'pending' | 'submitting' | 'error';

export type QuestionRequest = {
  id: string;
  sessionId: string;
  questions: QuestionPrompt[];
  status: QuestionRequestStatus;
  error: string;
  createdAt: number;
};

export type Endpoint = {
  id: string;
  name: string;
  baseUrl: string;
};

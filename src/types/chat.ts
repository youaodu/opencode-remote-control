export type Role = 'user' | 'assistant' | 'system';

export type ConnectionState = 'idle' | 'connecting' | 'connected' | 'error';

export type Message = {
  id: string;
  role: Role;
  content: string;
  imageUri?: string;
  streaming?: boolean;
};

export type Endpoint = {
  id: string;
  name: string;
  baseUrl: string;
};

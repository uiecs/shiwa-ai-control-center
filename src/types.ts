export type Section =
  | 'AI Chat'
  | 'AI VIP'
  | 'Convert To Link'
  | 'Command Console'
  | 'Content Studio'
  | 'Image Generator'
  | 'Powerful Browser'
  | 'Deep Username Search'
  | 'Safe Publishing'
  | 'Settings';

export type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  actions?: { type: 'connectInstagram'; label: string; url: string }[];
};

export type RuntimeStatus =
  | 'SUPPORTED'
  | 'LIMITED'
  | 'REQUIRES_NATIVE_RUNTIME'
  | 'REQUIRES_REMOTE_BROWSER'
  | 'BLOCKED_BY_DESTINATION_POLICY';

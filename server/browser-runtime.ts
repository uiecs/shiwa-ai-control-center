export type RuntimeKind = 'WebEmbedRuntime' | 'NativeWebViewRuntime' | 'RemoteBrowserRuntime';
export type RuntimeStatus =
  | 'SUPPORTED'
  | 'LIMITED'
  | 'REQUIRES_NATIVE_RUNTIME'
  | 'REQUIRES_REMOTE_BROWSER'
  | 'BLOCKED_BY_DESTINATION_POLICY';

export interface BrowserRuntime {
  kind: RuntimeKind;
  canEmbed(url: string): Promise<boolean>;
  status(url: string): Promise<RuntimeStatus>;
}

export class WebEmbedRuntime implements BrowserRuntime {
  readonly kind = 'WebEmbedRuntime' as const;

  async canEmbed(): Promise<boolean> {
    return false;
  }

  async status(): Promise<RuntimeStatus> {
    return 'LIMITED';
  }
}

export class NativeWebViewRuntime implements BrowserRuntime {
  readonly kind = 'NativeWebViewRuntime' as const;

  async canEmbed(): Promise<boolean> {
    return true;
  }

  async status(): Promise<RuntimeStatus> {
    return 'REQUIRES_NATIVE_RUNTIME';
  }
}

export class RemoteBrowserRuntime implements BrowserRuntime {
  readonly kind = 'RemoteBrowserRuntime' as const;

  async canEmbed(): Promise<boolean> {
    return true;
  }

  async status(): Promise<RuntimeStatus> {
    return 'REQUIRES_REMOTE_BROWSER';
  }
}

export function selectBrowserRuntime(target: 'web' | 'android' | 'remote'): BrowserRuntime {
  if (target === 'android') return new NativeWebViewRuntime();
  if (target === 'remote') return new RemoteBrowserRuntime();
  return new WebEmbedRuntime();
}

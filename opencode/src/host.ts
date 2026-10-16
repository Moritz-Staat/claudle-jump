/**
 * The slice of the OpenCode V2 TUI plugin context (`@opencode/plugin/tui`
 * 2.0.20, `Context`) this plugin uses, typed locally so the package needs
 * neither the host SDK nor OpenTUI at build time.
 */

export type KeymapCommand = {
  readonly id?: string;
  readonly title?: string;
  readonly description?: string;
  readonly group?: string;
  readonly bind?: false | string;
  readonly palette?: true;
  readonly slash?: { readonly name: string; readonly aliases?: string[] };
  readonly run: (input?: string) => void | false | Promise<void>;
};

export type KeymapLayer = {
  readonly mode?: string;
  readonly enabled?: boolean | (() => boolean);
  readonly priority?: number;
  readonly commands?: readonly KeymapCommand[];
};

/** Input of the `session.panel` slot. */
export type PanelInput = {
  readonly name: string;
  readonly sessionID: string;
  readonly width: number;
  readonly presentation: 'panel' | 'fullscreen';
  readonly focused: boolean;
  readonly focus: () => void;
  readonly close: () => void;
  readonly toggleFullscreen: () => void;
};

export type SlotClaim =
  | { readonly append: 'app'; readonly render: () => unknown }
  | { readonly append: 'session.panel'; readonly render: (input: PanelInput) => unknown }
  | {
      readonly append: 'sidebar.content';
      readonly render: (input: { readonly sessionID: string }) => unknown;
    };

export type Context = {
  readonly app: { readonly version: string };
  readonly renderer: { readonly width: number; readonly height: number };
  readonly themeMode: 'dark' | 'light';
  readonly keymap: {
    layer(input: () => KeymapLayer): void;
    dispatch(id: string, input?: string): void;
    readonly mode: { current(): string; push(mode: string): () => void };
  };
  readonly storage: {
    store<Value extends object>(
      key: string,
      options: { readonly initial: Value },
    ): readonly [Value, (mutation: (draft: Value) => void) => Promise<void>];
  };
  readonly data: {
    listen(handler: (event: { readonly details: { readonly type: string; readonly data?: any } }) => void): () => void;
    readonly session: {
      get(sessionID: string): { readonly parentID?: string } | undefined;
      status(sessionID: string): 'idle' | 'running';
    };
  };
  readonly ui: {
    readonly toast: { show(options: { readonly title?: string; readonly message: string }): void };
    readonly router: {
      current(): { readonly type: string; readonly sessionID?: string };
    };
    readonly panel: {
      open(name: string, options?: { readonly presentation?: 'panel' | 'fullscreen' }): boolean;
      close(): void;
      current(): { readonly name: string; readonly sessionID: string } | undefined;
    };
    slot(claim: SlotClaim): () => void;
  };
};

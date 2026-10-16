/** Minimal JSX typing for OpenTUI's Solid runtime, which the host provides at run time. */
declare module '@opentui/solid/jsx-runtime' {
  export namespace JSX {
    type Element = unknown;
    interface IntrinsicElements {
      box: Record<string, unknown>;
      text: Record<string, unknown>;
      span: Record<string, unknown>;
    }
    interface ElementChildrenAttribute {
      children: {};
    }
  }
  export const jsx: (...args: unknown[]) => unknown;
  export const jsxs: (...args: unknown[]) => unknown;
  export const Fragment: unknown;
}

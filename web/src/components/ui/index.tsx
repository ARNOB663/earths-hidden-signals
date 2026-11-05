// Shared control tokens. No hooks, so they work on server and client pages.

/** One place for the height of every kind of control, so buttons, pills and segments line up. */
export const CONTROL = {
  /** Standalone buttons and icon buttons: a 40px touch target. */
  button: "min-h-10",
  /** Segments inside a pill or segmented control. */
  segment: "h-8",
  /** Soft accent ring shared by controls that draw their own focus state. */
  focusRing: "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
  /** The standard control transition. */
  transition: "transition-colors duration-150",
} as const;

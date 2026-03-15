// Type definitions for the create-brewsite CLI.

/** Configuration gathered from interactive prompts. */
export interface ProjectConfig {
  /** Absolute path to the target project root. */
  projectRoot: string;
  /** List of @brewsite/* packages to install as dependencies. */
  packages: string[];
  /** Whether to install @brewsite/claude-author as a dev dependency. */
  installClaudeAuthor: boolean;
}

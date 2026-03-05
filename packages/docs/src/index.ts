// Public API surface for @brewsite/docs.
// This is the only file consumers should import from.

// ── Nav ───────────────────────────────────────────────────────────────────────
export { defineDocsNav } from './nav/defineDocsNav';
export type { DocsNav, DocsNavGroup, DocsNavSection } from './nav/types';

// ── Layout ────────────────────────────────────────────────────────────────────
export { DocsApp } from './layout/DocsApp';
export type { DocsAppProps } from './layout/DocsApp';
export { DocsMainColumn } from './layout/DocsMainColumn';
export type { DocsMainColumnProps } from './layout/DocsMainColumn';

// ── Section ───────────────────────────────────────────────────────────────────
export { Section } from './section/Section';
export type { SectionProps } from './section/Section';

// ── Demo ──────────────────────────────────────────────────────────────────────
export { DocsDemo } from './demo/DocsDemo';
export type { DocsDemoProps } from './demo/DocsDemo';
// ── Content primitives ────────────────────────────────────────────────────────
export { CodeBlock } from './ui/CodeBlock';
export type { CodeBlockProps, CodeLanguage } from './ui/CodeBlock';
export { Callout } from './ui/Callout';
export type { CalloutProps, CalloutType } from './ui/Callout';
export { PropTable } from './ui/PropTable';
export type { PropTableProps, PropRow } from './ui/PropTable';

// ── Hooks ─────────────────────────────────────────────────────────────────────
export { useActiveSectionId } from './hooks/useActiveSectionId';
export { useDemoProgress } from './hooks/useDemoProgress';

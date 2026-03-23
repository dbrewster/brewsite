// Single source of truth for homepage copy — scene files consume from here.

/** Identifies a homepage section's messaging block. */
export type SceneMessageKey =
  | 'hero'
  | 'recognition'
  | 'scope'
  | 'authoring'
  | 'team'
  | 'trust'
  | 'cta';

/** Structured messaging for a single homepage section. */
export type SceneMessage = {
  readonly eyebrow?: string;
  readonly headline: string;
  readonly support?: string;
  readonly punchline?: string;
  readonly proofRail?: readonly string[];
};

/** Complete messaging map for all homepage sections. */
export const MESSAGES: Readonly<Record<SceneMessageKey, SceneMessage>> = {
  hero: {
    eyebrow: 'React toolkit for technical storytelling',
    headline: 'Turn product thinking into decks, docs, sites, and demos.',
    support:
      'Author diagrams, models, charts, screens, and slides in JSX. Compile once. Play smoothly.',
    proofRail: ['Diagrams', 'Models', 'Charts', 'Screens', 'Slides'],
  },
  recognition: {
    headline: 'You rebuild the same story too many times.',
    support:
      'Deck for the review. Doc for engineering. Site for launch. Screenshot for everyone else.',
    punchline: 'Same product. Flattened five ways.',
  },
  scope: {
    headline: 'One story. Many surfaces.',
    support:
      'Ship the launch site. Present the deck. Publish the explainer. Keep the system thinking intact.',
  },
  authoring: {
    headline: 'Write scenes in JSX.',
    support:
      'BrewSite compiles snapshots into a baked runtime track so the browser plays the story instead of inventing it on the fly.',
  },
  team: {
    headline: 'PM frames it. Dev ships it. Marketing reuses it.',
    support:
      'BrewSite is strongest when one story needs to survive across product, engineering, launch, and presentation surfaces.',
  },
  trust: {
    headline: 'Built like software, not a one-off demo.',
    support:
      'TypeScript. React. Published packages. Starter CLI. AI-assisted docs search.',
  },
  cta: {
    headline: 'npm create brewsite',
  },
};

/** Retrieve messaging for a given section key. */
export function getMessage(key: SceneMessageKey): SceneMessage {
  return MESSAGES[key];
}

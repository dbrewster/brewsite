/**
 * Labels element DSL components.
 */

import type { LabelDefinition } from './types';

export type LabelProps = LabelDefinition & { children?: never };

/**
 * Label attached to a model part.
 *
 * Must be nested under `<BodyPart>` or `<Subpart>`.
 * `targetPartId` is resolved automatically from the parent body-part context
 * and is not set directly on `<Label>`.
 */
export const Label = (_props: LabelProps) => null;
Label.displayName = 'Label';

export const Labels = (_props: { children?: React.ReactNode }) => null;
Labels.displayName = 'Labels';

// NOTE: Handler registration for Label/Labels moved to registerCoreHandlers()
// in packages/core/src/compiler/coreHandlers.ts (Phase 3, temporary).
// In Phase 4, these handlers move to @brewsite/model's registerModelHandlers().

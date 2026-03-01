/**
 * Labels element DSL components.
 */

import type { ReactNode } from 'react';
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

export const Labels = (_props: { children?: ReactNode }) => null;
Labels.displayName = 'Labels';

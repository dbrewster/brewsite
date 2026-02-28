/**
 * Labels element DSL components.
 */

import { registerNode } from '../compiler/registry';
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

// Register handlers
registerNode(Label, () => {
  throw new Error('<Label> must be nested under <BodyPart> or <Subpart>.');
});

registerNode(Labels, () => {
  throw new Error('<Labels> is not supported. Use <Label> under <BodyPart> or <Subpart>.');
});

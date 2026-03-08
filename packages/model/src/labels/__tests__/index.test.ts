import { describe, it, expect } from 'vitest';
import {
  Label,
  Labels,
  renderLabels,
  LabelItem,
} from '../index';
import { Label as DirectLabel, Labels as DirectLabels } from '../../elements/model/ModelWidget';
import { renderLabels as DirectRender } from '../render';
import { LabelItem as DirectItem } from '../LabelItem';

describe('labels index re-exports', () => {
  it('re-exports DSL components and helpers', () => {
    expect(Label).toBe(DirectLabel);
    expect(Labels).toBe(DirectLabels);
    expect(renderLabels).toBe(DirectRender);
    expect(LabelItem).toBe(DirectItem);
  });
});

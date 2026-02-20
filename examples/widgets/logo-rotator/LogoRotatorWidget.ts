import type { AnimationTickContext, IAnimationController, IVariableProvider } from '../../../src/widget/types';
import { createLogoRotator } from './logoRotator';
import type { LogoRotatorConfig, LogoSpec } from './types';

export class LogoRotatorWidget implements IAnimationController, IVariableProvider {
  readonly widgetId: string;
  readonly variableNamespace: string;
  readonly variableKeys = ['currentLogoId', 'currentColor', 'currentLabel'] as const;

  private logos: LogoSpec[];
  private rotator;
  private currentId = '';
  private currentColor = '#ffffff';
  private currentLabel = '';

  constructor(id: string, private config: LogoRotatorConfig) {
    this.widgetId = id;
    this.variableNamespace = id;
    this.logos = [...config.logos];
    this.rotator = createLogoRotator(this.logos.map((logo) => logo.id), config);
    this.updateFromRotator();
  }

  onTick(ctx: AnimationTickContext): void {
    const state = this.rotator.tick(ctx.deltaSeconds * 1000);
    this.updateFromState(state);

    ctx.variables.set(this.variableNamespace, 'currentColor', this.currentColor);
    ctx.variables.set(this.variableNamespace, 'currentLogoId', this.currentId);
    ctx.variables.set(this.variableNamespace, 'currentLabel', this.currentLabel);
  }

  private updateFromRotator(): void {
    const state = this.rotator.getState();
    this.updateFromState(state);
  }

  private updateFromState(state: { currentId: string }): void {
    const logo = this.logos.find((entry) => entry.id === state.currentId) ?? this.logos[0];
    this.currentId = state.currentId || logo?.id || '';
    this.currentColor = logo?.color ?? '#ffffff';
    this.currentLabel = logo?.label ?? this.currentId;
  }
}

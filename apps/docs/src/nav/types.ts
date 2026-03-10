// Navigation type contracts for the continuous-scroll docs layout.
// scrollOffset is removed — active section detection and scrolling are
// now computed at runtime from live element measurements via NavContext.

export interface NavItem {
  label: string;
  /** DOM element id to pass to scrollToSection(). Must match the id on the ProseBlock or ScenePanel. */
  id?: string;
  /** Router path for non-continuous-scroll sections (core-nav, diagram-nav, model-nav). */
  path?: string;
  /**
   * Optional within-panel progress [0..1] for multi-step demos.
   * When set, scrollToSection(id, progress) positions the panel at this
   * fraction of its scroll window rather than the panel top.
   */
  progress?: number;
}

export interface NavSection {
  title: string;
  /** DOM element id of the ActHeader for this section. Used for active group detection. */
  actId?: string;
  items: NavItem[];
}

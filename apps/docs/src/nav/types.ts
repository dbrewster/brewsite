export interface NavItem {
  label: string;
  path?: string;         // legacy — kept for backward compat with route-based nav
  sceneId?: string;      // continuous scroll scene id
  scrollOffset?: number; // pixels from window top for window.scrollTo
}

export interface NavSection {
  title: string;
  actSceneId?: string;   // act header scene id for this section
  items: NavItem[];
}

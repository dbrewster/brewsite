// Shared scene asset constants for website scenes.
// Uses solid background colors rather than image URLs (no background image files needed).

export const sceneLighting = {
  industrial: {
    ambient: 0.3,
    directional: 0.7,
    direction: [5, 15, 20] as [number, number, number],
  },
  soft: {
    ambient: 0.5,
    directional: 0.5,
    direction: [0, 20, 20] as [number, number, number],
  },
} as const;

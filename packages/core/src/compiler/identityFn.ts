// Canonical identity function for the progress mapper system.
// Exported as a named const so reference-equality checks in buildProgressProfile
// correctly identify a scene as uniform when no fn is declared.
export const IDENTITY_FN = (t: number): number => t;

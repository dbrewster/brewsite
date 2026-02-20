# Robot scenes

Each scene lives in its own file and exports a `SceneDefinition`.

Add a new scene:
1) Create `sceneNN_name.ts` exporting `sceneName`.
2) Set `id` to match the timeline stop and `index` to the stop index.
3) Define `getFrame()` with full scene state (lighting, environment, background, model, motion).
4) Put transition logic (from previous scene) in the *next* scene file via `transitions`.
5) Register the scene in `sceneOrder.ts` (keep id/index aligned with timeline stops).

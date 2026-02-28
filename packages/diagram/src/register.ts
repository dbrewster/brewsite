// Auto-registers all @brewsite/diagram DSL node handlers at module-load time.
// Imported as a side-effect from packages/diagram/src/index.ts.
// registerNode() is idempotent — re-importing this module is safe.
import { registerDiagramHandlers } from './compiler/handlers';

registerDiagramHandlers();

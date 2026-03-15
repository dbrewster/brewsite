// Query-time embedding using nomic-embed-text-v1.5 via @huggingface/transformers.

import { env, pipeline, type FeatureExtractionPipeline } from '@huggingface/transformers';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let embedPipeline: FeatureExtractionPipeline | null = null;

// Wrapper to avoid TS2590 "Expression produces a union type that is too complex to represent"
// on the pipeline() call. The return type for 'feature-extraction' is always FeatureExtractionPipeline.
async function createPipeline(modelDir: string): Promise<FeatureExtractionPipeline> {
  const create = pipeline as (
    task: string,
    model: string,
    options: { dtype: string; device: string },
  ) => Promise<FeatureExtractionPipeline>;
  return create('feature-extraction', modelDir, { dtype: 'q4', device: 'cpu' });
}

/**
 * Initialize the embedding pipeline.
 * Loads the bundled nomic-embed-text-v1.5 model from disk.
 * Must be called once at server startup.
 */
export async function initEmbedder(): Promise<void> {
  // Point to bundled model — prevent any network calls
  const modelDir = join(__dirname, '..', 'models', 'nomic-embed-text-v1.5');
  env.localModelPath = modelDir;
  env.allowRemoteModels = false;

  embedPipeline = await createPipeline(modelDir);
}

/**
 * Embed a search query string into a 768-dimensional vector.
 * Automatically prepends the required "search_query: " task prefix.
 */
export async function embedQuery(query: string): Promise<number[]> {
  if (!embedPipeline) {
    throw new Error('Embedder not initialized. Call initEmbedder() first.');
  }

  // Task prefix required by nomic-embed-text-v1.5 for query embedding
  const prefixedQuery = `search_query: ${query}`;
  const output = await embedPipeline(prefixedQuery, {
    pooling: 'mean',
    normalize: true,
  });

  // output is a Tensor — convert to plain number array
  return Array.from(output.data as Float32Array);
}

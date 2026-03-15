// Tests for the search module: loadIndex, searchDocs, getDocById, listTopics.

import { describe, it, expect, beforeAll } from 'vitest';
import { create, insert, save } from '@orama/orama';
import { loadIndexFromData, getDocById, listTopics } from '../src/search.js';

/**
 * Build a small test Orama index with known documents.
 * Embeddings are zero-vectors since we cannot run the real model in tests;
 * this tests BM25 search and document retrieval, not vector scoring.
 */
async function buildTestIndex() {
  const db = create({
    schema: {
      id: 'string' as const,
      content: 'string' as const,
      embedding: 'vector[768]' as const,
      filePath: 'string' as const,
      heading: 'string' as const,
      title: 'string' as const,
      topic: 'string' as const,
    },
  });

  const zeroEmbedding = new Array(768).fill(0);

  const docs = [
    {
      id: 'core/camera-dsl.md#Camera Props',
      content: 'The Camera element accepts x, y, w, h, fov, distance, azimuth, and polar props to position the viewport.',
      filePath: 'core/camera-dsl.md',
      heading: 'Camera Props',
      title: 'Camera DSL',
      topic: 'core',
    },
    {
      id: 'core/camera-dsl.md#Orbit Mode',
      content: 'Orbit mode enables user interaction with the camera via mouse drag and scroll wheel.',
      filePath: 'core/camera-dsl.md',
      heading: 'Orbit Mode',
      title: 'Camera DSL',
      topic: 'core',
    },
    {
      id: 'core/background-dsl.md#Background Color',
      content: 'The Background element sets the scene background color using a hex string.',
      filePath: 'core/background-dsl.md',
      heading: 'Background Color',
      title: 'Background DSL',
      topic: 'core',
    },
    {
      id: 'diagram/nodes.md#Node Shapes',
      content: 'Diagram nodes can have various shapes including box, cylinder, diamond, and hexagon.',
      filePath: 'diagram/nodes.md',
      heading: 'Node Shapes',
      title: 'Diagram Nodes',
      topic: 'diagram',
    },
    {
      id: 'diagram/edges.md#Edge Routing',
      content: 'Edge routing computes spline control points from source to target node positions.',
      filePath: 'diagram/edges.md',
      heading: 'Edge Routing',
      title: 'Diagram Edges',
      topic: 'diagram',
    },
    {
      id: 'guides/transitions.md#Entry Transitions',
      content: 'Entry transitions animate elements as they appear in a new scene. The transition belongs to the incoming scene.',
      filePath: 'guides/transitions.md',
      heading: 'Entry Transitions',
      title: 'Transitions Guide',
      topic: 'guides',
    },
  ];

  for (const doc of docs) {
    insert(db, { ...doc, embedding: zeroEmbedding });
  }

  return save(db);
}

describe('search module', () => {
  beforeAll(async () => {
    const indexData = await buildTestIndex();
    await loadIndexFromData(indexData);
  });

  describe('getDocById', () => {
    it('returns the correct document for a valid ID', () => {
      const result = getDocById('core/camera-dsl.md#Camera Props');
      expect(result).not.toBeNull();
      expect(result!.id).toBe('core/camera-dsl.md#Camera Props');
      expect(result!.content).toContain('Camera element');
      expect(result!.score).toBe(1.0);
      expect(result!.meta.filePath).toBe('core/camera-dsl.md');
      expect(result!.meta.heading).toBe('Camera Props');
      expect(result!.meta.title).toBe('Camera DSL');
      expect(result!.meta.topic).toBe('core');
    });

    it('returns null for an unknown ID', () => {
      const result = getDocById('nonexistent/file.md#Missing');
      expect(result).toBeNull();
    });

    it('returns correct metadata for a diagram document', () => {
      const result = getDocById('diagram/nodes.md#Node Shapes');
      expect(result).not.toBeNull();
      expect(result!.meta.topic).toBe('diagram');
      expect(result!.meta.title).toBe('Diagram Nodes');
    });
  });

  describe('listTopics', () => {
    it('returns all topic areas', () => {
      const topics = listTopics();
      const topicNames = topics.map(t => t.topic);
      expect(topicNames).toContain('core');
      expect(topicNames).toContain('diagram');
      expect(topicNames).toContain('guides');
    });

    it('returns correct counts for populated topics', () => {
      const topics = listTopics();
      const coreTopic = topics.find(t => t.topic === 'core');
      expect(coreTopic).toBeDefined();
      expect(coreTopic!.count).toBe(3);

      const diagramTopic = topics.find(t => t.topic === 'diagram');
      expect(diagramTopic).toBeDefined();
      expect(diagramTopic!.count).toBe(2);
    });

    it('returns zero count for unpopulated topics', () => {
      const topics = listTopics();
      const chartsTopic = topics.find(t => t.topic === 'charts');
      expect(chartsTopic).toBeDefined();
      expect(chartsTopic!.count).toBe(0);
    });

    it('includes descriptions for each topic', () => {
      const topics = listTopics();
      for (const topic of topics) {
        expect(topic.description.length).toBeGreaterThan(0);
      }
    });
  });
});

import { describe, it, expect } from 'vitest';
import { mkdtemp, writeFile, readFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { NodeIO, Document } from '@gltf-transform/core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const SCRIPT = path.resolve(ROOT, 'scripts/gen-scene-dsl.mjs');

type RunResult = { code: number; stdout: string; stderr: string };

const run = (args: string[]) =>
  new Promise<RunResult>((resolve) => {
    const child = spawn('node', [SCRIPT, ...args], { cwd: ROOT });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    child.on('close', (code) => {
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });

const writeResourceFile = async (dir: string, content: string) => {
  const filePath = path.join(dir, 'resources.tsx');
  await writeFile(filePath, content, 'utf8');
  return filePath;
};

const writeMinimalGlb = async (filePath: string) => {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const position = doc
    .createAccessor()
    .setType('VEC3')
    .setArray(new Float32Array([0, 0, 0]))
    .setBuffer(buffer);
  const prim = doc.createPrimitive().setAttribute('POSITION', position);
  const mesh = doc.createMesh('BodyMesh').addPrimitive(prim);
  const node = doc.createNode('Head').setMesh(mesh);
  const scene = doc.createScene('Scene').addChild(node);
  doc.getRoot().setDefaultScene(scene);
  const io = new NodeIO();
  await io.write(filePath, doc);
};

describe('gen-scene-dsl', () => {
  it('fails when siteResources export is missing', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'scene-dsl-'));
    const input = await writeResourceFile(
      dir,
      `export const notResources = null;`,
    );
    const outDir = path.join(dir, 'out');
    const result = await run(['--input', input, '--out-dir', outDir]);
    expect(result.code).not.toBe(0);
    expect(result.stderr).toContain('Missing required export: siteResources');
  });

  it('fails on invalid role', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'scene-dsl-'));
    const input = await writeResourceFile(
      dir,
      `
        export const siteResources = {
          models: [
            { type: 'Robot', path: '/assets/robot.glb', role: 'primary-ish', anchorKeys: [] },
          ],
          animations: [],
        } as const;
      `,
    );
    const outDir = path.join(dir, 'out');
    const result = await run(['--input', input, '--out-dir', outDir]);
    expect(result.code).not.toBe(0);
    expect(result.stderr).toContain('Invalid role');
  });

  it('writes a generated DSL file with expected exports', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'scene-dsl-'));
    const publicDir = path.join(ROOT, 'public', 'assets');
    await mkdir(publicDir, { recursive: true });
    const robotGlb = path.join(publicDir, 'robot.glb');
    await writeMinimalGlb(robotGlb);

    const input = await writeResourceFile(
      dir,
      `
        export const siteResources = {
          models: [
            { type: 'Robot', path: '/assets/robot.glb', role: 'primary', anchorKeys: ['head'] },
          ],
          animations: [],
        } as const;
      `,
    );
    const outDir = path.join(dir, 'out');
    const result = await run(['--input', input, '--out-dir', outDir]);
    expect(result.code).toBe(0);
    const generated = await readFile(path.join(outDir, 'siteResources.generated.ts'), 'utf8');
    expect(generated).toContain('export type ModelType =');
    expect(generated).toContain('export type AnimationType =');
    const dsl = await readFile(path.join(outDir, 'sceneDsl.generated.tsx'), 'utf8');
    expect(dsl).toContain('export {');
    expect(dsl).toContain('BodyPart');
    expect(dsl).toContain('ModelPart');
    expect(dsl).toContain('Subpart');
    expect(dsl).toContain('export const Robot = Object.assign');
    expect(dsl).toContain('type="Robot"');
    expect(dsl).toContain('ModelRouter');
    expect(dsl).toContain('BodyMesh: (props: BodyPartProps) =>');
    await rm(robotGlb, { force: true });
  });
});

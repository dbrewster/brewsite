import { describe, it, expect } from 'vitest';
import { mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

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

describe('gen-scene-dsl', () => {
  it('fails when sceneResources export is missing', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'scene-dsl-'));
    const input = await writeResourceFile(
      dir,
      `export const notResources = null;`,
    );
    const outDir = path.join(dir, 'out');
    const result = await run(['--input', input, '--out-dir', outDir]);
    expect(result.code).not.toBe(0);
    expect(result.stderr).toContain('Missing required export: sceneResources');
  });

  it('fails on invalid role', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'scene-dsl-'));
    const input = await writeResourceFile(
      dir,
      `
        export const sceneResources = (
          <Resources>
            <ModelDefinition id="robot" path="/assets/robot.glb" role="primary-ish" />
          </Resources>
        );
      `,
    );
    const outDir = path.join(dir, 'out');
    const result = await run(['--input', input, '--out-dir', outDir]);
    expect(result.code).not.toBe(0);
    expect(result.stderr).toContain('Invalid role');
  });

  it('writes a generated DSL file with expected exports', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'scene-dsl-'));
    const input = await writeResourceFile(
      dir,
      `
        export const sceneResources = (
          <Resources>
            <ModelDefinition id="robot" path="/assets/robot.glb" role="primary" />
            <AnimationDefinition id="waving" path="/assets/motion/wave.glb" clipName="wave" />
          </Resources>
        );
      `,
    );
    const outDir = path.join(dir, 'out');
    const result = await run(['--input', input, '--out-dir', outDir]);
    expect(result.code).toBe(0);
    const generated = await readFile(path.join(outDir, 'sceneResources.generated.ts'), 'utf8');
    expect(generated).toContain('export type ModelId =');
    expect(generated).toContain('export type AnimationId =');
    expect(generated).toContain('export const resourceRegistry');
    const dsl = await readFile(path.join(outDir, 'sceneDsl.generated.tsx'), 'utf8');
    expect(dsl).toContain('export const BodyPart');
    expect(dsl).toContain('export const ModelPart');
    expect(dsl).toContain('export const Subpart');
  });
});

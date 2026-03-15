// Tests for the scaffold module's package manager detection and command generation.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { detectPackageManager, buildInstallCommand } from '../src/scaffold.js';

describe('detectPackageManager', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = join(tmpdir(), `create-brewsite-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('detects pnpm from pnpm-lock.yaml', () => {
    writeFileSync(join(tempDir, 'pnpm-lock.yaml'), '');
    expect(detectPackageManager(tempDir)).toBe('pnpm');
  });

  it('detects yarn from yarn.lock', () => {
    writeFileSync(join(tempDir, 'yarn.lock'), '');
    expect(detectPackageManager(tempDir)).toBe('yarn');
  });

  it('falls back to npm when no lock file exists', () => {
    expect(detectPackageManager(tempDir)).toBe('npm');
  });

  it('prefers pnpm when both pnpm-lock.yaml and yarn.lock exist', () => {
    writeFileSync(join(tempDir, 'pnpm-lock.yaml'), '');
    writeFileSync(join(tempDir, 'yarn.lock'), '');
    expect(detectPackageManager(tempDir)).toBe('pnpm');
  });
});

describe('buildInstallCommand', () => {
  it('generates correct pnpm install command', () => {
    const cmd = buildInstallCommand('pnpm', ['@brewsite/core', '@brewsite/diagram']);
    expect(cmd).toBe('pnpm add @brewsite/core @brewsite/diagram');
  });

  it('generates correct pnpm dev install command', () => {
    const cmd = buildInstallCommand('pnpm', ['@brewsite/claude-author'], { dev: true });
    expect(cmd).toBe('pnpm add -D @brewsite/claude-author');
  });

  it('generates correct npm install command', () => {
    const cmd = buildInstallCommand('npm', ['@brewsite/core']);
    expect(cmd).toBe('npm install @brewsite/core');
  });

  it('generates correct npm dev install command', () => {
    const cmd = buildInstallCommand('npm', ['@brewsite/claude-author'], { dev: true });
    expect(cmd).toBe('npm install --save-dev @brewsite/claude-author');
  });

  it('generates correct yarn install command', () => {
    const cmd = buildInstallCommand('yarn', ['@brewsite/core', '@brewsite/diagram']);
    expect(cmd).toBe('yarn add @brewsite/core @brewsite/diagram');
  });

  it('generates correct yarn dev install command', () => {
    const cmd = buildInstallCommand('yarn', ['@brewsite/claude-author'], { dev: true });
    expect(cmd).toBe('yarn add -D @brewsite/claude-author');
  });
});

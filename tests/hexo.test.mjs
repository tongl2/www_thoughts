#!/usr/bin/env node

import { execSync } from 'child_process';
import { existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';

const ROOT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC_DIR = join(ROOT_DIR, 'public');

describe('Hexo build', () => {
  before(() => {
    execSync('npx hexo clean', { cwd: ROOT_DIR, stdio: 'inherit' });
  });

  test('Generate site', () => {
    execSync('npx hexo generate', { cwd: ROOT_DIR, stdio: 'inherit' });
  });

  test('Verify public directory exists', () => {
    assert.ok(existsSync(PUBLIC_DIR), 'Public directory not found');
  });

  test('Verify index.html was generated', () => {
    const indexPath = join(PUBLIC_DIR, 'index.html');
    assert.ok(existsSync(indexPath), 'index.html not found in public directory');
  });

  test('Verify non-empty output', () => {
    const files = readdirSync(PUBLIC_DIR);
    assert.ok(files.length > 0, 'Public directory is empty');
    console.log(`  Generated ${files.length} files/directories`);
  });

  test('Verify robots.txt was generated', () => {
    const robotsPath = join(PUBLIC_DIR, 'robots.txt');
    assert.ok(existsSync(robotsPath), 'robots.txt not found in public directory');
  });

  after(() => {
    console.log('Cleaning up...');
    execSync('npx hexo clean', { cwd: ROOT_DIR, stdio: 'inherit' });
  });
});

#!/usr/bin/env node

/**
 * Ensure Next.js generated type validators can resolve source modules.
 *
 * Next.js writes the validators into `.next/types` and imports entries via
 * relative paths like `../app/.../route.js`. Under certain environments the
 * `.next/app` directory is missing, so TypeScript can't follow those imports.
 * Creating a symlink from `.next/app` to the project `app` directory keeps the
 * generated validators accurate without touching the emitted files themselves.
 */

const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const nextDir = path.join(projectRoot, '.next');
const sourceAppDir = path.join(projectRoot, 'app');
const linkPath = path.join(nextDir, 'app');

function ensureDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function ensureSymlink(target, link) {
  try {
    const stats = fs.lstatSync(link);

    if (stats.isSymbolicLink()) {
      const currentTarget = fs.readlinkSync(link);
      const absoluteTarget = path.resolve(path.dirname(link), currentTarget);

      if (absoluteTarget === target) {
        return;
      }

      fs.unlinkSync(link);
    } else {
      // Existing non-symlink directory/file blocks the link; do not mutate it silently.
      return;
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }

  const relativeTarget = path.relative(path.dirname(link), target) || '.';
  const symlinkType = process.platform === 'win32' ? 'junction' : 'dir';

  fs.symlinkSync(relativeTarget, link, symlinkType);
}

function main() {
  ensureDirectory(nextDir);
  ensureSymlink(sourceAppDir, linkPath);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error('[ensure-next-type-links]', error);
    process.exitCode = 1;
  }
}


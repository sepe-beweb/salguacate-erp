import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { withTestUploads, readTestUploadsDirectory } = require('../../../scripts/test-upload-sandbox.cjs');

describe('Disposable E2E upload storage', () => {
  it('creates an empty isolated directory, validates it and removes only its own files', () => {
    let first, second;
    withTestUploads(one => {
      first = one; expect(readTestUploadsDirectory(one)).toBe(one); expect(fs.readdirSync(one)).toEqual([]);
      fs.writeFileSync(path.join(one, 'synthetic.png'), 'fixture');
      withTestUploads(two => { second = two; expect(two).not.toBe(one); fs.writeFileSync(path.join(two, 'synthetic.jpg'), 'fixture'); });
      expect(fs.existsSync(second)).toBe(false); expect(fs.readFileSync(path.join(one, 'synthetic.png'), 'utf8')).toBe('fixture');
    });
    expect(fs.existsSync(first)).toBe(false);
  });
  it('cleans up after a failed child operation without masking its error', () => {
    let created;
    expect(() => withTestUploads(dir => { created = dir; fs.writeFileSync(path.join(dir, 'fixture'), 'test'); throw new Error('child failed'); })).toThrow('child failed');
    expect(fs.existsSync(created)).toBe(false);
  });
  it('defaults to no storage outside the runner and rejects broad or unrelated targets', () => {
    expect(readTestUploadsDirectory(undefined)).toBeUndefined();
    for (const target of ['', '.', fs.realpathSync(tmpdir()), process.cwd(), path.join(fs.realpathSync(tmpdir()), 'other-uploads')]) {
      expect(() => readTestUploadsDirectory(target)).toThrow('dedicated temporary sandbox');
    }
  });
});

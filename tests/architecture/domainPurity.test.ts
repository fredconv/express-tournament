import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const DOMAIN = join(import.meta.dirname, '../../src/domain');

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

const IMPORT_PATTERN = /from\s+["']([^"']+)["']/g;
const FORBIDDEN =
  /\b(window|document|localStorage|sessionStorage|fetch|Date\.now|new Date|Math\.random|process\.)/;
const COMMENTS = /\/\/.*$|\/\*[\s\S]*?\*\//gm;

// AGENTS.md §4: the domain is pure and portable.
describe('src/domain purity', () => {
  const sources = files(DOMAIN).filter((f) => f.endsWith('.ts'));

  it('only imports relative modules or zod', () => {
    for (const file of sources) {
      const code = readFileSync(file, 'utf8');
      for (const match of code.matchAll(IMPORT_PATTERN)) {
        const spec = match[1] as string;
        const allowed = spec.startsWith('.') || spec === 'zod';
        expect(allowed, `${relative(DOMAIN, file)} imports ${spec}`).toBe(true);
      }
    }
  });

  it('does not touch the browser, the network, the clock or Math.random', () => {
    for (const file of sources) {
      const code = readFileSync(file, 'utf8').replace(COMMENTS, '');
      expect(FORBIDDEN.test(code), relative(DOMAIN, file)).toBe(false);
    }
  });
});

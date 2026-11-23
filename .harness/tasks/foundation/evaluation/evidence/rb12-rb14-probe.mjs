import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

// Run via vitest for TS imports instead — emit shell probe using vitest
console.log('use vitest probe');

import fs from 'node:fs';
import Module from 'node:module';
import ts from 'typescript';
const file = new URL('../src/lib/eliminatorias.ts', import.meta.url);
const mod = new Module(file.pathname);
mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, file.pathname);
export const { proposeBracket, persistableProposal, simulatedInput } = mod.exports;

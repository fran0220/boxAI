#!/usr/bin/env node
/** Report playground dict key usage across web/src (exclude playground-dict.ts itself). */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const src = fs.readFileSync(path.join(root, 'src/i18n/playground-dict.ts'), 'utf8')
const typeMatch = src.match(/export type PlaygroundDict = \{([\s\S]*?)\n\}/)
if (!typeMatch) {
  console.error('Could not parse PlaygroundDict type')
  process.exit(2)
}
const keys = [...typeMatch[1].matchAll(/^\s*(\w+):\s*string/gm)].map((m) => m[1])

function walk(dir, files = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, files)
    else if (/\.(tsx?|jsx?)$/.test(e.name) && !p.includes('playground-dict')) files.push(p)
  }
  return files
}

const code = walk(path.join(root, 'src'))
  .map((f) => fs.readFileSync(f, 'utf8'))
  .join('\n\n')

function isUsed(k) {
  if (new RegExp(`\\b(?:pg|getPg\\(\\))\\.${k}\\b`).test(code)) return true
  if (new RegExp(`(?:t|tPg)\\(\\s*['"\`]${k}['"\`]`).test(code)) return true
  if (code.includes(`['${k}']`) || code.includes(`["${k}"]`)) return true
  if (new RegExp(`\\bd\\.${k}\\b`).test(code)) return true
  if (new RegExp(`playgroundDicts\\.\\w+\\.${k}\\b`).test(code)) return true
  return false
}

const unused = keys.filter((k) => !isUsed(k))
const report = {
  total: keys.length,
  used: keys.length - unused.length,
  unused: unused.length,
  unusedKeys: unused,
}
console.log(JSON.stringify(report, null, 2))
process.exit(unused.length === 0 ? 0 : 1)

#!/usr/bin/env node
/**
 * Fail CI if source contains known broken-panel placeholders.
 * Catches accidental overwrites like a file whose body is only "PLACEHOLDER".
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = process.cwd()
const SCAN_DIRS = ['src', 'electron', 'functions']
const EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'])

/** Whole-file or dominant body is a stub */
const FORBIDDEN_WHOLE = [
  /^\s*PLACEHOLDER\s*$/i,
  /^\s*TODO\s*$/i,
  /^\s*FIXME\s*$/i,
]

/** Substring patterns that mean a panel was gutted */
const FORBIDDEN_SNIPPETS = [
  'Battlefield panel restoring',
  'panel restoring...',
  'Battlefield panel restoring...',
  'THIS FILE WAS OVERWRITTEN',
  '// PLACEHOLDER – restore me',
  'export default function Placeholder',
]

const SKIP_DIR = new Set(['node_modules', 'dist', 'release', '.git', 'coverage'])

function walk(dir, out = []) {
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return out
  }
  for (const name of entries) {
    if (SKIP_DIR.has(name)) continue
    const p = join(dir, name)
    let st
    try {
      st = statSync(p)
    } catch {
      continue
    }
    if (st.isDirectory()) walk(p, out)
    else {
      const i = name.lastIndexOf('.')
      const ext = i >= 0 ? name.slice(i) : ''
      if (EXT.has(ext)) out.push(p)
    }
  }
  return out
}

const files = SCAN_DIRS.flatMap((d) => walk(join(ROOT, d)))
const errors = []

for (const file of files) {
  let text
  try {
    text = readFileSync(file, 'utf8')
  } catch {
    continue
  }
  const rel = relative(ROOT, file)
  if (rel.includes('__tests__') || rel.includes('.test.')) continue

  for (const re of FORBIDDEN_WHOLE) {
    if (re.test(text)) {
      errors.push(`${rel}: whole-file placeholder (${re})`)
    }
  }
  const trimmed = text.trim()
  if (trimmed.length > 0 && trimmed.length < 40 && /placeholder/i.test(trimmed)) {
    errors.push(`${rel}: suspiciously short file with "placeholder" (${trimmed.length} chars)`)
  }

  for (const snip of FORBIDDEN_SNIPPETS) {
    if (text.includes(snip)) {
      errors.push(`${rel}: forbidden snippet ${JSON.stringify(snip)}`)
    }
  }
}

if (errors.length) {
  console.error('assert-no-placeholders FAILED:\n')
  for (const e of errors) console.error('  ·', e)
  process.exit(1)
}

console.log(`assert-no-placeholders OK (${files.length} files scanned)`)

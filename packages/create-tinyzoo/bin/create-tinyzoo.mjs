#!/usr/bin/env node
import * as clack from '@clack/prompts'
import { main } from '../src/create.mjs'

try {
  process.exitCode = await main(process.argv.slice(2), { ui: clack })
}
catch (err) {
  console.error(`✗ ${err instanceof Error ? err.message : err}`)
  process.exitCode = 1
}

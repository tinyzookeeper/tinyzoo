import { Readable } from 'node:stream'
import { describe, expect, it } from 'vitest'
import { dumpedByMajor, preambleFilter, toolMajor } from '../../packages/cms/cli/backup'

// The part of `tinyzoo restore` that lets a dump from a newer pg_dump load into an older server:
// no database or Postgres tools needed.

/** Run `chunks` through the filter; returns what came out and what was left out. */
async function filtered(chunks: (string | Buffer)[], known: (name: string) => boolean) {
  const filter = preambleFilter(known)
  const out: Buffer[] = []
  await new Promise<void>((resolve, reject) => {
    Readable.from(chunks.map((c) => Buffer.from(c))).pipe(filter).on('data', (d) => out.push(d)).on('end', resolve).on('error', reject)
  })
  return { text: Buffer.concat(out), dropped: filter.dropped }
}

// What pg_dump 17 / 18 write before the first CREATE (pg_dump 16 is the same without transaction_timeout).
const PREAMBLE = `--
-- PostgreSQL database dump
--

\\restrict KEY123

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;
`
const BODY = `
CREATE SCHEMA drizzle;

COPY public.t (a) FROM stdin;
SET transaction_timeout = 0;
\\.

\\unrestrict KEY123
`
const server16 = (name: string) => name !== 'transaction_timeout'

describe('preambleFilter', () => {
  it('leaves out SET transaction_timeout for a server that does not have it, and nothing else', async () => {
    const { text, dropped } = await filtered([PREAMBLE + BODY], server16)
    expect(dropped).toEqual(['transaction_timeout'])
    // Exactly the input without that one line.
    expect(text.toString()).toBe((PREAMBLE + BODY).replace('SET transaction_timeout = 0;\nSET client_encoding', 'SET client_encoding'))
  })

  it('does not touch the data after the preamble, even a line that looks like the setting', async () => {
    const { text } = await filtered([PREAMBLE + BODY], server16)
    expect(text.toString()).toContain('COPY public.t (a) FROM stdin;\nSET transaction_timeout = 0;\n\\.')
  })

  it('passes everything through when the server knows every setting (a 17+ server, or a dump from 16)', async () => {
    const { text, dropped } = await filtered([PREAMBLE + BODY], () => true)
    expect(dropped).toEqual([])
    expect(text.toString()).toBe(PREAMBLE + BODY)
  })

  it('gives the same result however the stream is cut into chunks (down to single bytes)', async () => {
    const whole = (await filtered([PREAMBLE + BODY], server16)).text.toString()
    const bytes = [...Buffer.from(PREAMBLE + BODY)].map((b) => Buffer.from([b]))
    const cut = await filtered(bytes, server16)
    expect(cut.text.toString()).toBe(whole)
    expect(cut.dropped).toEqual(['transaction_timeout'])
    const halves = await filtered([PREAMBLE.slice(0, 190), PREAMBLE.slice(190) + BODY.slice(0, 7), BODY.slice(7)], server16)
    expect(halves.text.toString()).toBe(whole)
  })

  it('keeps bytes that are not UTF-8 in the data exactly as they are', async () => {
    const data = Buffer.from([0x43, 0x4f, 0x50, 0x59, 0x20, 0xe9, 0xff, 0x00, 0x0a, 0x80, 0x0a])
    const { text } = await filtered([PREAMBLE, '\nCREATE TABLE x ();\n', data], server16)
    expect(text.subarray(text.length - data.length).equals(data)).toBe(true)
  })

  it('understands the forms of SET: lower case, TO, SESSION, and keeps a setting with a dot (an extension\'s)', async () => {
    const { text, dropped } = await filtered(['set Transaction_Timeout to 0;\nSET SESSION transaction_timeout = 5;\nSET app.some_setting = 1;\nSET TIME ZONE \'UTC\';\nCREATE TABLE t ();\n'], server16)
    expect(dropped).toEqual(['transaction_timeout', 'transaction_timeout'])
    expect(text.toString()).toBe("SET app.some_setting = 1;\nSET TIME ZONE 'UTC';\nCREATE TABLE t ();\n")
  })

  it('handles CRLF and a stream that ends inside the preamble', async () => {
    const { text, dropped } = await filtered(['SET transaction_timeout = 0;\r\nSET lock_timeout = 0;\r\nSET xmlopt'], server16)
    expect(dropped).toEqual(['transaction_timeout'])
    expect(text.toString()).toBe('SET lock_timeout = 0;\r\nSET xmlopt')
  })
})

describe('tool and dump versions', () => {
  it('reads the major version of a client tool', () => {
    expect(toolMajor('pg_restore (PostgreSQL) 17.9')).toBe(17)
    expect(toolMajor('pg_dump (PostgreSQL) 16.4 (Ubuntu 16.4-1.pgdg24.04+1)\n')).toBe(16)
    expect(toolMajor('psql (PostgreSQL) 18beta1')).toBe(18)
    expect(toolMajor('pg_restore (PostgreSQL) 19devel')).toBe(19)
    expect(toolMajor('something else')).toBeNull()
  })

  it('reads the pg_dump that made a dump from the pg_restore --list header', () => {
    const header = ';\n; Archive created at 2026-11-16 19:47:19 UTC\n;     dbname: x\n;     Dump Version: 1.16-0\n;     Dumped from database version: 16.11\n;     Dumped by pg_dump version: 17.9\n;\n'
    expect(dumpedByMajor(header)).toBe(17)
    expect(dumpedByMajor(';     Dumped by pg_dump version: 18.6 (Debian)')).toBe(18)
    expect(dumpedByMajor('no header')).toBeNull()
  })
})

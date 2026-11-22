import { describe, expect, it } from 'vitest'
import { chooseLogos, iconCandidates, logoRef, sniffImage } from '../../keeper/shared/logo'

// Keeper's logos: what a picture is, which icons a site's home page names, and whose logo a
// team or a workspace shows (keeper/shared/logo.ts).

const bytes = (...parts: (number[] | string)[]) => new Uint8Array(parts.flatMap((p) => (typeof p === 'string' ? [...new TextEncoder().encode(p)] : p)))

describe('sniffImage', () => {
  it('reads the type from the bytes', () => {
    expect(sniffImage(bytes([0x89], 'PNG\r\n'))).toBe('image/png')
    expect(sniffImage(bytes([0xFF, 0xD8, 0xFF, 0xE0]))).toBe('image/jpeg')
    expect(sniffImage(bytes('GIF89a'))).toBe('image/gif')
    expect(sniffImage(bytes('RIFF', [0, 0, 0, 0], 'WEBPVP8 '))).toBe('image/webp')
    expect(sniffImage(bytes([0, 0, 1, 0, 1, 0]))).toBe('image/x-icon')
  })

  it('knows an SVG after a declaration, comments and a doctype', () => {
    expect(sniffImage(bytes('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBe('image/svg+xml')
    expect(sniffImage(bytes('﻿<?xml version="1.0"?>\n<!-- made in a tool -->\n<!DOCTYPE svg>\n<svg viewBox="0 0 1 1"></svg>'))).toBe('image/svg+xml')
  })

  it('refuses what is not a picture', () => {
    expect(sniffImage(bytes('<!doctype html><html><body>Not found</body></html>'))).toBeNull()
    expect(sniffImage(bytes('<html><svg></svg></html>'))).toBeNull()
    expect(sniffImage(bytes('alert(1)'))).toBeNull()
    expect(sniffImage(new Uint8Array())).toBeNull()
  })
})

describe('iconCandidates', () => {
  const page = 'https://example.com/'

  it('puts the home-screen icon first (it fills the tile), then SVG, then the largest other icon, then /favicon.ico', () => {
    const html = `<head>
      <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
      <link rel="icon" type="image/png" sizes="96x96" href="/favicon-96.png">
      <link href="/favicon.svg" rel="icon" type="image/svg+xml">
      <link rel='apple-touch-icon' sizes="180x180" href='https://cdn.example.com/touch.png'>
      <link rel="stylesheet" href="/main.css">
    </head>`
    expect(iconCandidates(html, page)).toEqual([
      { url: 'https://cdn.example.com/touch.png', fit: 'fill' },
      { url: 'https://example.com/favicon.svg', fit: 'pad' },
      { url: 'https://example.com/favicon-96.png', fit: 'pad' },
      { url: 'https://example.com/favicon-32.png', fit: 'pad' },
      { url: 'https://example.com/favicon.ico', fit: 'pad' },
    ])
  })

  it('reads relative addresses against the page, skips other schemes, and never lists one twice', () => {
    const html = '<link rel="shortcut icon" href="favicon.ico"><link rel="icon" href="data:image/png;base64,AAAA"><link rel="icon" href="javascript:alert(1)">'
    expect(iconCandidates(html, 'https://example.com/cs/')).toEqual([
      { url: 'https://example.com/cs/favicon.ico', fit: 'pad' },
      { url: 'https://example.com/favicon.ico', fit: 'pad' },
    ])
    expect(iconCandidates('<link rel="icon" href="/favicon.ico">', page)).toEqual([{ url: 'https://example.com/favicon.ico', fit: 'pad' }])
  })

  it('falls back to /favicon.ico for a page without icons', () => {
    expect(iconCandidates('', page)).toEqual([{ url: 'https://example.com/favicon.ico', fit: 'pad' }])
  })
})

describe('chooseLogos', () => {
  const ws = (id: string, logoHash: string | null = null) => ({ id, logoHash })
  const team = (id: string, workspaceId: string, name: string, isDefault = false, logoHash: string | null = null) => ({ id, workspaceId, name, isDefault, logoHash })

  it('a team shows its own upload, else its first site by name that has a logo', () => {
    const { teams } = chooseLogos({
      workspaces: [ws('w')],
      teams: [team('a', 'w', 'Dance', true), team('b', 'w', 'Grand', false, 'own'), team('c', 'w', 'Empty')],
      sites: [
        { teamId: 'a', name: 'Zebra', logoHash: 'z' },
        { teamId: 'a', name: 'Aardvark', logoHash: null },
        { teamId: 'a', name: 'Beaver', logoHash: 'b' },
        { teamId: 'b', name: 'Grand', logoHash: 'g' },
      ],
    })
    expect(teams.get('a')).toEqual({ hash: 'b', from: { kind: 'site', name: 'Beaver' } })
    expect(teams.get('b')).toEqual({ hash: 'own' })
    expect(teams.has('c')).toBe(false)
  })

  it('a workspace shows its own upload, else its default team\'s, else its first team\'s by name', () => {
    const { workspaces } = chooseLogos({
      workspaces: [ws('own', 'mine'), ws('dflt'), ws('first'), ws('none')],
      teams: [
        team('d1', 'dflt', 'General', true, 'team-own'), team('d2', 'dflt', 'Another', false, 'other'),
        team('f1', 'first', 'General', true), team('f2', 'first', 'Zoo'), team('f3', 'first', 'Bistro'),
        team('n1', 'none', 'General', true),
      ],
      sites: [{ teamId: 'f2', name: 'Zoo site', logoHash: 'zoo' }, { teamId: 'f3', name: 'Bistro site', logoHash: 'bistro' }],
    })
    expect(workspaces.get('own')).toEqual({ hash: 'mine' })
    expect(workspaces.get('dflt')).toEqual({ hash: 'team-own', from: { kind: 'team', name: 'General' } })
    // A logo the team borrowed keeps naming its site.
    expect(workspaces.get('first')).toEqual({ hash: 'bistro', from: { kind: 'site', name: 'Bistro site' } })
    expect(workspaces.has('none')).toBe(false)
  })
})

describe('logoRef', () => {
  it('is the content address with its fit, or null', () => {
    expect(logoRef('abc', 'fill')).toEqual({ src: '/api/logos/abc', fit: 'fill' })
    expect(logoRef('abc', 'other')).toEqual({ src: '/api/logos/abc', fit: 'pad' })
    expect(logoRef(null, 'fill')).toBeNull()
  })
})

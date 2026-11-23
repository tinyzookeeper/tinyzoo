/**
 * A WebSocket and its site (multi-tenant mode).
 *
 * An upgrade does not pass through the request wrapper (plugins/cms-0-site.ts), and a
 * socket's later hooks are called from socket events, which carry no site. So a socket
 * finds its site itself, once, at the upgrade: from the host, as a request does. The
 * site's id is kept on `request.context`, which the peer then carries as `peer.context`
 * (next to the account, see admitAdminSocket), and every later hook looks the site up by
 * that id and runs inside it.
 *
 * A host that is no site's own (unknown, or an alias: pages redirect, a socket has nothing
 * to follow) and a paused site get no socket. A site that left the directory since has
 * none either: its hooks are dropped and the socket is closed. What the site kept for the
 * socket was released when the site was unloaded (the `dispose` of its per-site values).
 *
 * Single mode: the hooks are returned as they are.
 */
interface SocketHooks {
  upgrade?: (request: any) => any
  open?: (peer: any) => any
  message?: (peer: any, message: any) => any
  close?: (peer: any, details: any) => any
  error?: (peer: any, error: any) => any
}

export function cmsSocketHooksInSite<T extends SocketHooks>(hooks: T): T {
  if (!cmsIsMultiTenant()) return hooks
  /** The socket's site as the directory has it now, or null. */
  const siteOf = (peer: any): CmsSite | null => {
    const id = peer?.context?.cmsSite
    return typeof id === 'string' ? cmsSiteById(id) : null
  }
  const close = (peer: any) => {
    try { peer?.close?.(1001, 'This website is not served here any more') }
    catch { /* already closing */ }
  }
  /** `open` and `message`: only for a site that is still served. */
  const served = <A>(hook: ((peer: any, arg: A) => any) | undefined) => (peer: any, arg: A) => {
    const site = siteOf(peer)
    if (!site || site.state === 'paused') return close(peer)
    return runInCmsSite(site, () => hook?.(peer, arg))
  }
  /** `close` and `error`: the site tidies up after its socket while it is in the directory, paused or not. */
  const known = <A>(hook: ((peer: any, arg: A) => any) | undefined) => (peer: any, arg: A) => {
    const site = siteOf(peer)
    if (!site) return
    return runInCmsSite(site, () => hook?.(peer, arg))
  }
  return {
    ...hooks,
    upgrade(request: any) {
      const host = cmsRequestHost({ host: request.headers?.get?.('host'), forwarded: request.headers?.get?.('x-forwarded-host') })
      const found = host ? cmsSiteForHost(host) : null
      if (!found || !found.main) throw new Response('No website at this address', { status: 404 })
      const site = found.site
      if (site.state === 'paused') throw new Response('This website is paused', { status: 503, headers: { 'retry-after': '300' } })
      request.context.cmsSite = site.id
      return runInCmsSite(site, () => {
        // As the request wrapper does: a socket may be the first use of the site on this instance.
        ensureCmsSiteStarted()
        return hooks.upgrade?.(request)
      })
    },
    open: served(hooks.open),
    message: served(hooks.message),
    close: known(hooks.close),
    error: known(hooks.error),
  } as T
}

// Node-only development setting; never exposed as a browser API origin.
export function proxyTarget(value: string | undefined): string | undefined {
  if (value === undefined) return undefined
  try {
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
      !url.hostname || url.hostname.includes('*') || url.pathname !== '/' || url.search || url.hash ||
      value.trim() !== value || /[\\\s]/u.test(value) ||
      (value !== url.origin && value !== `${url.origin}/`)) throw new Error()
    return url.origin
  } catch { throw new Error('API_DEV_PROXY_TARGET must be an HTTP(S) origin without credentials, path, query or fragment.') }
}

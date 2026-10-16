// Only fixed browser error codes may reach smoke logs; never raw error text.
const codes = new Set([
  'ERR_ABORTED', 'ERR_FAILED', 'ERR_TIMED_OUT', 'ERR_EMPTY_RESPONSE',
  'ERR_CONNECTION_RESET', 'ERR_CONNECTION_CLOSED', 'ERR_CONNECTION_REFUSED',
  'ERR_HTTP2_PROTOCOL_ERROR', 'ERR_HTTP_RESPONSE_CODE_FAILURE',
  'ERR_CERT_AUTHORITY_INVALID', 'ERR_NETWORK_CHANGED', 'ERR_NAME_NOT_RESOLVED',
])
export function networkFailureCode(text) {
  const code = typeof text === 'string' && text.startsWith('net::') ? text.slice(5) : ''
  return codes.has(code) ? code : 'UNKNOWN_NETWORK_FAILURE'
}

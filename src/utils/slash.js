export function removeTailingSlash( path ) {
  return path.replace( /\/+$/, '' )
}

export function ensureLeadingSlash( path ) {
  return path.replace( /^\/*/, '/' )
}

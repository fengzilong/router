function getHash( url = location.href ) {
  const index = url.indexOf( '#' )

  if ( ~index ) {
    const hash = url.slice( index + 1 ).split( '?' )[ 0 ]
    return hash ? decodeURIComponent( hash ) : ''
  }

  return ''
}

export default getHash

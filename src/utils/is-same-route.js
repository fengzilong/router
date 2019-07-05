export default ( a, b ) => stringify( a ) === stringify( b )

function stringify( route ) {
  if ( !route ) {
    return ''
  }

  return JSON.stringify( [
    route.segment,
    route.query,
    route.params,
  ] )
}

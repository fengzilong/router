import getHash from './getHash'

let _
let observing = false
let oldURL = null

export function observe( fn ) {
  _ = e => {
		// save for back
    oldURL = e.oldURL

    fn( {
      newSegment: getHash( e.newURL ),
      oldSegment: getHash( e.oldURL ),
      e
    } )
  }
  window.addEventListener( 'hashchange', _ )
  observing = true
}

export function unobserve() {
  window.removeEventListener( 'hashchange', _ )
  observing = false
}

export function isObserving() {
  return observing
}

export function apply( fn ) {
  return fn( { newSegment: getHash() } )
}

export function back() {
  if ( oldURL ) {
    location.hash = oldURL.split( '#' )[ 1 ]
  }
}

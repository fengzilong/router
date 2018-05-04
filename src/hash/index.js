import getHash from './getHash'

let _
let observing = false
let oldURL = null
let newURL = null

export function observe( fn ) {
	_ = ( e ) => {
		// save for back
		oldURL = e.oldURL
		newURL = e.newURL

		fn( {
			newSegment: getHash( e.newURL ),
			oldSegment: getHash( e.oldURL ),
			e: e
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
	// save for back
	oldURL = null
	newURL = location.href

	return fn( { newSegment: getHash() } )
}

export function back() {
	if ( oldURL ) {
		location.hash = oldURL.split( '#' )[ 1 ]
	}
}

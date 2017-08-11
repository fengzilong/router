import getHash from './getHash'

let _

export function observe( fn ) {
	_ = ( e ) => {
		fn( {
			newSegment: getHash( e.newURL ),
			oldSegment: getHash( e.oldURL ),
			e: e
		} )
	}
	window.addEventListener( 'hashchange', _ )
}

export function unobserve() {
	window.removeEventListener( 'hashchange', _ )
}

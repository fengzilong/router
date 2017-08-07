let _;

exports.observe = function ( fn ) {
	_ = ( e ) => {
		fn( {
			newSegment: getHash( e.newURL ),
			oldSegment: getHash( e.oldURL ),
			e: e
		} )
	}
	window.addEventListener( 'hashchange', _ )
}

exports.unobserve = function () {
	window.removeEventListener( 'hashchange', _ )
}

function getHash( url ) {
	const index = url.indexOf( '#' )
	if ( ~index ) {
		return url.slice( index + 1 )
	} else {
		return ''
	}
}

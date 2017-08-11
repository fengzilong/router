function getHash( url = location.href ) {
	const index = url.indexOf( '#' )
	if ( ~index ) {
		return url.slice( index + 1 )
	} else {
		return ''
	}
}

export default getHash;

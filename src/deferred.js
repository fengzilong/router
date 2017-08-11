export default function () {
	const p = {}
	p.promise = new Promise( function ( resolve, reject ) {
		p.resolve = resolve
		p.reject = reject
	} )
	return p
}

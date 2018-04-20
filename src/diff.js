export default diff

function diff( from, to ) {
	const fromParents = from ? parents( from ) : []
	const toParents = to ? parents( to ) : []

	let crossRouter = null;
	for ( let i = 0, len = fromParents.length; i < len; i++ ) {
		const fromRouter = fromParents[ i ]
		const toRouter = toParents[ i ]
		if ( fromRouter && toRouter && ( fromRouter === toRouter ) ) {
			crossRouter = fromRouter
		} else {
			break
		}
	}

	const unmounts = fromParents.slice(
		~fromParents.indexOf( crossRouter )
			? fromParents.indexOf( crossRouter ) + 1
			: 0
	)
	const mounts = toParents.slice(
		~toParents.indexOf( crossRouter )
			? toParents.indexOf( crossRouter ) + 1
			: 0
	)

	return {
		ancestors: crossRouter ? parents( crossRouter ) : [],
		unmounts,
		mounts,
	};
}

// reutrn an array contains self and parents
function parents( router ) {
	return [ ...( router.traces || [] ) ];
}

export {
	requestUnmount,
	requestMount,
	unmount,
	mount,
	update
}

// ===================== //
// lifecycles for router //
// ===================== //

async function requestUnmount( targets ) {
	let count = 0

	function createNext( target, resolve ) {
		return function next( result ) {
			if ( result !== false ) {
				resolve()
			}
		}
	}

	for ( const target of targets ) {
		if ( typeof target.options.beforeLeave === 'function' ) {
			try {
				const deferred = createDeferred()
				const returned = target.options.beforeLeave( {
					next: createNext( target, deferred.resolve )
				} )
				await Promise.race( [ deferred.promise, returned ] )
				count++
			} catch( e ) {}
		} else {
			count++
		}
	}

	return count === targets.length
}

async function requestMount( targets ) {
	let count = 0

	function createNext( target, resolve ) {
		return function next( result ) {
			if ( result !== false ) {
				resolve()
			}

			if ( typeof result === 'function' ) {
				target._delayedCallbacks.push( result )
			}
		}
	}

	for ( const target of targets ) {
		// reset beforeEnterCallbacks
		target._delayedCallbacks = []

		if ( typeof target.options.beforeEnter === 'function' ) {
			try {
				const deferred = createDeferred()
				const returned = target.options.beforeEnter( {
					next: createNext( target, deferred.resolve )
				} )
				await Promise.race( [ deferred.promise, returned ] )
				count++
			} catch( e ) {}
		} else {
			count++
		}
	}

	return count === targets.length
}

async function unmount( targets ) {
	for ( const target of targets ) {
		if ( typeof target.options.leave === 'function' ) {
			await target.options.leave()
		}
	}
}

async function mount( targets ) {
	for ( const target of targets ) {
		// execute delayed callbacks
		const callbacks = target._delayedCallbacks || []
		for ( const callback of callbacks ) {
			if ( typeof callback === 'function' ) {
				callback()
			}
		}

		if ( typeof target.options.enter === 'function' ) {
			await target.options.enter()
		}
	}
}

async function update( targets ) {
	for ( const target of targets ) {
		if ( typeof target.options.update === 'function' ) {
			await target.options.update()
		}
	}
}

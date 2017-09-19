import dush from 'dush'
import pathToRegexp from 'path-to-regexp'
import memo from './utils/memo'
import hierarchy from './hierarchy'
import { observe, unobserve } from './hash/observe'
import apply from './hash/apply'
import createDeferred from './deferred'
import { requestUnmount, requestMount, mount, unmount, update } from './lifecycle'

let counter = 0
const running = []

export default function createRouter( options = {}, globalOptions = {} ) {
	const router = dush()

	// +recursiveInvoke && +recursive && +append && +children && +parent
	router.use( hierarchy() )

	router.options = options
	router.isRoot = false

	router.start = function () {
		const self = this;

		// reset counter
		counter = 0
		// stop running routers
		running.forEach( r => r.stop() )
		running.push( router )

		// for later stopping tracing parents upper than this
		this.isRoot = true

		this.recursiveInvoke( 'activate' )

		const candidates = []

		// collect router and all subrouters as candidates
		this.recursive( function ( router ) {
			candidates.push( router )
		} )

		// memo for parse
		const parse = memo( createParse( candidates ) )

		async function observeCallback( { newSegment, oldSegment } ) {
			const to = parse( newSegment )
			const from = parse( oldSegment )

			if ( !to ) {
				return self.emit( 'notfound' )
			}

			const { ancestors, unmounts, mounts } = diff( { from, to } )

			if (
				await requestUnmount( unmounts ) &&
				await requestMount( mounts )
			) {
				await unmount( unmounts )
				await update( ancestors )
				await mount( mounts )
			}
		}

		observe( observeCallback )
		apply( observeCallback )
	}

	router.stop = function () {
		unobserve()
	}

	router.activate = function () {
		// record depth, for later regexp match comparing
		if ( this.isRoot ) {
			this.depth = 0
		} else if ( this.parent && ( typeof this.parent.depth === 'number' ) ) {
			this.depth = this.parent.depth + 1
		}

		if ( !options.name ) {
			this.name = `anonymous${ counter++ }`
		}

		this.keys = []
		this.fullName = this._getFullName()
		this.regexp = pathToRegexp( this._getFullPath(), this.keys )
		this.routerPath = this._trace()
	}

	router.deactivate = function () {
		this.isRoot = false
		this.depth = null
		this.fullName = null
		this.regexp = null
		this.routerPath = null
	}

	router._getFullName = function () {
		if ( this.isRoot ) {
			return this.name
		} else if ( this.parent ) {
			return this.parent._getFullName() + '.' + this.name
		}
	}

	router._getFullPath = function () {
		if ( this.isRoot ) {
			return options.path
		} else if ( this.parent ) {
			return this.parent._getFullPath() + options.path
		}
	}

	router._trace = function () {
		const paths = []

		let parent = this
		while ( parent ) {
			paths.unshift( parent )
			if ( parent.isRoot ) {
				break
			}
			parent = parent.parent
		}

		return paths
	}

	return router
}

function createParse( candidates = [] ) {
	const match = createMatch( candidates )

	return function ( segment ) {
		const matched = match( segment )

		if ( !matched ) {
			return null
		}

		const params = getParams( {
			keys: matched.keys,
			regexp: matched.regexp,
			segment: segment,
		} )

		return {
			...matched,
			...{ params }
		}
	}
}

function createMatch( candidates = [] ) {
	return function ( segment ) {
		const matched = candidates.filter( candidate => {
			return candidate.regexp.test( segment )
		} )

		// find the deepest candidate by .depth
		let maxDepth = 0
		let bestMatched = matched[ 0 ]
		matched.forEach( function ( m ) {
			if ( m.depth > maxDepth ) {
				maxDepth = m.depth
				bestMatched = m
			}
		} )

		return bestMatched
	}
}

function getParams( { segment, regexp, keys } ) {
	const collected = {}
	const result = regexp.exec( segment )

	for ( let i = 0, len = keys.length; i < len; i++ ) {
		const key = keys[ i ]
		const name = key.name
		const value = result[ i + 1 ]

		if ( !value ) {
			continue
		}

		collected[ name ] = decodeURIComponent( value )

		if ( key.repeat ) {
			collected[ name ] = collected[ name ].split( key.delimiter )
		}
	}

	return collected
}

function diff( { from, to } ) {
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
	return [ ...( router.routerPath || [] ) ];
}

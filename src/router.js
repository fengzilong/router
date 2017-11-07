import dush from 'dush'
import pathToRegexp from 'path-to-regexp'
import memo from './utils/memo'
import hierarchy from './utils/hierarchy'
import { observe, unobserve } from './hash/observe'
import apply from './hash/apply'
import diff from './diff'
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

			const { ancestors, unmounts, mounts } = diff( from, to )

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
			...matched,
			...{ segment }
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

import dush from 'dush'
import pathToRegexp from 'path-to-regexp'
import memo from './utils/memo'
import hierarchy from './hierarchy'
import { observe, unobserve } from './hash/observe'

let counter = 0
const running = []

export default function createRouter( options = {}, globalOptions = {} ) {
	const router = dush()

	// +recursiveInvoke && +recursive && +append && +children && +parent
	router.use( hierarchy() )

	router.options = options

	router.start = function () {
		// reset counter
		counter = 0
		// stop running routers
		running.forEach( v => v.stop() )
		running.push( router )

		this.recursiveInvoke( 'activate' )

		const candidates = []

		// collect data from current router and subrouters
		this.recursive( function ( router ) {
			candidates.push( {
				options: options,
				routerPath: router._routerPath,
				regexp: router._regexp,
				name: router.name,
				fullName: router._fullName,
				depth: router._depth,
				keys: router._keys,
			} )
		} )

		const parse = memo( createParse( candidates ) )

		observe( ( { newSegment, oldSegment } ) => {
			const result = parse( newSegment )
			const oldResult = parse( oldSegment )

			if ( !result ) {
				return this.emit( 'notfound' )
			}

			console.log( result )

			// phase
			callHook( result, 'beforeEnter' )
			callHook( result, 'enter' )
			callHook( result, 'update' )
			callHook( result, 'beforeLeave' )
		} )
	}

	router.stop = function () {
		unobserve()
	}

	router.activate = function () {
		// record depth, for later regexp match comparing
		if ( this.parent ) {
			this._depth = this.parent._depth + 1
		} else {
			this._depth = 0
		}

		if ( !options.name ) {
			this.name = `anonymous${ counter++ }`
		}

		this._keys = []
		this._fullName = this._getFullName()
		this._regexp = pathToRegexp( this._getFullPath(), this._keys )
		this._routerPath = this._trace()
	}

	router.deactivate = function () {
		this._depth = 0
		this._fullName = null
		this._regexp = null
		this._routerPath = null
	}

	router._getFullName = function () {
		if ( this.parent ) {
			return this.parent._getFullName() + '.' + this.name
		} else {
			return this.name
		}
	}

	router._getFullPath = function () {
		if ( this.parent ) {
			return this.parent._getFullPath() + options.path
		} else {
			return options.path
		}
	}

	router._trace = function () {
		const paths = [ this ]

		let parent = this
		while ( parent = parent.parent ) {
			paths.unshift( parent )
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
			return
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

		// find max depth
		let maxDepth = 0
		let bestMatched = matched[ 0 ]
		matched.forEach( function ( m ) {
			if ( m._depth > maxDepth ) {
				maxDepth = m._depth
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

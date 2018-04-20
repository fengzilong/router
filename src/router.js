import dush from 'dush'
import pathToRegexp from 'path-to-regexp'
import { removeTailingSlash, ensureLeadingSlash } from './utils/slash'
import hierarchy from './hierarchy'
import { observe, unobserve } from './hash/observe'
import apply from './hash/apply'
import diff from './diff'
import { requestUnmount, requestMount, mount, unmount, update } from './lifecycle'

let counter = 0
const running = []

export default function createRouter( options = {}, globalOptions = {} ) {
	const router = dush()

	// +recursive && +append && +children && +parent
	router.use( hierarchy() )

	router.options = options
	router.isRoot = false

	router.start = function () {
		const self = this

		// reset counter
		counter = 0
		// stop running routers
		running.forEach( r => r.stop() )
		running.push( router )

		// for later stopping tracing parents upper than this
		this.isRoot = true

		const candidates = []

		// collect router and all subrouters as candidates
		this.recursive( function ( router ) {
			router.activate()
			candidates.push( router )
		} )

		const parse = createParse( candidates )

		async function observeCallback( { newSegment, oldSegment } ) {
			const to = parse( newSegment )
			const from = parse( oldSegment )

			if ( !to ) {
				return self.emit( 'notfound' )
			}

			const extra = {
				params: to.params
			}

			const { ancestors, unmounts, mounts } = diff( from, to )

			if (
				await requestUnmount( unmounts, extra ) &&
				await requestMount( mounts, extra )
			) {
				await unmount( unmounts, extra )
				await update( ancestors, extra )
				await mount( mounts, extra )
			}
		}

		observe( observeCallback )
		apply( observeCallback )
	}

	router.stop = function () {
		unobserve()
		this.recursive( function ( router ) {
			router.deactivate()
		} )
	}

	router.activate = function () {
		// record depth, for later regexp match comparing
		if ( this.isRoot ) {
			this.depth = 0
		} else if ( this.parent && ( typeof this.parent.depth === 'number' ) ) {
			this.depth = this.parent.depth + 1
		}

		if ( !this.options.name ) {
			this.name = `anonymous${ counter++ }`
		}

		this.keys = []
		this.fullName = this._getFullName()
		this.regexp = pathToRegexp( this._getFullPath(), this.keys )
		this.traces = this._trace()
		this.recursive( ins => {
			ins.active = true
		} )
	}

	router.deactivate = function () {
		this.isRoot = false
		this.depth = null
		this.fullName = null
		this.regexp = null
		this.traces = null
		this.recursive( ins => {
			ins.active = false
		} )
	}

	// remove from tree
	router.delete = function () {
		this.children = []

		const parent = this.parent
		const children = parent && parent.children
		if ( parent && children ) {
			const index = children.indexOf( this )
			if ( ~index ) {
				children.splice( index, 1 )
			}
		}
		this.parent = null
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
			return this.options.path
		} else if ( this.parent ) {
			return removeTailingSlash( this.parent._getFullPath() ) +
				ensureLeadingSlash( this.options.path )
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

		// use best-matched router to match params,
		// regexp of standalone router is not accurate against full path
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
		const matches = candidates.filter( candidate => {
			return candidate.active ? candidate.regexp.test( segment ) : false
		} )

		// find the deepest candidate by .depth
		let maxDepth = 0
		let bestMatched = matches[ 0 ]
		matches.forEach( function ( m ) {
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

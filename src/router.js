import dush from 'dush'
import pathToRegexp from 'path-to-regexp'
import { removeTailingSlash, ensureLeadingSlash } from './utils/slash'
import hierarchy from './hierarchy'
import { observe, unobserve, apply, isObserving, back } from './hash/index'
import diff from './diff'
import {
  requestUnmount, requestMount, mount, unmount, update
} from './lifecycle'

let counter = 0
const running = []

// for marking global router changes
let _mark = 0

export default function createRouter( options = {}, globalOptions = {} ) { // eslint-disable-line
  const router = dush()

	// +recursive && +append && +children && +parent
  router.use( hierarchy() )

  router.options = options
  router.isRoot = false
  router.beforeEachHooks = []
  router.afterEachHooks = []

	// for marking changes caused by append and delete
  router.on( 'append', count )
  router.on( 'delete', count )

  function count() {
    _mark = _mark + 1
  }

	// can not gen fullName before start, because no root is specified
  router.start = function () {
    const self = this

		// reset counter
    counter = 0
		// stop running routers
    running.forEach( r => r.stop() )
    running.push( router )

		// for later stopping tracing parents upper than this
    this.isRoot = true

    let candidates = []

		// collect router and all subrouters as candidates
    this.recursive( function ( router ) {
      router.init()
      candidates.push( router )
    } )

    let parse = createParse( candidates )

    async function observeCallback( { newSegment, oldSegment } ) {
      const beforeMark = _mark
      let isBeforeEachRejected = false

      const beforeEachHooks = self.beforeEachHooks || []
      for ( let i = 0, len = beforeEachHooks.length; i < len; i++ ) {
        const hook = beforeEachHooks[ i ]
        try {
          let result = hook.call( self )
          if ( result instanceof Promise ) {
            result = await result
          }

					// if beforeEach is rejected, restore old url
          if ( result === false ) {
            isBeforeEachRejected = true
          }
        } catch ( e ) {
          isBeforeEachRejected = true
          console.log( e )
        }
      }

      const afterMark = _mark

			// if change happens, create new parse
      if ( afterMark > beforeMark ) {
        candidates = []

        self.recursive( function ( router ) {
          candidates.push( router )
        } )

        parse = createParse( candidates )
      }

      if ( isBeforeEachRejected ) {
        unobserve()
				// e.oldURL is not available if use `apply`
        back()
        observe( observeCallback )
        return
      }

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

      const afterEachHooks = self.afterEachHooks || []
      for ( let i = 0, len = afterEachHooks.length; i < len; i++ ) {
        const hook = afterEachHooks[ i ]
        try {
          await hook.call( self )
        } catch ( e ) {
          console.log( e )
        }
      }
    }

		// save for apply, unobserve and re-observe
    this._observeCallback = observeCallback

    this.observe()
    this.apply()
  }

  router.apply = function () {
    if ( !this._observeCallback ) {
      throw new Error( 'Expect call `start` before `apply`' )
    }
    apply( this._observeCallback )
  }

  router.unobserve = unobserve

  router.observe = function () {
    if ( !this._observeCallback ) {
      throw new Error( 'Expect call `start` before `observe`' )
    }

    observe( this._observeCallback )
  }

  router.isObserving = isObserving

  router.stop = function () {
    unobserve()
    this.recursive( function ( router ) {
      router.deactivate()
    } )
  }

	// find by name
  router.find = function ( fullName ) {
    let found

    this.recursive( ins => {
      if ( ins.fullName === fullName ) {
        found = ins
      }
    } )

    return found
  }

	// before parse segment, we can add new router dynamically here
  router.beforeEach = function ( hook ) {
    this.beforeEachHooks.push( hook )
  }

  router.afterEach = function ( hook ) {
    this.afterEachHooks.push( hook )
  }

  router.activate = function () {
    this.init()

    this.recursive( ins => {
      ins.active = true
    } )

    this.emit( 'activate' )
  }

  router.init = function () {
		// mark self as active is enough, outside recursive will recursive all
    this.active = true
		// record depth, for later regexp match comparing
    if ( this.isRoot ) {
      this.depth = 0
    } else if ( this.parent && ( typeof this.parent.depth === 'number' ) ) {
      this.depth = this.parent.depth + 1
    }

    this.name = this.options.name || `anonymous${ counter++ }`

    this.keys = []
    this.fullName = this._getFullName()
    this.regexp = pathToRegexp( this._getFullPath(), this.keys )
    this.traces = this._trace()
  }

  router.deactivate = function () {
    this.recursive( ins => {
      ins.active = false
    } )
    this.emit( 'deactivate' )
  }

	// remove from tree
  router.delete = function () {
    this.isRoot = false
    this.depth = null
    this.fullName = null
    this.regexp = null
    this.traces = null
    this._observeCallback = null

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

    this.emit( 'delete' )
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

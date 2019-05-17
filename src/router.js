import dush from 'dush'
import qs from 'query-string'
import pathToRegexp from 'path-to-regexp'
import { removeTailingSlash, ensureLeadingSlash, removeLeadingSlash } from './utils/slash'
import hierarchy from './hierarchy'
import hash from './mode/hash'
import history from './mode/history'
import diff from './diff'
import {
  requestUnmount, requestMount, mount, unmount, update
} from './lifecycle'

// implement { observe, unobserve, apply, isObserving, back, getSegment, push, replace }
const modes = {
  hash,
  // history,
}

let counter = 0
const running = []

// for marking global router changes
let _mark = 0

export default function createRouter( options = {}, globalOptions = {} ) { // eslint-disable-line
  const router = dush()

  // +recursive && +append && +children && +parent
  router.use( hierarchy() )

  router.options = options
  router.globalOptions = globalOptions
  router.isRoot = false
  router.beforeEachHooks = []
  router.afterEachHooks = []

  // mark changes by append and delete
  router.on( 'append', count )
  router.on( 'delete', count )

  function count() {
    _mark = _mark + 1
  }

  router.prepare = function () {
    // reset counter
    counter = 0
    // boundary for stopping tracing
    this.isRoot = true

    const candidates = []

    // collect router and all sub-routers as candidates
    this.recursive( function ( router ) {
      router.init()
      candidates.push( router )
    } )

    this.parse = createParse( candidates )
  }

  router.start = function () {
    const self = this

    // stop old running routers
    running.forEach( r => r.stop() )
    running.push( router )

    if ( !this.parse ) {
      this.prepare()
    }

    const mode = globalOptions.mode || 'hash'
    this.observer = new modes[ mode ]( globalOptions )
    this.observe()
    this.apply()
  }

  async function _observeCallback( { newSegment, oldSegment, inMemory, ifAllowed } ) {
    const beforeMark = _mark
    let isBeforeEachRejected = false
    const stopCallbacks = []

    const stop = function ( callback ) {
      isBeforeEachRejected = true
      // cb will executed after backing old url
      if ( typeof callback === 'function' ) {
        stopCallbacks.push( callback )
      }
    }

    const beforeEachHooks = this.beforeEachHooks || []

    for ( let i = 0, len = beforeEachHooks.length; i < len; i++ ) {
      const hook = beforeEachHooks[ i ]
      try {
        let result = await hook.call( this, {
          stop: stop
        } )
      } catch ( e ) {
        console.log( e )
      }
    }

    const afterMark = _mark

    // if change happens, create new parse
    if ( afterMark > beforeMark ) {
      const candidates = []

      this.recursive( router => {
        candidates.push( router )
      } )

      this.parse = createParse( candidates )
    }

    if ( isBeforeEachRejected ) {
      this.unobserve()
      // e.oldURL is not available if use `apply`
      this.observer.back()
      this.observe()
      stopCallbacks.forEach( callback => callback() )
      return
    }

    const to = this.parse( newSegment )
    const from = this.parse( oldSegment )

    if ( !to ) {
      return this.emit( 'notfound' )
    }

    const extra = {
      from,
      to,
      params: to.params,
    }

    const { ancestors, unmounts, mounts } = diff( from, to )

    if (
      await requestUnmount( unmounts, extra ) &&
      await requestMount( mounts, extra )
    ) {
      if ( ifAllowed ) {
        await ifAllowed()
      }
      await unmount( unmounts, extra )
      await update( ancestors, extra )
      await mount( mounts, extra )
    }

    const afterEachHooks = this.afterEachHooks || []
    for ( let i = 0, len = afterEachHooks.length; i < len; i++ ) {
      const hook = afterEachHooks[ i ]
      try {
        await hook.call( this )
      } catch ( e ) {
        console.log( e )
      }
    }
  }

  router._observeCallback = _observeCallback.bind( router )

  router.apply = function () {
    if ( !this._observeCallback ) {
      throw new Error( 'Expect call `start` before `apply`' )
    }
    this.observer.apply( this._observeCallback )
  }

  router.observe = function () {
    this.observer.observe( this._observeCallback )
  }

  router.unobserve = function () {
    this.observer.unobserve()
  }

  router.isObserving = function () {
    return this.observer.isObserving()
  }

  router.stop = function () {
    this.unobserve()
    this.recursive( function ( router ) {
      router.deactivate()
    } )
  }

  async function routeTo( route = '', fn ) {
    const pathPrefix = this.globalOptions.pathPrefix || ''

    let path = '/'

    if ( route && ( typeof route === 'object' ) ) {
      const { name, params = {}, query } = route

      const target = this.find( name )

      if ( target ) {
        if ( !target.toPath ) {
          this.prepare()
        }

        path = target.toPath( params )

        if ( query ) {
          path = path + '?' +qs.stringify( query )
        }

        path = ensureLeadingSlash( path )
      }
    } else if ( typeof route === 'string' ) {
      path = path + removeLeadingSlash( route )
    }

    await this._observeCallback( {
      oldSegment: this.observer.getSegment(),
      newSegment: path,
      inMemory: true,
      ifAllowed: () => {
        // check old segment match
        this.unobserve()

        let finalPath = path

        if ( this.globalOptions.mode === 'history' ) {
          finalPath = removeTailingSlash( ensureLeadingSlash( pathPrefix ) ) +
            '/' +
            removeLeadingSlash( path )
        }

        fn( finalPath )

        this.observe()
      },
    } )
  }

  router.push = function ( route ) {
    return routeTo.call( this, route, path => {
      this.observer.push( path )
    } )
  }

  router.replace = function ( route ) {
    return routeTo.call( this, route, path => {
      this.observer.replace( path )
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
    // save depth, for comparing match
    if ( this.isRoot ) {
      this.depth = 0
    } else if ( this.parent && ( typeof this.parent.depth === 'number' ) ) {
      this.depth = this.parent.depth + 1
    }

    this.name = this.options.name || `anonymous${ counter++ }`
    this.fullName = this._getFullName()

    this.keys = []
    const fullpath = this._getFullPath()
    this.regexp = pathToRegexp( fullpath, this.keys )
    this.toPath = pathToRegexp.compile( fullpath )
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
    this.parse = null
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

    const { options = {}, regexp, keys, traces } = matched

    // use best-matched router to match params,
    // regexp of standalone router is not accurate against full path
    const params = getParams( {
      segment,
      regexp,
      keys,
    } )

    return {
      options,
      segment,
      traces,
      params,
      router: matched,
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

export default class HTML5History {
  constructor( options = {} ) {
    this.options = options
    this.options.base = normalizeBase( this.options.base || '/' )

    this.observing = false
    this.listener = null
    this.current = null
  }

  observe( callback ) {
    if ( this.observing ) {
      return
    }

    if ( !this.listener ) {
      this.listener = () => {
        const newSegment = this.getSegment()
        callback( {
          oldSegment: this.current,
          newSegment: newSegment,
          ifAllowed: () => {
            this.current = newSegment
          }
        } )
      }
    }

    setTimeout( () => {
      this.observing = true
      window.addEventListener( 'popstate', this.listener, false )
    }, 0 )
  }

  unobserve() {
    this.observing = false
    window.removeEventListener( 'popstate', this.listener, false )
  }

  isObserving() {
    return this.observing
  }

  apply( callback ) {
    const segment = this.getSegment()

    this.current = segment

    callback( {
      newSegment: segment
    } )
  }

  getSegment( url ) {
    const base = this.options.base

    let target = location

    if ( url ) {
      target = document.createElement( 'a' )
      target.href = url
    }

    let pathname = decodeURIComponent( target.pathname )

    if ( pathname.indexOf( base ) === 0 ) {
      pathname = pathname.slice( base.length )
    }

    const segment = pathname + target.search + target.hash

    target = null

    return segment
  }

  push( path ) {
    this.current = path
    // fix <base href> issue
    const fullpath = location.origin + this.options.base + path
    history.pushState( null, '', fullpath )
  }

  replace( path ) {
    this.current = path
    const fullpath = location.origin + this.options.base + path
    history.replaceState( null, '', fullpath )
  }
}

function normalizeBase( base ) {
  base = String( base )

  if ( base.charAt( 0 ) !== '/' ) {
    base = '/' + base
  }

  return base.replace( /\/$/, '' )
}

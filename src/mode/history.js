// wip

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

    this.listener = () => {
      callback( {
        oldSegment: this.current,
        newSegment: this.getSegment(),
      } )
    }

    setTimeout( () => {
      window.addEventListener( 'popstate', this.listener )
    }, 0 )
  }

  unobserve() {
    this.observing = false
    window.removeEventListener( 'popstate', this.listener )
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

  getSegment() {
    const base = this.options.base
    let pathname = decodeURIComponent( location.pathname )

    if ( pathname.indexOf( base ) === 0 ) {
      pathname = pathname.slice( base.length )
    }

    return pathname + location.search + location.hash
  }

  push( path ) {
    this.current = path
    history.pushState( null, '', this.options.base + path )
  }

  replace( path ) {
    this.current = path
    history.replaceState( null, '', this.options.base + path )
  }
}

function normalizeBase( base ) {
  base = String( base )

  if ( base.charAt( 0 ) !== '/' ) {
    base = '/' + base
  }

  return base.replace( /\/$/, '' )
}

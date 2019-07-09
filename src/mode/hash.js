export default class HashHistory {
  constructor( options = {} ) {
    this.options = options
    this.observing = false
    this.oldURL = null
    this.listener = null
  }

  // observe is used to listen for back triggered by user
  observe( callback ) {
    if ( this.observing ) {
      return
    }

    this.listener = e => {
      if ( !this.observing ) {
        return
      }
      // save for back
      this.oldURL = e.oldURL

      callback( {
        newSegment: getHash( e.newURL ),
        oldSegment: getHash( e.oldURL ),
      } )
    }

    setTimeout( () => {
      window.addEventListener( 'hashchange', this.listener )
      this.observing = true
    }, 0 )
  }

  unobserve() {
    window.removeEventListener( 'hashchange', this.listener )
    this.observing = false
  }

  isObserving() {
    return this.observing
  }

  apply( callback ) {
    return callback( { newSegment: getHash() } )
  }

  back() {
    if ( this.oldURL ) {
      location.hash = this.oldURL.split( '#' )[ 1 ]
    }
  }

  getSegment( url ) {
    return getHash( url )
  }

  push( hash ) {
    location.hash = hash
  }

  replace( path ) {
    let url = location.href

    const index = url.indexOf( '#' )

    if ( index > 0 ) {
      url = url.slice( 0, index )
    }

    url = url + '#' + path

    location.replace( url )
  }
}

function getHash( url = location.href ) {
  const index = url.indexOf( '#' )

  if ( ~index ) {
    const hash = url.slice( index + 1 )
    return hash ? decodeURIComponent( hash ) : ''
  }

  return ''
}

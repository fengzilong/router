// wip

export default class HTML5History {
  constructor( options = {} ) {
    this.options = options
    this.observing = false
    this.listener = null
  }

  observe( callback ) {
    if ( observing ) {
      return
    }

    this.listener = () => {
      callback( {

      } )
    }

    window.addEventListener( 'popstate', this.listener )
  }

  unobserve() {
    observing = false
    window.removeEventListener( 'popstate', this.listener )
  }

  isObserving() {
    return observing
  }

  apply( callback ) {
    callback( {
      newSegment: getPath()
    } )
  }

  back() {

  }

  getSegment() {

  }

  push( path ) {

    history.pushState( {  }, null, path )
  }

  replace() {

  }
}

function getFullPath() {
  return location.href
}

function getPath() {
  return location.pathname
}

import createDeferred from './utils/deferred'

export {
  requestUnmount,
  requestMount,
  unmount,
  mount,
  update
}

// ===================== //
// lifecycles for router //
// ===================== //

function createRequestUnmountNext( target, resolve ) {
  return function next( result ) {
    if ( result !== false ) {
      resolve()
    }
  }
}

async function requestUnmount( targets = [], extra = {} ) {
  let count = 0

  for ( const target of targets ) {
    if ( typeof target.options.beforeLeave === 'function' ) {
      try {
        const deferred = createDeferred()
        const returned = target.options.beforeLeave.call( target, {
          next: createRequestUnmountNext( target, deferred.resolve ),
          ...extra,
        } )
        if ( returned instanceof Promise ) {
          await returned
        } else {
          await deferred.promise
        }
        count++
      } catch ( e ) {
        console.error( e )
      }
    } else {
      count++
    }
  }

  return count === targets.length
}

function createRequestMountNext( target, resolve ) {
  return function next( result ) {
    if ( result !== false ) {
      resolve()
    }

    if ( typeof result === 'function' ) {
      target._delayedCallbacks.push( result )
    }
  }
}

async function requestMount( targets = [], extra = {} ) {
  let count = 0

  for ( const target of targets ) {
    // reset beforeEnterCallbacks
    target._delayedCallbacks = []

    if ( typeof target.options.beforeEnter === 'function' ) {
      try {
        const deferred = createDeferred()
        const returned = target.options.beforeEnter.call( target, {
          next: createRequestMountNext( target, deferred.resolve ),
          ...extra,
        } )
        if ( returned instanceof Promise ) {
          await returned
        } else {
          await deferred.promise
        }
        count++
      } catch ( e ) {
        console.error( e )
      }
    } else {
      count++
    }
  }

  return count === targets.length
}

async function unmount( targets = [], extra = {} ) {
  for ( const target of targets ) {
    if ( typeof target.options.leave === 'function' ) {
      await target.options.leave.call( target, {
        next: nextStub,
        ...extra,
      } )
    }
  }
}

async function mount( targets = [], extra = {} ) {
  for ( const target of targets ) {
    mountOne( target, extra )
  }
}

async function mountOne( target, extra ) {
  // execute delayed callbacks
  const callbacks = target._delayedCallbacks || []
  for ( const callback of callbacks ) {
    if ( typeof callback === 'function' ) {
      callback()
    }
  }

  if ( typeof target.options.enter === 'function' ) {
    await target.options.enter.call( target, {
      next: nextStub,
      ...extra,
    } )
  }
}

async function update( targets = [], extra = {} ) {
  for ( const target of targets ) {
    // in most time, we want to execute the `enter` fn again when route update
    mountOne( target, extra )

    if ( typeof target.options.update === 'function' ) {
      await target.options.update.call( target, {
        next: nextStub,
        ...extra,
      } )
    }
  }
}

function nextStub() {
  console.warn( 'next is only available in beforeEnter and beforeLeave hook' )
}

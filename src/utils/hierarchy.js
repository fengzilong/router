export default function ( methods = [] ) {
	return function ( app ) {
		app.append = function ( another ) {
			app.children = app.children || []
			app.children.push( another )
			another.parent = this
		}

		app.recursiveInvoke = function ( method, ...args ) {
			if ( typeof this[ method ] === 'function' ) {
				this[ method ]( ...args )
			}

			const children = this.children || []
			if ( children.length > 0 ) {
				children.forEach( child => child.recursiveInvoke( method, ...args ) )
			}
		}

		app.recursive = function ( fn ) {
			fn( this )
			const children = this.children || []
			if ( children.length > 0 ) {
				children.forEach( child => child.recursive( fn ) )
			}
		}
	}
}

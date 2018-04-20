export default function ( methods = [] ) {
	return function ( app ) {
		app.append = function ( another ) {
			app.children = app.children || []
			app.children.push( another )
			another.parent = this
		}

		app.recursive = function ( fn ) {
			// save children in advance, fn may delete or reset `children`
			const children = this.children || []

			fn( this )

			if ( children.length > 0 ) {
				children.forEach( child => child.recursive( fn ) )
			}
		}
	}
}

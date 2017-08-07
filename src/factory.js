export default function ( createSample, globalOptions = {} ) {
	return function ( app ) {
		app.create = function ( options ) {
			return createSample( options, globalOptions )
		}
	}
}

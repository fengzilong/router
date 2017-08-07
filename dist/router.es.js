import dush from 'dush';
import pathToRegexp from 'path-to-regexp';

var factory = function ( createSample, globalOptions ) {
	if ( globalOptions === void 0 ) globalOptions = {};

	return function ( app ) {
		app.create = function ( options ) {
			return createSample( options, globalOptions )
		};
	}
};

var hierarchy = function ( methods ) {
	if ( methods === void 0 ) methods = [];

	return function ( app ) {
		app.append = function ( another ) {
			app.children = app.children || [];
			app.children.push( another );
			another.parent = this;
		};

		app.recursiveInvoke = function () {

		};

		app.recursive = function () {

		};
	}
};

var observer = dush();

var observe = function () {
	console.log( 'observe' );
	window.addEventListener( 'hashchange', function ( e ) {
		observer.emit( 'change', {
			newUrl: e.newURL,
			oldUrl: e.oldURL,
			e: e
		} );
	} );
	return observer
};

var unobserve = function ( id ) {
	console.log( 'unobserve', id );
};

function createRouter( options, globalOptions ) {
	if ( options === void 0 ) options = {};

	var router = dush();

	// +append && +parent && +recursiveInvoke && +recursive
	router.use( hierarchy() );

	router.options = options;
	router._fullPathRegexp = null;
	router._observeId = null;
	router.depth = 0;
	router.name = 'anonymous';

	router.start = function () {
		// reset depth
		this._depth = 0;
		this.recursiveInvoke( 'activate' );
		this.recursive( function () {
			// collect { depth, fullPathRegexp, partialPathRegexp, name } from subrouters
		} );

		this._observeFn = function ( ref ) {
			var e = ref.e;
			var newUrl = ref.newUrl;
			var oldUrl = ref.oldUrl;

			console.log( newUrl, oldUrl );
			e.preventDefault();
		};
		observe().on( 'change', this._observeFn.bind( this ) );
	};

	router.stop = function () {
		unobserve( 'change', this._observeFn );
	};

	router.activate = function () {
		// calc depth, for later regexp match rating
		this._depth = this.parent && ( this.parent._depth + 1 );
		this._fullPathRegexp = pathToRegexp( getFullPath( this ) );
		this._partialPathRegexp = pathToRegexp( this.options.path || '' );
	};

	router.deactivate = function () {
		this._depth = 0;
		this._fullPathRegexp = null;
		this._partialPathRegexp = null;
	};

	router.match = function () {

	};

	return router
}

function getFullPath( router ) {

}

var index = function ( globalOptions ) {
	if ( globalOptions === void 0 ) globalOptions = {};

	return dush()
		// +create
		.use( factory( createRouter, globalOptions ) )
};

export default index;

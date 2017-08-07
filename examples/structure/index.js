import { app, detail } from './routes';

@route( { app, detail } )
const Main = Regular.extend( {
	template: `
		<app path="/app" component="{ App }" title="{ appTitle }">
			<detail path="/detail/:id" component="{ Detail }" title="{ detailTitle }"></detail>
		</app>
	`
} );

new Main.$inject( '#app' );

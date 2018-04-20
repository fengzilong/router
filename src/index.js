import dush from 'dush'
import factory from './factory'
import router from './router'

export default function ( globalOptions = {} ) {
	return dush()
		// +create
		.use( factory( router, globalOptions ) )
}

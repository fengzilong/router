import dush from 'dush'
import factory from './factory'
import router from './router'

export default function ( globalOptions = {} ) {
  return dush()
    .use( factory( router, globalOptions ) ) // +create
}

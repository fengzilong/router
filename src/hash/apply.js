import getHash from './getHash'

export default function apply( fn ) {
	return fn( { newSegment: getHash() } )
}

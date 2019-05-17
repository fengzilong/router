module.exports = {
  babel: {
    asyncToPromises: true,
    minimal: true,
  },

  output: {
    moduleName: 'unfancyRouter',
    format: [ 'esm', 'cjs', 'umd' ],
    sourceMap: true,
  },

  banner: {
    author: 'fengzilong1992@gmail.com',
    license: 'MIT',
    version: require( './package.json' ).version,
    name: 'unfancy-router',
  },
}

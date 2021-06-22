const path = require('path');
const webpack = require('webpack');

module.exports = (env, options) => {
  const production = (options.mode === 'production');
  const config = {
    mode: production ? 'production' : 'development',
    entry: production ? './src/index.js' : {
      demo: "./src/index_demo.js",
      "mirador-content-state": "./src/index.js" 
    },
    optimization: {
      minimize: production
    },
    output: {
      filename: production ? "mirador-content-state.min.js" : "[name].js",
      path: path.resolve(__dirname, 'dist'),
      library: 'mirador-content-state',
      libraryExport: 'default',
      libraryTarget: 'umd',
    },
    plugins: [
      new webpack.IgnorePlugin({
        resourceRegExp: /@blueprintjs\/(core|icons)/, // ignore optional UI framework dependencies
      }),
    ],
    module: {
      rules: [
        {
          test: /\.(js|jsx)$/,
          exclude: /node_modules/,
          use: {
            loader: "babel-loader"
          }
        }
      ]
    }
  }
  if(production) return config;
  else return config;
}


const path = require('path');
var webpack = require("webpack");

module.exports = {
  entry: './src/index.ts',
  devtool: 'inline-source-map',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/
      }
    ]
  },
  resolve: {
    extensions: [ '.ts', '.js' ]
  },
  devServer: {
    contentBase: path.join(__dirname, "dist"),
    port: 8080
  },
  output: {
    filename: 'meta-emulator.js',
    path: path.resolve(__dirname, 'dist'),
    library: 'metaEmulator'
  },
  plugins: [
    new webpack.optimize.UglifyJsPlugin({minimize: true})
  ]
};
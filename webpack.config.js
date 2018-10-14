const path = require('path');

module.exports = {
  mode: 'production',
  entry: './src/index.ts',
  // devtool: 'inline-source-map',
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
  }
};
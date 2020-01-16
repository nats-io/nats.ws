const path = require('path')
const webpack = require('webpack')
// const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;
// const nodeExternals = require('webpack-node-externals');

module.exports = {
    entry: path.resolve(__dirname, 'src/nats.ts'),
    devtool: 'source-map',

    mode: 'production',
    output: {
        path: path.resolve(__dirname),
        filename: 'index.js',
        library: 'nats',
        libraryTarget: 'global',
    },
    resolve: {
        extensions: ['.ts', '.js']
    },
    module: {
        rules: [
            {
                test: [/\.ts$/],
                exclude: [/test/],
                use: 'ts-loader'
            },
            { enforce: 'pre', test: /\.js$/, loader: 'source-map-loader' }
        ]
    }
};

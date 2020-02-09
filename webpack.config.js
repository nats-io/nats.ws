const path = require('path')
const webpack = require('webpack');

module.exports = {
    mode: 'production',
    entry: path.resolve(__dirname, 'src/index.ts'),
    output: {
        path: path.resolve(__dirname),
        filename: 'dist/nats.js',
        libraryTarget: 'commonjs',
        library: 'nats',
    },
    resolve: {
        extensions: ['.ts'],
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                loader: "ts-loader",
                exclude:  /(node_modules|test)/,
            },
        ],
    },
    plugins: [
        new webpack.DefinePlugin({
            pkg: require("./package.json"),
        }),
    ],
    devtool: "source-map"
};

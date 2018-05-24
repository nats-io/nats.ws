const path = require('path');
const webpack = require('webpack');
const wba = require('webpack-bundle-analyzer');

module.exports = {
    mode: "development",
    entry: path.resolve(__dirname, "src/nats.ts"),
    output: {
        path: path.resolve(__dirname, "lib"),
        filename: "nats.js",
        library: "nats",
        libraryTarget: "this"

    },
    resolve: {
        extensions: [".ts", ".js"]
    },
    module: {
        rules: [
            {
                test: [/\.ts$/],
                exclude: [/test/],
                use: "ts-loader"
            },
            {enforce: "pre", test: /\.js$/, loader: "source-map-loader"}
        ]
    },
    devtool: "source-map",
    plugins: [
        new wba.BundleAnalyzerPlugin()
    ]
};

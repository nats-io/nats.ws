const path = require('path');
const webpack = require('webpack');
// const wba = require('webpack-bundle-analyzer');

module.exports = {
    entry: path.resolve(__dirname, "src/nats.ts"),
    devtool: "source-map",

    mode: "production",
    output: {
        path: path.resolve(__dirname, "lib"),
        filename: "nats.js",
        library: "nats",
        libraryTarget: "global",

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
    }
};

const path = require('path')

module.exports = {
    mode: 'none',
    entry: path.resolve(__dirname, "src/nats.ts"),
    output: {
        path: path.resolve(__dirname),
        filename: "nats.js",
        libraryTarget: 'umd',
        library: 'nuid'
    },
    resolve: {
        extensions: ['.ts']
    },
    module: {
        rules: [
            { test: /\.ts$/, loader: "ts-loader", exclude:  /(node_modules|test)/}
        ]
    },
    devtool: "source-map"
};

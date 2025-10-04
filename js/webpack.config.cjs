module.exports = {
    mode: process.env.NODE_ENV || "production",
    entry: "./src/index.js",
    // output: {
    //     filename: "index.js",
    // },
    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: /node_modules/,
                type: "javascript/esm",
                use: {
                    loader: "babel-loader",
                    options: {
                        presets: ["@babel/preset-env"],
                    },
                },
            },
            {
                test: /\.css$/,
                exclude: /node_modules/,
                use: [{ loader: "style-loader" }, { loader: "css-loader" }],
            },
            {
                test: /(perspective\-server\.wasm|perspective\-viewer\.wasm|arrow1_bg\.wasm)$/,
                type: "asset/resource",
            },
        ],
    },
    stats: {
        modules: false,
        hash: false,
        version: false,
        builtAt: false,
        entrypoints: false,
    },
    experiments: {
        asyncWebAssembly: false,
        syncWebAssembly: false,
        topLevelAwait: true,
    },
    devtool: "source-map",
};
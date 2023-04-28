const cpy_mod = import("cpy");
const { WasmPlugin } = require("@finos/perspective-esbuild-plugin/wasm");
const { WorkerPlugin } = require("@finos/perspective-esbuild-plugin/worker");
const { build } = require("@finos/perspective-esbuild-plugin/build");

const LAB_BUILD = {
    entryPoints: ["src/js/index.js"],
    define: {
        global: "window",
    },
    plugins: [WasmPlugin(true), WorkerPlugin({ inline: true })],
    external: ["@jupyter*", "@lumino*"],
    format: "esm",
    loader: {
        ".css": "text",
        ".html": "text",
        ".ttf": "file",
    },
    outfile: "dist/umd/perspective-parquet.js",
};

const { BuildCss } = require("@prospective.co/procss/target/cjs/procss.js");
const fs = require("fs");

function add(builder, path, path2) {
    builder.add(
        path,
        fs.readFileSync(require.resolve(path2 || path)).toString()
    );
}

async function build_all() {
    const { default: cpy } = await cpy_mod;
    fs.mkdirSync("dist/css", { recursive: true });
    const builder3 = new BuildCss("");

    add(builder3, "@finos/perspective-viewer/dist/css/themes.css");
    add(
        builder3,
        "@finos/perspective-jupyterlab/dist/css/perspective-jupyterlab.css"
    );
    add(builder3, "./src/less/index.less");
    fs.writeFileSync(
        "dist/css/perspective-parquet.css",
        builder3.compile().get("index.css")
    );

    await build(LAB_BUILD);
    cpy(["dist/css/*"], "dist/umd");
    cpy(["src/less/*"], "dist/less");
}

build_all();

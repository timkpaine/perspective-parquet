/******************************************************************************
 *
 * Copyright (c) 2018, the Perspective Authors.
 *
 * This file is part of the Perspective library, distributed under the terms of
 * the Apache License 2.0.  The full license can be found in the LICENSE file.
 *
 */

import { ActivityMonitor } from "@jupyterlab/coreutils";
import { ILayoutRestorer } from "@jupyterlab/application";
import {
    IThemeManager,
    WidgetTracker,
    Dialog,
    showDialog,
} from "@jupyterlab/apputils";

import { ABCWidgetFactory, DocumentWidget } from "@jupyterlab/docregistry";
import perspective from "@finos/perspective";
import perspective_viewer from "@finos/perspective-viewer";

import "@finos/perspective-viewer";
import "@finos/perspective-viewer-datagrid";
import "@finos/perspective-viewer-d3fc";
import init, {
    Compression,
    WriterPropertiesBuilder,
    readParquet,
    writeParquet,
} from "parquet-wasm/esm2/arrow1";
import wasm from "../node_modules/parquet-wasm/esm2/arrow1_bg.wasm";

import { PerspectiveWidget } from "./psp_widget";

import SERVER_WASM from "@finos/perspective/dist/wasm/perspective-server.wasm";
import CLIENT_WASM from "@finos/perspective-viewer/dist/wasm/perspective-viewer.wasm";

await Promise.all([
    perspective.init_server(fetch(SERVER_WASM)),
    perspective_viewer.init_client(fetch(CLIENT_WASM)),
]);


const worker = await perspective.worker();

/**
 * The name of the factories that creates widgets.
 */
const FACTORY_PARQUET = "Perspective-Parquet";
const RENDER_TIMEOUT = 1000;

// create here to reuse for exception handling
const baddialog = () => {
    showDialog({
        body: "Perspective could not render the data",
        buttons: [
            Dialog.okButton({
                label: "Dismiss",
            }),
        ],
        focusNodeSelector: "input",
        title: "Error",
    });
};

export class PerspectiveDocumentWidget extends DocumentWidget {
    constructor(options, type = "parquet") {
        super({
            content: new PerspectiveWidget("Perspective"),
            context: options.context,
            reveal: options.reveal,
        });

        this._monitor = null;
        this._psp = this.content;
        this._type = type;
        this._context = options.context;
        this._context.ready.then(() => {
            this._update();
            this._monitor = new ActivityMonitor({
                signal: this.context.model.contentChanged,
                timeout: RENDER_TIMEOUT,
            });
            this._monitor.activityStopped.connect(this._update, this);
        });
    }

    async _update() {
        try {
            let data;
            if (this._type === "parquet") {
                // initialize wasm
                console.log(wasm);
                await init(fetch(wasm));

                // `readParquet` returns arrow ipc format uint8array
                data = readParquet(
                    Uint8Array.from(atob(this._context.model.toString()), (c) =>
                        c.charCodeAt(0)
                    )
                ).buffer;
            } else {
                // don't handle other mimetypes for now
                throw "Not handled";
            }
            try {
                const table = await this._psp.viewer.getTable();
                table.replace(data);
            } catch (e) {
                // construct new table
                const table_promise = worker.table(data);

                // load data
                await this._psp.viewer.load(table_promise);
                const table = await this._psp.viewer.getTable();

                // create a flat view
                const view = await table.view();
                view.on_update(async () => {
                    // TODO
                    if (this._type === "parquet") {
                        const result = await view.to_arrow();
                        const result_as_parquet = writeParquet(
                            new Uint8Array(result),
                            new WriterPropertiesBuilder().build()
                        );
                        const resultAsB64 = btoa(
                            result_as_parquet.reduce(
                                (acc, i) =>
                                    (acc += String.fromCharCode.apply(null, [
                                        i,
                                    ])),
                                ""
                            )
                        );
                        this.context.model.fromString(resultAsB64);
                        this.context.save();
                    }
                });
            }
        } catch (e) {
            baddialog();
            throw e;
        }

        // pickup theme from env
        this._psp.theme =
            document.body.getAttribute("data-jp-theme-light") === "false"
                ? "Pro Light"
                : "Pro Dark";
    }

    dispose() {
        if (this._monitor) {
            this._monitor.dispose();
        }
        this._psp.delete();
        super.dispose();
    }

    get psp() {
        return this._psp;
    }
}

/**
 * A widget factory for parquet widgets.
 */
export class PerspectiveParquetFactory extends ABCWidgetFactory {
    createNewWidget(context) {
        return new PerspectiveDocumentWidget(
            {
                context,
            },
            "parquet"
        );
    }
}

/**
 * Activate cssviewer extension for CSV files
 */

async function activate(app, restorer, themeManager) {
    try {
        app.docRegistry.addFileType({
            name: "parquet",
            displayName: "parquet",
            extensions: [".parquet"],
            mimeTypes: ["application/octet-stream"],
            contentType: "file",
            fileFormat: "base64",
        });
    } catch (_a) {
        // do nothing
    }

    const factoryparquet = new PerspectiveParquetFactory({
        name: FACTORY_PARQUET,
        fileTypes: ["parquet"],
        defaultFor: ["parquet"],
        readOnly: true,
        modelName: "base64",
    });

    const trackerparquet = new WidgetTracker({
        namespace: "parquetperspective",
    });

    if (restorer) {
        // Handle state restoration.
        void restorer.restore(trackerparquet, {
            command: "docmanager:open",
            args: (widget) => ({
                path: widget.context.path,
                factory: FACTORY_PARQUET,
            }),
            name: (widget) => widget.context.path,
        });
    }

    app.docRegistry.addWidgetFactory(factoryparquet);
    const ftparquet = app.docRegistry.getFileType("parquet");

    factoryparquet.widgetCreated.connect((sender, widget) => {
        // Track the widget.
        void trackerparquet.add(widget);

        // Notify the widget tracker if restore data needs to update.
        widget.context.pathChanged.connect(() => {
            void trackerparquet.save(widget);
        });

        if (ftparquet) {
            widget.title.iconClass = ftparquet.iconClass || "";
            widget.title.iconLabel = ftparquet.iconLabel || "";
        }
    });

    // Keep the themes up-to-date.
    const updateThemes = () => {
        const isLight =
            themeManager && themeManager.theme
                ? themeManager.isLight(themeManager.theme)
                : true;

        const theme = isLight ? "Pro Light" : "Pro Dark";
        trackerparquet.forEach((pspDocWidget) => {
            pspDocWidget.psp.theme = theme;
        });
    };

    if (themeManager) {
        themeManager.themeChanged.connect(updateThemes);
    }
}

/**
 * The perspective extension for files
 */
export const PerspectiveRenderers = {
    activate: activate,
    id: "@finos/perspective-jupyterlab-parquet-renderers",
    requires: [],
    optional: [ILayoutRestorer, IThemeManager],
    autoStart: true,
};

const plugins = [PerspectiveRenderers];

export default plugins;

export {activate as _activate};

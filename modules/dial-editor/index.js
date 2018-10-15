/* global $ */

const _ = require('lodash');
const doT = require('dot');

const Library = require('../library');
const library = new Library('lo-rez/dials.jsonl');

const Painter = require('../painter');
const Palette = require('../palette');
const PixelPanel = require('../pixel-panel');

const viewScale = 16;

const makeBase64 = (data) => `data:image/png;base64,${data.toString('base64')}`;

const entryTemplate = doT.template(`<li>
    <i class="{{=it.icon}}"></i>
    {{=it.caption}}
</li>`);

const editorTemplate = doT.template(`<div>
    <div class="horizontal segments">
        <div class="editor-view editor-dial"></div>
        <div class="editor-view editor-mask"></div>
        <div class="editor-view editor-overlay"></div>
    </div>

    <ul class="palette"></ul>

    <div class="horizontal segments previews">
        <div class="preview is-huge"></div>
    </div>

    <div class="ui-row">
        <span class="spacer"></span>

        <button class="js-save button is-info is-small">Save</button>
    </div>
</div>`);

const applianceList = [{
    name: 'clock_00.png',
    frames: 64,
    assetBase: 'assets/minecraft/textures/item/clock_',
}, {
    name: 'compass_00.png',
    frames: 32,
    assetBase: 'assets/minecraft/textures/item/compass_',
}];

const getInterframePalette = async (zip, assetNameBase, frameCount) => {
    const palette = [];

    for (let t = 0; t < frameCount; t += 1) {
        const filename = `${assetNameBase}${t.toString(10).padStart(2, '0')}.png`;
        const src = makeBase64(zip.getEntry(filename).getData());
        const colors = await PixelPanel.getColors(src);

        palette.push(colors);
    }

    return Palette.cleanup(_.flatten(palette));
};

const drawInterframe = (dialCanvas, maskCanvas, overlayCanvas, progress) => {
    const maskContext = maskCanvas.getContext('2d');

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    canvas.width = canvas.height = 8;

    context.imageSmoothingEnabled = false;
    context.translate(4, 4);
    context.rotate((progress * 360) * Math.PI / 180);
    context.translate(-4, -4);
    context.drawImage(dialCanvas, 0, 0);
    context.setTransform(1, 0, 0, 1, 0, 0);

    for (let y = 0; y < 8; y += 1) {
        for (let x = 0; x < 8; x += 1) {
            const pixelData = context.getImageData(x, y, 1, 1);
            const maskData = maskContext.getImageData(x, y, 1, 1);

            pixelData.data[3] = maskData.data[3];

            context.putImageData(pixelData, x, y);
        }
    }

    context.drawImage(overlayCanvas, 0, 0);

    return canvas.toDataURL('image/png', 1.0);
};

const Editor = function (paneManager, zip) {
    const self = this;

    const $pane = $(editorTemplate({
    }));

    const $palette = $pane.find('.palette');
    const $save = $pane.find('.js-save');

    const $dialEditorWrapper = $pane.find('.editor-dial');
    const $maskEditorWrapper = $pane.find('.editor-mask');
    const $overlayEditorWrapper = $pane.find('.editor-overlay');

    const dialEditor = new PixelPanel($dialEditorWrapper, viewScale, 8);
    const maskEditor = new PixelPanel($maskEditorWrapper, viewScale, 8);
    const overlayEditor = new PixelPanel($overlayEditorWrapper, viewScale, 8);

    let palette = [];

    let inFocus = false;

    let frameCount;
    let assetNameBase;

    for (let i = 0; i < applianceList.length; i += 1) {
        const {name, frames, assetBase} = applianceList[i];

        if (zip.caption.indexOf(name) >= 0) {
            frameCount = frames;
            assetNameBase = assetBase;
        }
    }

    const generateFrame = (frameIndex) => {
        const dialCanvas = Painter.drawToCanvas(8, palette, dialEditor.pixels());
        const maskCanvas = Painter.drawToCanvas(8, palette, maskEditor.pixels());
        const overlayCanvas = Painter.drawToCanvas(8, palette, overlayEditor.pixels());

        const dataUrl = drawInterframe(dialCanvas, maskCanvas, overlayCanvas, frameIndex / frameCount);

        $pane.find('.preview').css({
            'background-image': `url(${dataUrl})`,
        });
    };

    const loadColors = async () => {
        palette = await getInterframePalette(zip.zip, assetNameBase, frameCount);

        Palette.build($palette, palette);

        dialEditor.setPalette(palette);
        maskEditor.setPalette(palette);
        overlayEditor.setPalette(palette);

        self.load();
    };

    self.save = function () {
        $save.addClass('is-loading');

        library.set(`${assetNameBase}dial.png`, dialEditor.pixels(), () => {
            library.set(`${assetNameBase}mask.png`, maskEditor.pixels(), () => {
                library.set(`${assetNameBase}overlay.png`, overlayEditor.pixels(), () => {
                    $save.removeClass('is-loading');

                    $('#files').trigger('refresh');
                });
            });
        });
    };

    self.load = function () {
        dialEditor.pixels(library.get(`${assetNameBase}dial.png`));
        maskEditor.pixels(library.get(`${assetNameBase}mask.png`));
        overlayEditor.pixels(library.get(`${assetNameBase}overlay.png`));
    };

    self.getTab = () => zip.short;

    self.getPane = () => $pane;

    self.activate = () => {
        inFocus = true;

        return self;
    };

    self.deactivate = () => {
        inFocus = false;

        return self;
    };

    self.destroy = () => {
        $palette.off();
    };

    $save.on('click', self.save);

    $palette.on('set-color', (event, index) => {
        dialEditor.setSelected(index);
        maskEditor.setSelected(index);
        overlayEditor.setSelected(index);
    });

    let previewIndex = 0;

    window.setInterval(() => {
        previewIndex = (previewIndex + 1) % frameCount;

        generateFrame(previewIndex);
    }, 200);

    loadColors();

    return paneManager.add(self);
};

Editor.applies = (entry) => {
    for (let i = 0; i < applianceList.length; i += 1) {
        if (entry.entryName.indexOf(applianceList[i].name) >= 0) {
            return true;
        }
    }

    return false;
};

Editor.getListEntry = (paneOrganizer, zip, entry) => {
    const caption = entry.entryName
        .replace(/^\/?assets\/minecraft\/textures\//, '');

    const $entry = $(entryTemplate({
        caption: caption,
        icon: 'fa fa-circle',
    })).prop('zip', {
        zip: zip,
        entry: entry,
        editor: Editor,
        caption: caption,
        short: caption.match(/[\w\-_]+\.\w+$/)[0],
    });

    $entry.on('click', function () {
        if ($entry.is('.is-open')) {
            return;
        }

        new Editor(paneOrganizer.proxy($entry), $(this).prop('zip'));
    });

    return $entry;
};

Editor.refreshListEntry = (properties, $entry) => {
    const entry = properties.entry;

    const dialDefinition = library.get(entry.entryName.replace('_00', '_dial'));
    const maskDefinition = library.get(entry.entryName.replace('_00', '_mask'));
    const overlayDefinition = library.get(entry.entryName.replace('_00', '_overlay'));

    const isDefined = (typeof dialDefinition !== 'undefined') && (typeof maskDefinition !== 'undefined') && (typeof overlayDefinition !== 'undefined');

    $entry.toggleClass('is-defined', isDefined);
};

const fs = require('fs');
const extractor = require('../extractor');
const ZipOrganizer = require('../organizer')('zip');

Editor.export = async () => {
    const currentZip = ZipOrganizer.get();

    for (let i = 0; i < applianceList.length; i += 1) {
        const {name, frames, assetBase} = applianceList[i];

        const dialDefinition = library.get(`${assetBase}dial.png`);
        const maskDefinition = library.get(`${assetBase}mask.png`);
        const overlayDefinition = library.get(`${assetBase}overlay.png`);

        if (typeof dialDefinition === 'undefined') {
            continue;
        }

        if (typeof maskDefinition === 'undefined') {
            continue;
        }

        if (typeof overlayDefinition === 'undefined') {
            continue;
        }

        const palette = await getInterframePalette(currentZip, assetBase, frames);

        const dialCanvas = Painter.drawToCanvas(8, palette, dialDefinition);
        const maskCanvas = Painter.drawToCanvas(8, palette, maskDefinition);
        const overlayCanvas = Painter.drawToCanvas(8, palette, overlayDefinition);

        for (let f = 0; f < frames; f += 1) {
            const dataUrl = drawInterframe(dialCanvas, maskCanvas, overlayCanvas, f / frames);

            const data = dataUrl.replace(/^data:image\/\w+;base64,/, '');
            const buffer = Buffer.from(data, 'base64');

            fs.writeFile(`lo-rez/${assetBase}${f.toString().padStart(2, '0')}.png`, buffer, (error) => {
                if (error) {
                    console.error(error);
                }
            });
        }
    }
};

module.exports = Editor;

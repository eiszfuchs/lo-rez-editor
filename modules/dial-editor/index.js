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

const Editor = function (paneManager, zip) {
    const self = this;

    const $pane = $(editorTemplate({
    }));

    const $palette = $pane.find('.palette');

    const $maskEditorWrapper = $pane.find('.editor-mask');
    const $dialEditorWrapper = $pane.find('.editor-dial');
    const $overlayEditorWrapper = $pane.find('.editor-overlay');

    const maskEditor = new PixelPanel($maskEditorWrapper, viewScale, 8);
    const dialEditor = new PixelPanel($dialEditorWrapper, viewScale, 8);
    const overlayEditor = new PixelPanel($overlayEditorWrapper, viewScale, 8);

    let palette = [];

    let inFocus = false;

    let frameCount;
    let assetNameBase;

    if (zip.caption.indexOf('clock_') >= 0) {
        frameCount = 64;
        assetNameBase = 'assets/minecraft/textures/item/clock_';
    }

    if (zip.caption.indexOf('compass_') >= 0) {
        frameCount = 32;
        assetNameBase = 'assets/minecraft/textures/item/compass_';
    }

    const generateFrame = (frameIndex) => {
        const maskCanvas = Painter.drawToCanvas(8, palette, maskEditor.pixels());
        const dialCanvas = Painter.drawToCanvas(8, palette, dialEditor.pixels());
        const overlayCanvas = Painter.drawToCanvas(8, palette, overlayEditor.pixels());

        const maskContext = maskCanvas.getContext('2d');

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');

        canvas.width = canvas.height = 8;

        context.imageSmoothingEnabled = false;
        context.translate(4, 4);
        context.rotate(((frameIndex / frameCount) * 360) * Math.PI / 180);
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

        $pane.find('.preview').css({
            'background-image': `url(${canvas.toDataURL('image/png', 1.0)})`,
        });
    };

    const loadColors = async () => {
        for (let t = 0; t < frameCount; t += 1) {
            const filename = `${assetNameBase}${t.toString(10).padStart(2, '0')}.png`;
            const src = makeBase64(zip.zip.getEntry(filename).getData());
            const colors = await PixelPanel.getColors(src);

            palette.push(colors);
        }

        palette = _.flatten(palette);
        palette = Palette.cleanup(palette);

        Palette.build($palette, palette);

        maskEditor.setPalette(palette);
        dialEditor.setPalette(palette);
        overlayEditor.setPalette(palette);
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

    $palette.on('set-color', (event, index) => {
        maskEditor.setSelected(index);
        dialEditor.setSelected(index);
        overlayEditor.setSelected(index);
    });

    let previewIndex = 0;

    window.setInterval(() => {
        previewIndex = (previewIndex + 1) % frameCount;

        // TODO: Find a better place
        generateFrame(previewIndex);
    }, 200);

    loadColors();

    return paneManager.add(self);
};

Editor.applies = (entry) => {
    if (entry.entryName.indexOf('clock_00.png') >= 0) {
        return true;
    }

    if (entry.entryName.indexOf('compass_00.png') >= 0) {
        return true;
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
    const definition = library.get(entry.entryName);
    const isDefined = typeof definition !== 'undefined';

    $entry.toggleClass('is-defined', isDefined);
};

const fs = require('fs');
const extractor = require('../extractor');
const ZipOrganizer = require('../organizer')('zip');

Editor.export = () => {
    // TODO: Stub method
};

module.exports = Editor;

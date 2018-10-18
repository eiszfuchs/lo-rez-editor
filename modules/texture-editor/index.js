/* global $, CP */

const _ = require('lodash');
const doT = require('dot');

const Library = require('../library');
const library = new Library('lo-rez/textures.jsonl');

require('../organizer')('texture').set(library);

const Color = require('../color');
const Palette = require('../palette');
const PixelPanel = require('../pixel-panel');

const Clipboard = require('../organizer')('texture/clipboard');

require('c-p');
let globalTransparencyColor = '#ff00ff';

const updateTransparencyColor = () => {
    $('head style.colors').remove();
    $('<style class="colors" />').text(`
        :root {
            --transparency-color: ${globalTransparencyColor};
        }
    `).appendTo('head');
};

const viewScale = 12;
const sourcePreviewScale = 2;
const targetDivider = 2;
const editorPreviewScale = sourcePreviewScale * targetDivider;

const inArray = (array, value) => _.indexOf(array, value) >= 0;

const makeBase64 = (data) => `data:image/png;base64,${data.toString('base64')}`;

const entryTemplate = doT.template(`<li>
    <i class="{{=it.icon}}"></i>
    {{=it.caption}}
</li>`);

const editorTemplate = doT.template(`<div>
    <div class="horizontal segments">
        <img src="{{=it.source}}" class="source-view" />
        <div class="editor-view"></div>
    </div>

    <ul class="palette"></ul>

    <div class="horizontal segments previews">
        <div class="preview source"></div>
        <div class="preview editor"></div>
    </div>

    <div class="ui-row">
        <div class="buttons has-addons">
            <span class="button is-small" data-transparency="a"></span>
            <span class="button is-small" data-transparency="b"></span>
            <div class="button is-small" data-transparency="c">
                <div class="js-color-picker color-picker-parent"></div>
            </div>
        </div>

        <span class="spacer"></span>

        <div class="js-auto-pilot dropdown is-up">
            <div class="dropdown-trigger">
                <button class="button is-small">
                    <span>Auto pilot</span>
                    <span class="icon is-small">
                        <i class="fa fa-angle-down"></i>
                    </span>
                </button>
            </div>

            <div class="dropdown-menu">
                <div class="dropdown-content">
                    <a class="dropdown-item" data-method="nearest">
                        Nearest
                    </a>

                    <a class="dropdown-item" data-method="farest">
                        Farest
                    </a>

                    <a class="dropdown-item" data-method="top-left">
                        Copy top-left
                    </a>

                    <a class="dropdown-item" data-method="edges-outside">
                        Edges outside
                    </a>

                    <a class="dropdown-item" data-method="edges-inside">
                        Edges inside
                    </a>
                </div>
            </div>
        </div>

        <div class="js-texture-tools dropdown is-up">
            <div class="dropdown-trigger">
                <button class="button is-small">
                    <span>Tools</span>
                    <span class="icon is-small">
                        <i class="fa fa-angle-down"></i>
                    </span>
                </button>
            </div>

            <div class="dropdown-menu">
                <div class="dropdown-content">
                    <a class="dropdown-item" data-tool="copy">
                        Copy
                    </a>

                    <a class="dropdown-item" data-tool="paste-color">
                        Paste color
                    </a>

                    <a class="dropdown-item" data-tool="paste-indices">
                        Paste indices
                    </a>
                </div>
            </div>
        </div>

        <span class="spacer"></span>

        <button class="js-save button is-info is-small">Save</button>
    </div>
</div>`);

const Editor = function (paneManager, zip) {
    const self = this;

    const source = makeBase64(zip.entry.getData());

    const $pane = $(editorTemplate({
        source,
    }));

    const $source = $pane.find('.source-view');
    const $editor = $pane.find('.editor-view');

    const $palette = $pane.find('.palette');
    const $previews = $pane.find('.preview');
    const $save = $pane.find('.js-save');
    const $autopilot = $pane.find('.js-auto-pilot');
    const $tools = $pane.find('.js-texture-tools');

    let palette = [];

    let textureEditor;

    let editorWidth = 0;
    let editorHeight = 0;

    let context;

    const getColorsAt = function (x, y, width, height) {
        const result = [];

        if (x < 0 || y < 0) {
            return result;
        }

        if ((x + width) > context.canvas.width) {
            return result;
        }

        if ((y + height) > context.canvas.height) {
            return result;
        }

        const data = context.getImageData(x, y, width, height).data;

        _.each(_.range(width * height), function (d) {
            result.push(new Color(data.slice(d * 4, (d + 1) * 4)));
        });

        return result;
    };

    const highlightColors = function (picked) {
        const $colors = $palette.find('li');

        let index = 1;

        $colors.removeClass('picked').removeAttr('data-hotkey');
        $colors.each(function () {
            const $color = $(this);
            const colors = palette[$color.index()].links();

            colors.forEach((color) => {
                if (inArray(picked, color)) {
                    $color.addClass('picked');
                    $color.attr('data-hotkey', index);

                    index += 1;
                }
            });
        });
    };

    const getPaletteIndex = function (color) {
        return _.findIndex(palette, (d) => inArray(d.links(), color.hex()));
    };

    // inefficient code for better understanding
    const matchKey = (char) => char.charCodeAt(0);

    $(document).on('keypress', function (event) {
        const char = event.charCode;

        if (char >= matchKey('1') && char <= matchKey('4')) {
            $palette.find('.picked').eq(char - 49).click();
        }
    });

    $source.on('mousemove', function (event) {
        if (!context) {
            return;
        }

        const x = Math.floor(event.offsetX / viewScale);
        const y = Math.floor(event.offsetY / viewScale);

        const detected = _.map(getColorsAt(x, y, 1, 1), (d) => d.hex());

        highlightColors(detected);
    });

    $source.on('mouseleave', function () {
        $palette.find('li').removeClass('picked').removeAttr('data-hotkey');
    });

    $pane.attr('data-transparency', 'a');
    $pane.on('click', '[data-transparency]', function () {
        $pane.attr('data-transparency', $(this).attr('data-transparency'));
    });

    // TODO: Get preview texture from editor
    $editor.on('refresh', _.throttle(() => {
        if (palette.length < 1) {
            return false;
        }

        const preview = document.createElement('canvas');

        preview.width = editorWidth * editorPreviewScale;
        preview.height = editorHeight * editorPreviewScale;

        const previewContext = preview.getContext('2d');

        $editor.find('.cell').each(function () {
            const $cell = $(this);
            const color = $cell.attr('data-color');

            let colorValue = 'transparent';

            if (typeof color !== 'undefined') {
                if (palette.hasOwnProperty(color)) {
                    colorValue = palette[color].rgba();
                }
            }

            const x = parseInt($cell.attr('data-x'), 10);
            const y = parseInt($cell.attr('data-y'), 10);

            previewContext.fillStyle = colorValue;
            previewContext.fillRect(
                x * editorPreviewScale, y * editorPreviewScale,
                editorPreviewScale, editorPreviewScale
            );
        });

        $previews.filter('.editor')
            .css('background-image', `url(${preview.toDataURL()})`);
    }, 75));

    $source.on('load', function () {
        const sourceWidth = this.naturalWidth * viewScale;
        const sourceHeight = this.naturalHeight * viewScale;

        const editorScale = viewScale * targetDivider;

        editorWidth = this.naturalWidth / targetDivider;
        editorHeight = this.naturalHeight / targetDivider;

        $source.css({
            width: `${sourceWidth}px`,
            height: `${sourceHeight}px`,
        });

        textureEditor = new PixelPanel($editor, editorScale, editorWidth);

        const canvas = document.createElement('canvas');

        context = canvas.getContext('2d');

        canvas.width = this.naturalWidth;
        canvas.height = this.naturalHeight;

        context.drawImage(this, 0, 0);

        const preview = document.createElement('canvas');

        preview.width = canvas.width * sourcePreviewScale;
        preview.height = canvas.height * sourcePreviewScale;

        const previewContext = preview.getContext('2d');

        for (let y = 0; y < this.naturalHeight; y += 1) {
            for (let x = 0; x < this.naturalWidth; x += 1) {
                const pixel = context.getImageData(x, y, 1, 1);
                const data = pixel.data;
                const color = new Color(data);

                previewContext.fillStyle = color.rgba();
                previewContext.fillRect(
                    x * sourcePreviewScale, y * sourcePreviewScale,
                    sourcePreviewScale, sourcePreviewScale
                );

                palette.push(color);
            }
        }

        $previews.filter('.source')
            .css('background-image', `url(${preview.toDataURL()})`);

        palette = Palette.cleanup(palette);
        Palette.build($palette, palette);

        textureEditor.setPalette(palette);
        textureEditor.pixels(library.get(zip.entry.entryName));

        $editor.trigger('refresh');
    });

    $palette.on('set-color', (event, index) => {
        textureEditor.setSelected(index);
    });

    $editor.on('over-pixel', function (event, {x, y}) {
        if (!context) {
            return;
        }

        const detected = _.map(getColorsAt(x * 2, y * 2, 2, 2),
            (d) => d.hex());

        highlightColors(detected);
    });

    $editor.on('mouse-out', function () {
        $palette.find('li').removeClass('picked').removeAttr('data-hotkey');
    });

    const getAutoPilotPalette = function () {
        const x = parseInt(this.attr('data-x'), 10);
        const y = parseInt(this.attr('data-y'), 10);

        const colors = getColorsAt(x * 2, y * 2, 2, 2);
        const average = Color.mix(colors);

        return _.sortBy(colors, (d) => d.distance(average));
    };

    $autopilot
        .on('click', function () {
            $(this)
                .toggleClass('is-active')
                .siblings()
                .removeClass('is-active');
        })
        .on('click', '[data-method="nearest"]', function () {
            // TODO: Don't manipulate $editor directly
            $editor.find('.cell').each(function () {
                const $cell = $(this);

                $cell.attr('data-color', getPaletteIndex(
                    getAutoPilotPalette.apply($cell)[0]
                ));
            }).end()
                .trigger('refresh');
        })
        .on('click', '[data-method="farest"]', function () {
            // TODO: Don't manipulate $editor directly
            $editor.find('.cell').each(function () {
                const $cell = $(this);

                $cell.attr('data-color', getPaletteIndex(
                    getAutoPilotPalette.apply($cell).reverse()[0]
                ));
            }).end()
                .trigger('refresh');
        })
        .on('click', '[data-method="top-left"]', function () {
            // TODO: Don't manipulate $editor directly
            $editor.find('.cell').each(function () {
                const $cell = $(this);

                const x = parseInt($cell.attr('data-x'), 10);
                const y = parseInt($cell.attr('data-y'), 10);

                $cell.attr('data-color', getPaletteIndex(
                    getColorsAt(x, y, 1, 1)[0]
                ));
            }).end()
                .trigger('refresh');
        })
        .on('click', '[data-method="edges-outside"]', function () {
            // TODO: Don't manipulate $editor directly
            $editor.find('.cell').each(function () {
                const $cell = $(this);

                let x = parseInt($cell.attr('data-x'), 10) * 2;
                let y = parseInt($cell.attr('data-y'), 10) * 2;

                if (x >= context.canvas.width / 2) {
                    x += 1;
                }

                if (y >= context.canvas.height / 2) {
                    y += 1;
                }

                $cell.attr('data-color', getPaletteIndex(
                    getColorsAt(x, y, 1, 1)[0]
                ));
            }).end()
                .trigger('refresh');
        })
        .on('click', '[data-method="edges-inside"]', function () {
            // TODO: Don't manipulate $editor directly
            $editor.find('.cell').each(function () {
                const $cell = $(this);

                let x = 1 + parseInt($cell.attr('data-x'), 10) * 2;
                let y = 1 + parseInt($cell.attr('data-y'), 10) * 2;

                if (x >= context.canvas.width / 2) {
                    x -= 1;
                }

                if (y >= context.canvas.height / 2) {
                    y -= 1;
                }

                $cell.attr('data-color',
                    getPaletteIndex(getColorsAt(x, y, 1, 1)[0]));
            }).end()
                .trigger('refresh');
        });

    $tools
        .on('click', function () {
            $(this)
                .toggleClass('is-active')
                .siblings()
                .removeClass('is-active');
        })
        .on('click', '[data-tool="paste-color"]', () => {
            const pastedPixels = Clipboard.get().colors;

            textureEditor.pixels(
                pastedPixels.map((c) =>
                    getPaletteIndex(
                        _.sortBy(_.clone(palette), (d) => d.distance(c))[0]
                    )
                )
            );
        })
        .on('click', '[data-tool="paste-indices"]', () => {
            const pastedPixels = Clipboard.get().pixels;

            textureEditor.pixels(pastedPixels);
        })
        .on('click', '[data-tool="copy"]', () => {
            Clipboard.set({
                width: editorWidth,
                height: editorHeight,

                pixels: textureEditor.pixels(),
                colors: textureEditor.pixels().map((d) => palette[d]),
            });
        });

    self.save = function () {
        $save.addClass('is-loading');

        library.set(zip.entry.entryName, textureEditor.pixels(), () => {
            $save.removeClass('is-loading');

            $('#files').trigger('refresh');
        });
    };

    $save.on('click', self.save);

    self.getTab = () => zip.short;

    self.getPane = () => $pane;

    let colorPicker;

    self.activate = () => {
        if (colorPicker) {
            return;
        }

        const $pickerContainer = $pane.find('.js-color-picker');
        const $pickerInput = $pickerContainer.parent();

        colorPicker = new CP($pickerInput[0], 'click', $pickerContainer[0]);

        colorPicker.on('change', function (color) {
            globalTransparencyColor = `#${color}`;
            updateTransparencyColor();
        });

        colorPicker.fit = function () {
            this.self.style.left = this.self.style.top = '';
        };

        colorPicker.set(globalTransparencyColor);

        return self;
    };

    self.deactivate = () => self;

    self.destroy = () => {
        $source.off();
        $palette.find('li').off();
        $editor.off();
        $save.off();
        $autopilot.off();
        $tools.off();
    };

    return paneManager.add(self);
};

Editor.applies = (entry) => {
    let appliesExpression;

    if (window.GlobalValues.packFormat === 3) {
        appliesExpression = /textures\/(blocks|items).*\.png$/;
    } else if (window.GlobalValues.packFormat === 4) {
        appliesExpression = /textures\/(block|item).*\.png$/;
    }

    if (entry.entryName.indexOf('debug') >= 0) {
        return false;
    }

    if (entry.entryName.indexOf('clock_') >= 0) {
        return false;
    }

    if (entry.entryName.indexOf('compass_') >= 0) {
        return false;
    }

    return appliesExpression.test(entry.entryName);
};

Editor.getListEntry = (paneOrganizer, zip, entry) => {
    const caption = entry.entryName
        .replace(/^\/?assets\/minecraft\/textures\//, '');

    const $entry = $(entryTemplate({
        caption: caption,
        icon: 'fa fa-square',
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

    if (isDefined) {
        $entry.toggleClass('has-null',
            definition.some((d) => d === null));
    } else {
        $entry.removeClass('has-null');
    }
};

const fs = require('fs');
const extractor = require('../extractor');
const painter = require('../painter');
const ZipOrganizer = require('../organizer')('zip');

Editor.export = () => {
    const currentZip = ZipOrganizer.get();

    library.each((d, i) => {
        const entry = currentZip.getEntry(i);
        const assetFilename = `lo-rez/${i}`;

        if (!entry) {
            fs.unlink(assetFilename, () => {
                console.warn(`Legacy asset removed: ${i}`);
            });

            return;
        }

        const src = makeBase64(entry.getData());

        extractor(src, (result) => {
            const data = painter(result, d)
                .replace(/^data:image\/\w+;base64,/, '');

            const buffer = Buffer.from(data, 'base64');

            fs.writeFile(assetFilename, buffer, (error) => {
                if (error) {
                    console.error(error);
                }
            });
        });
    });
};

module.exports = Editor;

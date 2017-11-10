/* global $ */

const _ = require('lodash');
const doT = require('dot');

const Library = require('../library');
const library = new Library('lo-rez/textures.jsonl');

require('../organizer')('texture').set(library);

const Color = require('../color');

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

    let palette = [];
    let selectedColor = null;

    let drawing = false;
    let overEditor = null;

    let editorWidth = 0;
    let editorHeight = 0;

    let context;

    self.pixels = (pixels = []) => {
        if (pixels.length > 0) {
            let index = 0;

            $editor.find('.cell').each(function () {
                $(this).attr('data-color', pixels[index]);

                index += 1;
            });

            $editor.trigger('refresh');

            return self;
        }

        $editor.find('.cell').each(function () {
            const $cell = $(this);
            const color = $cell.attr('data-color');

            if (typeof color === 'undefined') {
                pixels.push(null);
            } else {
                pixels.push(parseInt(color, 10));
            }
        });

        return pixels;
    };

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
        $palette.find('li').removeClass('picked').each(function () {
            const $color = $(this);
            const color = palette[$color.index()].hex();

            $color.toggleClass('picked', inArray(picked, color));
        });
    };

    const getPaletteIndex = function (color) {
        return _.findIndex(palette, (d) => d.hex() === color.hex());
    };

    const setEditorValue = function ($cell, color) {
        $cell.attr('data-color', color).trigger('refresh');
    };

    const getEditorValue = function ($cell) {
        return $cell.attr('data-color');
    };

    const getEditorCell = function (x, y) {
        return $editor.find(`[data-x="${x}"][data-y="${y}"]`);
    };

    const fillNode = function (x, y, color, visited = []) {
        const $fillCell = getEditorCell(x, y);

        if (inArray(visited, $fillCell[0])) {
            return;
        }

        const oldValue = getEditorValue($fillCell);

        setEditorValue($fillCell, color);
        visited.push($fillCell[0]);

        _.each([
            [+1, 0],
            [-1, 0],
            [0, +1],
            [0, -1],
        ], function (d) {
            const $cell = getEditorCell(x + d[0], y + d[1]);
            const value = getEditorValue($cell);

            if (value === oldValue) {
                fillNode(x + d[0], y + d[1], color, visited);
            }
        });
    };

    const fillEditor = function () {
        fillNode(overEditor.x, overEditor.y, selectedColor);
    };

    // inefficient code for better understanding
    const matchKey = (char) => char.charCodeAt(0);

    $(document).on('keypress', function (event) {
        const char = event.charCode;

        if (char >= matchKey('1') && char <= matchKey('4')) {
            $palette.find('.picked').eq(char - 49).click();
        }

        if (char === matchKey('f') && overEditor) {
            fillEditor();
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
        $palette.find('li').removeClass('picked');
    });

    $(document).on('mouseup', function () {
        drawing = false;
    });

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

            $cell.css('background-color', colorValue);

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

        editorWidth = this.naturalWidth / targetDivider;
        editorHeight = this.naturalHeight / targetDivider;

        $source.css({
            width: `${sourceWidth}px`,
            height: `${sourceHeight}px`,
        });

        $editor.css({
            width: `${sourceWidth}px`,
            height: `${sourceHeight}px`,
        });

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

        palette = _.uniqBy(palette, (d) => d.hex());

        palette.forEach((color, index) => {
            const $color = $(`<li>
                <b style="background-color: ${color.rgba()};"></b>
            </li>`);

            $color.on('click', function () {
                $color.addClass('selected').siblings().removeClass('selected');

                selectedColor = index;
            });

            $palette.append($color);
        });

        _.each(_.range(editorHeight), (y) => {
            const $row = $('<div class="row" />');

            _.each(_.range(editorWidth), (x) => {
                const $cell = $('<div class="cell" />');

                $cell.attr('data-x', x);
                $cell.attr('data-y', y);

                $row.append($cell);
            });

            $editor.append($row);
        });

        $previews.filter('.source')
            .css('background-image', `url(${preview.toDataURL()})`);

        self.pixels(library.get(zip.entry.entryName));

        $editor.trigger('refresh');
    });

    $editor.on('mouseenter', '.cell', function () {
        if (!context) {
            return;
        }

        const $cell = $(this);
        const x = parseInt($cell.attr('data-x'), 10);
        const y = parseInt($cell.attr('data-y'), 10);

        overEditor = {x, y};

        const detected = _.map(getColorsAt(x * 2, y * 2, 2, 2),
            (d) => d.hex());

        highlightColors(detected);
    });

    $editor.on('mouseleave', function () {
        $palette.find('li').removeClass('picked');

        overEditor = null;
    });

    $editor.on('mousedown', function () {
        drawing = true;
    });

    $editor.on('mousedown mousemove', '.cell', function (event) {
        event.preventDefault();

        if (!drawing && event.type === 'mousemove') {
            return;
        }

        setEditorValue($(this), selectedColor);
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
            $(this).toggleClass('is-active');
        })
        .on('click', '[data-method="nearest"]', function () {
            $editor.find('.cell').each(function () {
                const $cell = $(this);

                $cell.attr('data-color', getPaletteIndex(
                    getAutoPilotPalette.apply($cell)[0]
                ));
            }).end()
                .trigger('refresh');
        })
        .on('click', '[data-method="farest"]', function () {
            $editor.find('.cell').each(function () {
                const $cell = $(this);

                $cell.attr('data-color', getPaletteIndex(
                    getAutoPilotPalette.apply($cell).reverse()[0]
                ));
            }).end()
                .trigger('refresh');
        })
        .on('click', '[data-method="top-left"]', function () {
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

    self.save = function () {
        $save.addClass('is-loading');

        library.set(zip.entry.entryName, self.pixels(), () => {
            $save.removeClass('is-loading');

            $('#files').trigger('refresh');
        });
    };

    $save.on('click', self.save);

    self.getTab = () => zip.short;

    self.getPane = () => $pane;

    self.destroy = () => {
        $source.off();
        $palette.find('li').off();
        $editor.off();
        $save.off();
        $autopilot.off();
    };

    return paneManager.add(self);
};

Editor.applies = (entry) => {
    if (entry.entryName.indexOf('debug') >= 0) {
        return false;
    }

    if (entry.entryName.indexOf('clock_') >= 0) {
        return false;
    }

    if (entry.entryName.indexOf('compass_') >= 0) {
        return false;
    }

    return (/textures\/(blocks|items).*\.png$/).test(entry.entryName);
};

Editor.getListEntry = (paneOrganizer, zip, entry) => {
    const caption = entry.entryName
        .replace(/^\/?assets\/minecraft\/textures\//, '');

    return $(entryTemplate({
        caption: caption,
        icon: 'fa fa-square',
    })).prop('zip', {
        zip: zip,
        entry: entry,
        editor: Editor,
        caption: caption,
        short: caption.match(/[\w\-_]+\.\w+$/)[0],
    }).on('click', function () {
        new Editor(paneOrganizer, $(this).prop('zip'));
    });
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

            const buffer = new Buffer(data, 'base64');

            fs.writeFile(assetFilename, buffer, (error) => {
                if (error) {
                    console.error(error);
                }
            });
        });
    });
};

module.exports = Editor;

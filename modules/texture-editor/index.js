/* global $, CP, getListEntry */

const fs = require('fs');

const _ = require('lodash');
const doT = require('dot');

const Library = require('../library');
const library = new Library('lo-rez/textures.jsonl');
const versions = require('../organizer')('versions').get();

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
const editorScale = viewScale * targetDivider;
const editorPreviewScale = sourcePreviewScale * targetDivider;

const inArray = (array, value) => _.indexOf(array, value) >= 0;

const makeBase64 = (data) => `data:image/png;base64,${data.toString('base64')}`;

const entryTemplate = doT.template(`<li>
    <i class="{{=it.icon}}"></i>
    {{=it.caption}}
</li>`);

const editorTemplate = doT.template(`<div>
    <div class="horizontal segments">
        <div class="source-view">
            <div class="live-texture-scroll">
                <img src="{{=it.source}}" class="live-texture" />
            </div>
        </div>

        <div class="editor-view">
            <div class="split-view">
                <div class="start">
                    <div class="live-texture-scroll">
                        <img src="../{{=it.exported}}" class="live-texture" />
                    </div>
                </div>
                <hr>
                <div class="end">
                    <div class="pixel-input"></div>
                </div>
            </div>
        </div>
    </div>

    <div class="horizontal segments">
        <ul class="frames"></ul>
    </div>

    <div class="horizontal segments">
        <ul class="palette"></ul>
    </div>

    <div class="horizontal segments previews">
        <div class="preview source">
            <div class="overlay texture-grid"></div>
        </div>

        <div
            class="preview exported"
            style="display: none; background-image: url(../{{=it.exported}});"
        >
            <div class="overlay texture-grid"></div>
        </div>

        <div class="preview editor">
            <div class="overlay texture-grid"></div>
        </div>
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

                    <a class="dropdown-item" data-method="random">
                        Random
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

        <button class="js-recover button is-danger is-small">Recover</button>

        <button class="js-save button is-info is-small">Save</button>
    </div>
</div>`);

const Editor = function (paneManager, zip) {
    const self = this;

    const source = makeBase64(zip.entry.getData());
    const exported = `lo-rez/${zip.entry.entryName}`;

    const $pane = $(editorTemplate({
        source,
        exported,
    }));

    const $source = $pane.find('.source-view .live-texture');
    const $export = $pane.find('.editor-view .live-texture');
    const $editor = $pane.find('.editor-view .pixel-input');

    const $frames = $pane.find('.frames');
    const $palette = $pane.find('.palette');
    const $previews = $pane.find('.preview');

    const $save = $pane.find('.js-save');
    const $recover = $pane.find('.js-recover');
    const $autopilot = $pane.find('.js-auto-pilot');
    const $tools = $pane.find('.js-texture-tools');

    let playing = false;
    let scrubbing = false;
    let frameCount = 0;
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

    const sourceDraw = (event) => {
        const x = Math.floor(event.offsetX / viewScale);
        const y = Math.floor(event.offsetY / viewScale);

        const tx = Math.floor(x / targetDivider);
        const ty = Math.floor(y / targetDivider);

        const detected = getPaletteIndex(getColorsAt(x, y, 1, 1)[0]);

        textureEditor.setPixel(tx, ty, detected);
    };

    $source.on('mousemove', (event) => {
        if (!context) {
            return;
        }

        const x = Math.floor(event.offsetX / viewScale);
        const y = Math.floor(event.offsetY / viewScale);

        const tx = Math.floor(x / targetDivider);
        const ty = Math.floor(y / targetDivider);

        const detected = _.map(getColorsAt(x, y, 1, 1), (d) => d.hex());

        highlightColors(detected);
        textureEditor.highlightPixel(tx, ty);
    });

    $source.on('mouseleave', () => {
        $palette.find('li').removeClass('picked').removeAttr('data-hotkey');
        textureEditor.highlightPixel();
    });

    $source.on('mousedown', (event) => {
        if (!context) {
            return;
        }

        $source.on('mousemove', sourceDraw);
        $source.on('mouseup', () => {
            $source.off('mousemove', sourceDraw);
            $source.off('mouseup');
        });

        sourceDraw(event);

        event.preventDefault();
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

    const loadImageFromUrl = (url, callback) => {
        const imageElement = document.createElement('img');

        imageElement.addEventListener('load', function () {
            callback(this);
        });

        imageElement.setAttribute('src', url);
    };

    $source.on('load', function () {
        const sourceWidth = this.naturalWidth * viewScale;
        const sourceHeight = this.naturalHeight * viewScale;

        editorWidth = this.naturalWidth / targetDivider;
        editorHeight = this.naturalHeight / targetDivider;

        $source.css({
            width: `${sourceWidth}px`,
            height: `${sourceHeight}px`,
        });

        $export.css({
            width: `${sourceWidth}px`,
            height: `${sourceHeight}px`,
        });

        textureEditor = new PixelPanel($editor, editorScale,
            editorWidth, editorHeight);

        // Is the texture's height a multiple of its width?
        if (
            (editorHeight > editorWidth) && (editorHeight % editorWidth === 0)
        ) {
            textureEditor.setFrameHeight(editorWidth);

            $source.parent().css({
                width: `${sourceWidth}px`,
                height: `${sourceWidth}px`,
            });

            $export.parent().css({
                width: `${sourceWidth}px`,
                height: `${sourceWidth}px`,
            });

            frameCount = editorHeight / editorWidth;

            for (let f = 0; f < frameCount; f += 1) {
                const $frame = $('<li class="frame" />').attr('data-frame', f);

                if (f === 0) {
                    $frame.addClass('active');
                }

                $frames.append($frame);
            }
        } else {
            $frames.parent().hide();
        }

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

    const activateFrameIndex = (frameIndex) => {
        textureEditor.setFrame(frameIndex);

        $source.css({
            top: `${frameIndex * (-editorWidth * editorScale)}px`,
        });

        $export.css({
            top: `${frameIndex * (-editorWidth * editorScale)}px`,
        });

        const $frame = $frames.find('[data-frame]').eq(frameIndex);

        $frame.addClass('active').siblings().removeClass('active');
    };

    const activateFrame = ($frame) => {
        if (!scrubbing) {
            return;
        }

        const frameIndex = parseInt($frame.attr('data-frame'), 10);

        activateFrameIndex(frameIndex);
    };

    const playFrame = () => {
        const frameIndexData = $frames.find('.active').attr('data-frame');
        let frameIndex = parseInt(frameIndexData, 10);

        frameIndex = (frameIndex + 1) % frameCount;
        activateFrameIndex(frameIndex);

        window.setTimeout(() => {
            if (playing) {
                window.requestAnimationFrame(playFrame);
            }
        }, 1000 / 4);
    };

    let lastSplit = 0;

    const setViewSplit = ($splitDrag, split) => {
        const $splitView = $splitDrag.parent();
        const $start = $splitView.find('.start');

        const finalSplit = Math.min(1, Math.max(0, split));

        $splitDrag.css({
            left: `${finalSplit * 100}%`,
        });

        $start.css({
            width: `${finalSplit * 100}%`,
        });

        $previews.filter('.exported').toggle(finalSplit > 0.5);
        $previews.filter('.editor').toggle(finalSplit <= 0.5);

        lastSplit = Math.round(finalSplit);
    };

    $pane.find('.split-view hr').each(function () {
        const $splitDrag = $(this);
        const $splitView = $splitDrag.parent();

        const mouseMove = (event) => {
            const bounds = $splitView[0].getBoundingClientRect();
            const split = (event.clientX - bounds.left) / bounds.width;

            setViewSplit($splitDrag, split);

            event.preventDefault();

            return false;
        };

        const mouseUp = () => {
            $(document).off('mousemove');
            $(document).off('mouseup', mouseUp);

            return false;
        };

        $splitDrag.on('mousedown', function () {
            $(document).on('mousemove', mouseMove);
            $(document).on('mouseup', mouseUp);

            event.preventDefault();

            return false;
        });
    });

    $frames.on('mousedown', '.frame', function () {
        const $frame = $(this);

        scrubbing = true;

        activateFrame($frame);

        return false;
    });

    $frames.on('mouseenter', '.frame', function () {
        const $frame = $(this);

        activateFrame($frame);

        return false;
    });

    $previews.on('mousemove', function ({offsetX, offsetY}) {
        const previewWidth = $(this).width();
        const previewHeight = $(this).height();

        const scale = 8 * editorPreviewScale;

        const gridX = offsetX - (previewWidth / 2) + (scale / 2);
        const gridY = offsetY - (previewHeight / 2) + (scale / 2);

        const choppedX = Math.floor(gridX / scale) * scale;
        const choppedY = Math.floor(gridY / scale) * scale;

        $previews.find('.overlay').css({
            width: `${scale}px`,
            height: `${scale}px`,
            left: `${(previewWidth / 2) - (scale / 2) + choppedX}px`,
            top: `${(previewHeight / 2) - (scale / 2) + choppedY}px`,
        });
    });

    const documentKeyPress = function (event) {
        if (event.which === matchKey('-')) {
            return setViewSplit($('.split-view hr'), lastSplit === 0 ? 1 : 0);
        }

        if (event.which === matchKey('q')) {
            return setViewSplit($('.split-view hr'), 0);
        }

        if (event.which === matchKey('e')) {
            return setViewSplit($('.split-view hr'), 1);
        }

        // Space
        if (event.which === 32) {
            playing = !playing;

            if (playing) {
                playFrame();
            }
        }
    };

    const documentMouseUp = () => {
        scrubbing = false;
    };

    $(document).on('keypress', documentKeyPress);
    $(document).on('mouseup', documentMouseUp);

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

    const getAutoPilotPaletteAt = function (x, y) {
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
        .on('click', '[data-method="random"]', function () {
            for (let y = 0; y < editorHeight; y += 1) {
                for (let x = 0; x < editorWidth; x += 1) {
                    const autoPalette = getAutoPilotPaletteAt(x, y);

                    textureEditor.setPixel(x, y, getPaletteIndex(
                        _.sample(autoPalette)
                    ));
                }
            }
        })
        .on('click', '[data-method="nearest"]', function () {
            for (let y = 0; y < editorHeight; y += 1) {
                for (let x = 0; x < editorWidth; x += 1) {
                    const autoPalette = getAutoPilotPaletteAt(x, y);

                    textureEditor.setPixel(x, y, getPaletteIndex(
                        _.head(autoPalette)
                    ));
                }
            }
        })
        .on('click', '[data-method="farest"]', function () {
            for (let y = 0; y < editorHeight; y += 1) {
                for (let x = 0; x < editorWidth; x += 1) {
                    const autoPalette = getAutoPilotPaletteAt(x, y);

                    textureEditor.setPixel(x, y, getPaletteIndex(
                        _.last(autoPalette)
                    ));
                }
            }
        })
        .on('click', '[data-method="top-left"]', function () {
            for (let y = 0; y < editorHeight; y += 1) {
                for (let x = 0; x < editorWidth; x += 1) {
                    textureEditor.setPixel(x, y, getPaletteIndex(
                        getColorsAt(x, y, 1, 1)[0]
                    ));
                }
            }
        })
        .on('click', '[data-method="edges-outside"]', function () {
            const canvasWidth = context.canvas.width;

            for (let y = 0; y < editorHeight; y += 1) {
                for (let x = 0; x < editorWidth; x += 1) {
                    let cx = x * 2;
                    let cy = y * 2;

                    if ((cx) >= canvasWidth / 2) {
                        cx += 1;
                    }

                    if ((cy % canvasWidth) >= canvasWidth / 2) {
                        cy += 1;
                    }

                    textureEditor.setPixel(x, y, getPaletteIndex(
                        getColorsAt(cx, cy, 1, 1)[0]
                    ));
                }
            }
        })
        .on('click', '[data-method="edges-inside"]', function () {
            const canvasWidth = context.canvas.width;

            for (let y = 0; y < editorHeight; y += 1) {
                for (let x = 0; x < editorWidth; x += 1) {
                    let cx = x * 2 + 1;
                    let cy = y * 2 + 1;

                    if ((cx) >= canvasWidth / 2) {
                        cx -= 1;
                    }

                    if ((cy % canvasWidth) >= canvasWidth / 2) {
                        cy -= 1;
                    }

                    textureEditor.setPixel(x, y, getPaletteIndex(
                        getColorsAt(cx, cy, 1, 1)[0]
                    ));
                }
            }
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

        versions.set(zip.entry.entryName, window.getSelectedVersion());
        library.set(zip.entry.entryName, textureEditor.pixels(), () => {
            $save.removeClass('is-loading');

            $('#files').trigger('refresh');
        });
    };

    self.recover = function () {
        $recover.addClass('is-loading');

        fs.readFile(exported, (error, recoveryData) => {
            $recover.removeClass('is-loading');

            if (error) {
                return;
            }

            loadImageFromUrl(makeBase64(recoveryData), (result) => {
                const recoveryCanvas = document.createElement('canvas');
                const recoverContext = recoveryCanvas.getContext('2d');

                recoveryCanvas.width = result.naturalWidth;
                recoveryCanvas.height = result.naturalHeight;

                recoverContext.drawImage(result, 0, 0);

                for (let y = 0; y < recoveryCanvas.height; y += 1) {
                    for (let x = 0; x < recoveryCanvas.width; x += 1) {
                        const pixel = recoverContext.getImageData(x, y, 1, 1);
                        const color = new Color(pixel.data);

                        textureEditor.setPixel(x, y, getPaletteIndex(
                            _.sortBy(palette, (d) => d.distance(color))[0]
                        ));
                    }
                }
            });
        });
    };

    $save.on('click', self.save);

    $recover.on('click', self.recover);

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
        $previews.off();
        $editor.off();
        $save.off();
        $recover.off();
        $autopilot.off();
        $tools.off();
        $(document).off('keypress', documentKeyPress);
        $(document).off('mouseup', documentMouseUp);
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

const extractor = require('../extractor');
const painter = require('../painter');
const ZipOrganizer = require('../organizer')('zip');

Editor.verifyListEntry = (properties, $listEntry) => {
    $listEntry.removeClass('verified verified-error');

    let error = false;

    extractor(makeBase64(properties.entry.getData()), (result) => {
        const definition = library.get(properties.entry.entryName);

        if (!definition) {
            error = true;

            return;
        }

        if (definition.some((d) => d === null)) {
            error = true;
        }

        if (Math.max(...definition) >= result.palette.length) {
            error = true;
        }

        if (!error) {
            $listEntry.addClass('verified');
        } else {
            $listEntry.addClass('verified-error');
        }
    });
};

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

        extractor(makeBase64(entry.getData()), (result) => {
            const $listEntry = getListEntry(i);

            try {
                $listEntry.removeClass('has-export-error');

                const data = painter(result, d)
                    .replace(/^data:image\/\w+;base64,/, '');

                const buffer = Buffer.from(data, 'base64');

                fs.writeFile(assetFilename, buffer, (error) => {
                    if (error) {
                        console.error(error);
                    }
                });
            } catch (error) {
                $listEntry.addClass('has-export-error');
            }
        });
    });
};

module.exports = Editor;

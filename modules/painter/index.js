const _ = require('lodash');

const paint = function (result, texture, scale = 1) {
    const width = result.width / 2;
    const height = result.height / 2;
    const palette = result.palette;

    const canvas = document.createElement('canvas');

    canvas.width = width * scale;
    canvas.height = height * scale;

    const context = canvas.getContext('2d');

    _.each(texture, function (d, i) {
        const x = i % width;
        const y = Math.floor(i / width);

        if (d === null) {
            throw new Error('Will not paint null pixels');
        }

        if (d >= palette.length) {
            throw new Error('Pixel out of palette bounds');
        }

        context.fillStyle = palette[d].rgba();
        context.fillRect(x * scale, y * scale, scale, scale);
    });

    return canvas.toDataURL('image/png', 1.0);
};

const extractor = require('../extractor');
const organize = require('../organizer');
const ZipOrganizer = organize('zip');
const TextureOrganizer = organize('texture');

paint.drawToCanvas = (width, palette, pixels, scale = 1) => {
    const height = pixels.length / width;

    const canvas = document.createElement('canvas');

    canvas.width = width * scale;
    canvas.height = height * scale;

    const context = canvas.getContext('2d');

    _.each(pixels, function (d, i) {
        const x = i % width;
        const y = Math.floor(i / width);

        let colorValue = 'transparent';

        if (d !== null) {
            colorValue = palette[d].rgba();
        }

        context.fillStyle = colorValue;
        context.fillRect(x * scale, y * scale, scale, scale);
    });

    return canvas;
};

paint.resolveTexture = function (textureName, callback) {
    const entryName = `assets/minecraft/textures/${textureName}.png`;
    const entry = ZipOrganizer.get().getEntry(entryName);

    if (!entry) {
        console.warn(`No such texture: ${textureName}`);

        return callback('');
    }

    const src = `data:image/png;base64,${entry.getData().toString('base64')}`;

    if (TextureOrganizer.get().has(entryName)) {
        extractor(src, function (result) {
            callback(paint(result, TextureOrganizer.get().get(entryName), 2));
        });

        return;
    }

    callback(src);
};

module.exports = paint;

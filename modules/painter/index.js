/* jshint browser:true */

'use strict';

const _ = require('lodash');

let paint = function (result, texture, scale) {
    let width = result.width / 2;
    let height = result.height / 2;

    if (!scale) {
        scale = 1;
    }

    let canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;

    let context = canvas.getContext('2d');

    _.each(texture, function (d, i) {
        let x = i % width;
        let y = Math.floor(i / width);

        let colorValue = 'transparent';

        if (d !== null) {
            colorValue = result.palette[d].rgba();
        }

        context.fillStyle = colorValue;
        context.fillRect(x * scale, y * scale, scale, scale);
    });

    return canvas.toDataURL();
};

const extractor = require('../extractor');
const organize = require('../organizer');
const ZipOrganizer = organize('zip');
const TextureOrganizer = organize('texture');

paint.resolveTexture = function (textureName, callback) {
    let entryName = `assets/minecraft/textures/${textureName}.png`;
    let entry = ZipOrganizer.get().getEntry(entryName);
    let src = 'data:image/png;base64,' + entry.getData().toString('base64');

    if (TextureOrganizer.get().has(entryName)) {
        extractor(src, function (result) {
            callback(paint(result, TextureOrganizer.get().get(entryName), 2));
        });
    }

    callback(src);
};

module.exports = paint;

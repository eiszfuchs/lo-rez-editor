/* global $ */

const _ = require('lodash');

const THREE = require('three');

const Color = require('../color');

const painter = require('../painter');

const makeCanvas = (src, callback) => {
    const $img = $('<img />').on('load', function () {
        const sourceCanvas = document.createElement('canvas');
        const sourceWidth = this.naturalWidth;
        const sourceHeight = this.naturalHeight;

        sourceCanvas.width = sourceWidth;
        sourceCanvas.height = sourceHeight;

        const sourceContext = sourceCanvas.getContext('2d');

        sourceContext.save();
        sourceContext.translate(sourceWidth / 2, sourceHeight / 2);
        sourceContext.drawImage(this, sourceWidth / -2, sourceHeight / -2);
        sourceContext.restore();

        callback(sourceCanvas);
    });

    $img.attr('src', src);
};

const range = function *(from, to) {
    if (from % 1 !== 0) {
        throw new Error('Need integers to work');
    }

    if (to % 1 !== 0) {
        throw new Error('Need integers to work');
    }

    const direction = to - from > 0 ? +1 : -1;

    if (direction < 0) {
        from += direction;
        to += direction;
    }

    for (let i = from; i !== to; i += direction) {
        yield i;
    }
};

const Vector3 = function ([x, y, z]) {
    const self = this;

    self.x = x;
    self.y = y;
    self.z = z;

    return self;
};

const Resolver = {
    getFallbackUv: (element, faceName) => {
        const from = new Vector3(element.from);
        const to = new Vector3(element.to);

        let min = [0, 0];
        let max = [16, 16];

        if (faceName === 'north') {
            min = [from.x, from.y];
            max = [to.x, to.y];
        }

        if (faceName === 'south') {
            min = [from.x, from.y];
            max = [to.x, to.y];
        }

        if (faceName === 'east') {
            min = [from.z, from.y];
            max = [to.z, to.y];
        }

        if (faceName === 'west') {
            min = [from.z, from.y];
            max = [to.z, to.y];
        }

        if (faceName === 'up') {
            min = [from.z, from.x];
            max = [to.z, to.x];
        }

        if (faceName === 'down') {
            min = [from.z, from.x];
            max = [to.z, to.x];
        }

        return {min, max};
    },

    resolveTextureReference: (texture, textures) => {
        let faceTexture = texture;

        while (faceTexture.startsWith('#')) {
            faceTexture = faceTexture.replace('#', '');
            if (!_.has(textures, faceTexture)) {
                // create dummy image here

                return null;
            }

            faceTexture = textures[faceTexture];
        }

        return faceTexture;
    },

    iterateOverUv: function *(face, min, max) {
        let uvDef;

        if (!_.has(face, 'uv')) {
            uvDef = [min[0], min[1], max[0], max[1]];
        } else {
            uvDef = face.uv;
        }

        const [uvX1, uvY1, uvX2, uvY2] = uvDef;

        const minX = _.min([uvX1, uvX2]);
        const minY = _.min([uvY1, uvY2]);
        const maxX = _.max([uvX1, uvX2]);
        const maxY = _.max([uvY1, uvY2]);

        const width = maxX - minX;
        const height = maxY - minY;

        yield {width, height};

        let yi = 0;

        for (const y of range(uvY1, uvY2)) {
            let xi = 0;

            for (const x of range(uvX1, uvX2)) {
                yield {x, y, xi, yi};

                xi += 1;
            }

            yi += 1;
        }
    },

    rotateCanvas: (imageCanvas, rotation, callback) => {
        const oldWidth = imageCanvas.width;
        const oldHeight = imageCanvas.height;

        const imageContext = imageCanvas.getContext('2d');

        const [newHeight, newWidth] = [oldWidth, oldHeight];

        const rotatedCanvas = document.createElement('canvas');
        const rotatedContext = rotatedCanvas.getContext('2d');

        rotatedCanvas.width = newWidth;
        rotatedCanvas.height = newHeight;

        rotatedContext.clearRect(0, 0, newWidth, newHeight);

        for (let y = 0; y < newHeight; y += 1) {
            for (let x = 0; x < newWidth; x += 1) {
                const imageData = imageContext.getImageData(y, x, 1, 1);

                rotatedContext.putImageData(imageData, x, y);
            }
        }

        rotation -= 90;

        if (rotation === 0) {
            callback(rotatedCanvas);

            return;
        }

        Resolver.rotateCanvas(rotatedCanvas, rotation, callback);
    },

    resolveTextureUV: (face, data, min, max, callback) => {
        const faceTexture = Resolver.resolveTextureReference(face.texture, data.textures);

        painter.resolveTexture(faceTexture, (src) => {
            makeCanvas(src, (canvas) => {
                const context = canvas.getContext('2d');

                const uvIterator = Resolver.iterateOverUv(face, min, max);
                const {width, height} = uvIterator.next().value;

                const imageCanvas = document.createElement('canvas');
                const imageContext = imageCanvas.getContext('2d');

                imageCanvas.width = width;
                imageCanvas.height = height;

                imageContext.clearRect(0, 0, width, height);

                if (faceTexture === null) {
                    callback(imageCanvas);

                    return;
                }

                for (const {x, y, xi, yi} of uvIterator) {
                    const pixel = context.getImageData(x, y, 1, 1);
                    const pixelData = pixel.data;
                    const color = new Color(pixelData);

                    imageContext.fillStyle = color.rgba();
                    imageContext.fillRect(xi, yi, 1, 1);
                }

                if (_.has(face, 'rotation')) {
                    Resolver.rotateCanvas(imageCanvas, face.rotation, callback);

                    return;
                }

                callback(imageCanvas);
            });
        });
    },

    getTextureMaterial: (face, data, min, max, callback) => {
        Resolver.resolveTextureUV(face, data, min, max, function (textureUV) {
            const textureCanvas = new THREE.CanvasTexture(textureUV);

            textureCanvas.magFilter = THREE.NearestFilter;
            textureCanvas.minFilter = THREE.NearestFilter;

            callback(new THREE.MeshBasicMaterial({
                map: textureCanvas,
                transparent: true,
                alphaTest: 0.5,
                // depthWrite: false,
                // depthTest: false,
            }));
        });
    },

    getFaceImage: (face, data, callback) => {
        const faceTexture = Resolver.resolveTextureReference(face.texture, data.textures);

        painter.resolveTexture(faceTexture, callback);
    },

    getUvDebugImage: (face, data, min, max, callback) => {
        const faceTexture = Resolver.resolveTextureReference(face.texture, data.textures);

        painter.resolveTexture(faceTexture, (src) => {
            makeCanvas(src, (canvas) => {
                const context = canvas.getContext('2d');

                const uvIterator = Resolver.iterateOverUv(face, min, max);
                const {width, height} = uvIterator.next().value;

                for (const {x, y, xi, yi} of uvIterator) {
                    const pixel = context.getImageData(x, y, 1, 1);

                    pixel.data[0] = Math.floor(0xff * (xi / (width - 1)));
                    pixel.data[1] = Math.floor(0xff * (yi / (height - 1)));
                    pixel.data[2] = 0x00;
                    pixel.data[3] = 0xff;

                    context.putImageData(pixel, x, y);
                }

                callback(canvas.toDataURL('image/png', 1.0));
            });
        });
    },
};

module.exports = Resolver;

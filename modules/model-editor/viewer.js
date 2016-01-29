/* jshint browser:true, jquery:true */

'use strict';

const _ = require('lodash');

const THREE = require('three');
const π = Math.PI;

const Color = require('../color');

const painter = require('../painter');

const width = 240; // to match texture editor: 160
const height = 240; // to match texture editor: 160

let guideLineMaterial = new THREE.MeshBasicMaterial({ wireframe: true });
var lineMaterial = new THREE.LineBasicMaterial({ color: 0x999999 });

const resolveTextureUV = function (face, data, callback) {
    if (!_.has(face, 'uv')) {
        face.uv = [0, 0, 16, 16];
    }

    let minX = face.uv[0];
    let minY = face.uv[1];
    let maxX = face.uv[2];
    let maxY = face.uv[3];

    minX = _.min([minX, maxX]);
    minY = _.min([minY, maxY]);
    maxX = _.max([minX, maxX]);
    maxY = _.max([minY, maxY]);

    let width = Math.abs(maxX - minX);
    let height = Math.abs(maxY - minY);

    let imageCanvas = document.createElement('canvas');
    let context = imageCanvas.getContext('2d');

    imageCanvas.width = width;
    imageCanvas.height = height;

    context.clearRect(0, 0, width, height);

    let faceTexture = face.texture;

    while (faceTexture.startsWith('#')) {
        faceTexture = faceTexture.replace('#', '');
        if (!_.has(data.textures, faceTexture)) {
            // create dummy image here

            callback(imageCanvas);

            return;
        }

        faceTexture = data.textures[faceTexture];
    }

    let $img = $('<img />').on('load', function () {
        let sourceCanvas = document.createElement('canvas');
        sourceCanvas.width = this.naturalWidth;
        sourceCanvas.height = this.naturalHeight;

        let sourceContext = sourceCanvas.getContext('2d');
        sourceContext.drawImage(this, 0, 0);

        _.each(_.range(minY, maxY), function (y) {
            _.each(_.range(minX, maxX), function (x) {
                let pixel = sourceContext.getImageData(x, y, 1, 1);
                let color = new Color(pixel.data);

                context.fillStyle = color.rgba();
                context.fillRect(x - minX, y - minY, 1, 1);
            });
        });

        callback(imageCanvas);
    });

    painter.resolveTexture(faceTexture, function (src) {
        $img.attr('src', src);
    });
};

const getTextureMaterial = function (face, data, callback) {
    resolveTextureUV(face, data, function (textureUV) {
        let textureCanvas = new THREE.CanvasTexture(textureUV);

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
};

const letters = require('./alphabet.js');

const addLetter = function (parent, letter) {
    let letterElement = new THREE.Object3D();

    if (_.has(letters, letter)) {
        _.each(letters[letter], function (line) {
            let geometry = new THREE.Geometry();

            _.each(line, function (point) {
                geometry.vertices.push(new THREE.Vector3(point[0], point[1], 0));
            });

            letterElement.add(new THREE.Line(geometry, lineMaterial));
        });
    }

    parent.add(letterElement);

    return letterElement;
};

const addCube = function (parent, element, data) {
    let from = new THREE.Vector3();
    let to = new THREE.Vector3();

    from.fromArray(element.from);
    to.fromArray(element.to);

    let min = new THREE.Vector3(_.min([from.x, to.x]), _.min([from.y, to.y]), _.min([from.z, to.z]));
    let max = new THREE.Vector3(_.max([from.x, to.x]), _.max([from.y, to.y]), _.max([from.z, to.z]));

    let planes = [];

    // east
    if (_.has(element.faces, 'east')) {
        planes.push({
            p: {x: max.x, y: min.y + (max.y - min.y) / 2, z: min.z + (max.z - min.z) / 2},
            r: {x: 0, y: π / +2, z: 0},
            w: max.z - min.z, h: max.y - min.y,
            f: element.faces.east,
        });
    }

    // west
    if (_.has(element.faces, 'west')) {
        planes.push({
            p: {x: min.x, y: min.y + (max.y - min.y) / 2, z: min.z + (max.z - min.z) / 2},
            r: {x: 0, y: π / -2, z: 0},
            w: max.z - min.z, h: max.y - min.y,
            f: element.faces.west,
        });
    }

    // up
    if (_.has(element.faces, 'up')) {
        planes.push({
            p: {x: min.x + (max.x - min.x) / 2, y: max.y, z: min.z + (max.z - min.z) / 2},
            r: {x: π / -2, y: 0, z: 0},
            w: max.x - min.x, h: max.z - min.z,
            f: element.faces.up,
        });
    }

    // down
    if (_.has(element.faces, 'down')) {
        planes.push({
            p: {x: min.x + (max.x - min.x) / 2, y: min.y, z: min.z + (max.z - min.z) / 2},
            r: {x: π / +2, y: 0, z: 0},
            w: max.x - min.x, h: max.z - min.z,
            f: element.faces.down,
        });
    }

    // north
    if (_.has(element.faces, 'north')) {
        planes.push({
            p: {x: min.x + (max.x - min.x) / 2, y: min.y + (max.y - min.y) / 2, z: max.z},
            r: {x: 0, y: 0, z: 0},
            w: max.x - min.x, h: max.y - min.y,
            f: element.faces.north,
        });
    }

    // south
    if (_.has(element.faces, 'south')) {
        planes.push({
            p: {x: min.x + (max.x - min.x) / 2, y: min.y + (max.y - min.y) / 2, z: min.z},
            r: {x: π, y: 0, z: π},
            w: max.x - min.x, h: max.y - min.y,
            f: element.faces.south,
        });
    }

    planes.forEach(function (planeStruct) {
        getTextureMaterial(planeStruct.f, data, function (material) {
            let geometry = new THREE.PlaneGeometry(planeStruct.w, planeStruct.h);
            let plane = new THREE.Mesh(geometry, material);

            plane.position.x = planeStruct.p.x;
            plane.position.y = planeStruct.p.y;
            plane.position.z = planeStruct.p.z;
            plane.rotation.x = planeStruct.r.x;
            plane.rotation.y = planeStruct.r.y;
            plane.rotation.z = planeStruct.r.z;

            parent.add(plane);
        });
    });
};

let Viewer = function () {
    let self = this;

    let scene = new THREE.Scene();
    let camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    camera.position.x = camera.position.z = 20;
    camera.position.y = 16;
    camera.lookAt(new THREE.Vector3(0, 0, 0));

    let renderer = new THREE.WebGLRenderer({
        // antialias: true
    });

    let pivot = new THREE.Object3D();
    scene.add(pivot);

    let geometry = new THREE.PlaneGeometry(16, 16);
    let basePlane = new THREE.Mesh(geometry, guideLineMaterial);
    basePlane.position.y = -8;
    basePlane.rotation.x = π / +2;
    pivot.add(basePlane);

    const center = function (object) {
        object.position.x -= 8;
        object.position.y -= 8;
        object.position.z -= 8;

        return object;
    };

    let xCaption = addLetter(pivot, 'X');
    xCaption.position.x = 18;
    xCaption.lookAt(new THREE.Vector3());
    center(xCaption);

    let yCaption = addLetter(pivot, 'Y');
    yCaption.position.y = 18;
    yCaption.lookAt(new THREE.Vector3());
    center(yCaption);

    let zCaption = addLetter(pivot, 'Z');
    zCaption.position.z = 18;
    zCaption.lookAt(new THREE.Vector3());
    center(zCaption);

    let preview = new THREE.Object3D();
    pivot.add(center(preview));

    renderer.setSize(width, height);

    let rendering = false;
    let dragging = false;

    let dragPosition;

    const approx = function (value, target) {
        value -= target;
        value *= 0.95;
        value += target;

        return value;
    };

    const update = function () {
        if (dragging) {
            return;
        }

        pivot.rotation.x = approx(pivot.rotation.x, 0);
        pivot.rotation.y += 0.005;
        pivot.rotation.z = approx(pivot.rotation.z, 0);
    };

    const render = function () {
        if (rendering) {
            requestAnimationFrame(render);
        }

        update();

        camera.updateProjectionMatrix();
        renderer.render(scene, camera);
    };

    const clearPreview = function () {
        for (let i = preview.children.length - 1; i >= 0; i--) {
            preview.remove(preview.children[i]);
        }
    };

    self.update = _.throttle(function (data) {
        if (typeof data === 'string') {
            data = JSON.parse(data);
        }

        if (!_.has(data, 'elements')) {
            return self;
        }

        clearPreview();
        data.elements.forEach(function (element) {
            addCube(preview, element, data);
        });

        return self;
    }, 100);

    self.start = function () {
        rendering = true;
        render();

        return self;
    };

    self.stop = function () {
        rendering = false;

        return self;
    };

    self.appendTo = function ($parent) {
        let $dom = $(renderer.domElement);

        let mouseMove = function (event) {
            let moveDelta = new THREE.Vector2(
                event.offsetX - dragPosition.x,
                event.offsetY - dragPosition.y
            );

            let deltaQuaternion = new THREE.Quaternion()
                .setFromEuler(new THREE.Euler(
                    moveDelta.y * (π / 180),
                    moveDelta.x * (π / 180),
                    0,
                    'XYZ'
                ));

            pivot.quaternion.multiplyQuaternions(deltaQuaternion, pivot.quaternion);

            dragPosition.x = event.offsetX;
            dragPosition.y = event.offsetY;

            event.preventDefault();

            return false;
        };

        $dom.on('mousedown', function (event) {
            dragPosition = new THREE.Vector2(event.offsetX, event.offsetY);

            dragging = true;
            $dom.on('mousemove', mouseMove);
        });

        $(document).on('mouseup', function () {
            dragging = false;
            $dom.off('mousemove', mouseMove);
        });

        $parent.append($dom.addClass('viewer'));

        return self;
    };

    return self;
};

module.exports = Viewer;

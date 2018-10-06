/* global $ */

const _ = require('lodash');

const THREE = require('three');
const π = Math.PI;

const Color = require('../color');

const painter = require('../painter');

const VIEWER_WIDTH = 280;
const VIEWER_HEIGHT = 240;

const guideLineMaterial = new THREE.MeshBasicMaterial({wireframe: true});
const elementLineMaterial = new THREE.MeshBasicMaterial({wireframe: true, depthTest: false, color: 0xAAAAAA});
const lineMaterial = new THREE.LineBasicMaterial({color: 0x999999});

const resolveTextureUV = function (face, data, callback) {
    if (!_.has(face, 'uv')) {
        face.uv = [0, 0, 16, 16];
    }

    const [uvX1, uvY1, uvX2, uvY2] = face.uv;

    const minX = _.min([uvX1, uvX2]);
    const minY = _.min([uvY1, uvY2]);
    const maxX = _.max([uvX1, uvX2]);
    const maxY = _.max([uvY1, uvY2]);

    const width = Math.abs(maxX - minX);
    const height = Math.abs(maxY - minY);

    const imageCanvas = document.createElement('canvas');
    const context = imageCanvas.getContext('2d');

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

    const $img = $('<img />').on('load', function () {
        const sourceCanvas = document.createElement('canvas');
        const sourceWidth = this.naturalWidth;
        const sourceHeight = this.naturalHeight;

        sourceCanvas.width = sourceWidth;
        sourceCanvas.height = sourceHeight;

        const sourceContext = sourceCanvas.getContext('2d');

        sourceContext.save();
        sourceContext.translate(sourceWidth / 2, sourceHeight / 2);
        if (_.has(face, 'rotation')) {
            sourceContext.rotate(face.rotation * π / -180);
        }
        sourceContext.drawImage(this, sourceWidth / -2, sourceHeight / -2);
        sourceContext.restore();

        let uvXrange = _.range(minX, maxX);
        let uvYrange = _.range(minY, maxY);

        if (uvX2 === minX) {
            uvXrange = uvXrange.reverse();
        }

        if (uvY2 === minY) {
            uvYrange = uvYrange.reverse();
        }

        let drawY = 0;

        _.each(uvYrange, function (y) {
            let drawX = 0;

            _.each(uvXrange, function (x) {
                const pixel = sourceContext.getImageData(x, y, 1, 1);
                const color = new Color(pixel.data);

                context.fillStyle = color.rgba();
                context.fillRect(drawX, drawY, 1, 1);

                drawX += 1;
            });

            drawY += 1;
        });

        callback(imageCanvas);
    });

    painter.resolveTexture(faceTexture, function (src) {
        $img.attr('src', src);
    });
};

const getTextureMaterial = function (face, data, callback) {
    resolveTextureUV(face, data, function (textureUV) {
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
};

const letters = require('./alphabet.js');

const addLetter = function (parent, letter) {
    const letterElement = new THREE.Object3D();

    if (_.has(letters, letter)) {
        _.each(letters[letter], function (line) {
            const geometry = new THREE.Geometry();

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
    const from = new THREE.Vector3();
    const to = new THREE.Vector3();

    from.fromArray(element.from);
    to.fromArray(element.to);

    const min = new THREE.Vector3(_.min([from.x, to.x]), _.min([from.y, to.y]), _.min([from.z, to.z]));
    const max = new THREE.Vector3(_.max([from.x, to.x]), _.max([from.y, to.y]), _.max([from.z, to.z]));

    const planes = [];

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
            p: {x: min.x + (max.x - min.x) / 2, y: min.y + (max.y - min.y) / 2, z: min.z},
            r: {x: π, y: 0, z: π},
            w: max.x - min.x, h: max.y - min.y,
            f: element.faces.north,
        });
    }

    // south
    if (_.has(element.faces, 'south')) {
        planes.push({
            p: {x: min.x + (max.x - min.x) / 2, y: min.y + (max.y - min.y) / 2, z: max.z},
            r: {x: 0, y: 0, z: 0},
            w: max.x - min.x, h: max.y - min.y,
            f: element.faces.south,
        });
    }

    planes.forEach(function (planeStruct) {
        getTextureMaterial(planeStruct.f, data, function (material) {
            const geometry = new THREE.PlaneGeometry(planeStruct.w, planeStruct.h);
            const plane = new THREE.Mesh(geometry, material);

            plane.position.x = planeStruct.p.x;
            plane.position.y = planeStruct.p.y;
            plane.position.z = planeStruct.p.z;
            plane.rotation.x = planeStruct.r.x;
            plane.rotation.y = planeStruct.r.y;
            plane.rotation.z = planeStruct.r.z;

            parent.add(plane);
        });
    });

    const elementDimensions = max.sub(min);
    const elementPosition = min.add(elementDimensions.clone().divideScalar(2));
    const elementBox = new THREE.BoxGeometry(elementDimensions.x, elementDimensions.y, elementDimensions.z);
    const elementMesh = new THREE.Mesh(elementBox, elementLineMaterial);

    elementMesh.position.x = elementPosition.x;
    elementMesh.position.y = elementPosition.y;
    elementMesh.position.z = elementPosition.z;

    parent.add(elementMesh);
};

const addGrid = (parent) => {
    const gridGeometry = new THREE.Geometry();

    for (let z = 0; z <= 16; z += 2) {
        for (let y = 0; y <= 16; y += 2) {
            for (let x = 0; x <= 16; x += 2) {
                if ((x !== 0 && x !== 16) && (y !== 0 && y !== 16) && (z !== 0 && z !== 16)) {
                    continue;
                }

                const dot = new THREE.Vector3(x, y, z);

                gridGeometry.vertices.push(dot);
            }
        }
    }

    const dotMaterial = new THREE.PointsMaterial({color: 0x666666, sizeAttenuation: false});
    const dotField = new THREE.Points( gridGeometry, dotMaterial );

    parent.add(dotField);
};

const Viewer = function () {
    const self = this;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, VIEWER_WIDTH / VIEWER_HEIGHT, 0.1, 1000);

    camera.position.x = camera.position.z = 20;
    camera.position.y = 16;
    camera.lookAt(new THREE.Vector3(0, -1, 0));

    const renderer = new THREE.WebGLRenderer({
        alpha: true,
    });

    const pivot = new THREE.Object3D();

    scene.add(pivot);

    const geometry = new THREE.PlaneGeometry(16, 16);
    const basePlane = new THREE.Mesh(geometry, guideLineMaterial);

    basePlane.position.y = -8;
    basePlane.rotation.x = π / +2;
    pivot.add(basePlane);

    const center = function (object) {
        object.position.x -= 8;
        object.position.y -= 8;
        object.position.z -= 8;

        return object;
    };

    const xCaption = addLetter(pivot, 'X');

    xCaption.position.x = 18;
    xCaption.lookAt(new THREE.Vector3());
    center(xCaption);

    const yCaption = addLetter(pivot, 'Y');

    yCaption.position.y = 18;
    yCaption.lookAt(new THREE.Vector3());
    center(yCaption);

    const zCaption = addLetter(pivot, 'Z');

    zCaption.position.z = 18;
    zCaption.lookAt(new THREE.Vector3());
    center(zCaption);

    const preview = new THREE.Object3D();

    pivot.add(center(preview));

    renderer.setSize(VIEWER_WIDTH, VIEWER_HEIGHT);
    renderer.setClearColor(0x000000, 0);

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

        // reset after dragging
        pivot.rotation.x = approx(pivot.rotation.x, 0);
        pivot.rotation.y += 0.002;
        pivot.rotation.z = approx(pivot.rotation.z, 0);
    };

    const render = function () {
        if (rendering) {
            requestAnimationFrame(render);
        }

        // Don't rotate for now
        // update();

        camera.updateProjectionMatrix();
        renderer.render(scene, camera);
    };

    const clearPreview = function () {
        for (let i = preview.children.length - 1; i >= 0; i -= 1) {
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

        addGrid(preview);

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
        const $dom = $(renderer.domElement);

        const mouseMove = function (event) {
            const moveDelta = new THREE.Vector2(
                event.offsetX - dragPosition.x,
                event.offsetY - dragPosition.y
            );

            const deltaQuaternion = new THREE.Quaternion()
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

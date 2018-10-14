/* global $ */

const _ = require('lodash');
const doT = require('dot');

const THREE = require('three');
const π = Math.PI;

const Resolver = require('./resolver.js');
const Layers = require('./layers.js');

const guideLineMaterial = new THREE.MeshBasicMaterial({wireframe: true});
const elementLineMaterial = new THREE.MeshBasicMaterial({wireframe: true, depthTest: false, color: 0xAAAAAA});
const lineMaterial = new THREE.LineBasicMaterial({color: 0x999999});

const viewerTemplate = doT.template(`<div class="ui-row">
    <div class="model-view rest"></div>

    <ul class="model-layers rest"></ul>
</div>`);

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

    const pivot = new THREE.Object3D();
    const anchor = new THREE.Object3D();

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
            u: Resolver.getFallbackUv(element, 'east'),
        });
    }

    // west
    if (_.has(element.faces, 'west')) {
        planes.push({
            p: {x: min.x, y: min.y + (max.y - min.y) / 2, z: min.z + (max.z - min.z) / 2},
            r: {x: 0, y: π / -2, z: 0},
            w: max.z - min.z, h: max.y - min.y,
            f: element.faces.west,
            u: Resolver.getFallbackUv(element, 'west'),
        });
    }

    // up
    if (_.has(element.faces, 'up')) {
        planes.push({
            p: {x: min.x + (max.x - min.x) / 2, y: max.y, z: min.z + (max.z - min.z) / 2},
            r: {x: π / -2, y: 0, z: 0},
            w: max.x - min.x, h: max.z - min.z,
            f: element.faces.up,
            u: Resolver.getFallbackUv(element, 'up'),
        });
    }

    // down
    if (_.has(element.faces, 'down')) {
        planes.push({
            p: {x: min.x + (max.x - min.x) / 2, y: min.y, z: min.z + (max.z - min.z) / 2},
            r: {x: π / +2, y: 0, z: 0},
            w: max.x - min.x, h: max.z - min.z,
            f: element.faces.down,
            u: Resolver.getFallbackUv(element, 'down'),
        });
    }

    // north
    if (_.has(element.faces, 'north')) {
        planes.push({
            p: {x: min.x + (max.x - min.x) / 2, y: min.y + (max.y - min.y) / 2, z: min.z},
            r: {x: π, y: 0, z: π},
            w: max.x - min.x, h: max.y - min.y,
            f: element.faces.north,
            u: Resolver.getFallbackUv(element, 'north'),
        });
    }

    // south
    if (_.has(element.faces, 'south')) {
        planes.push({
            p: {x: min.x + (max.x - min.x) / 2, y: min.y + (max.y - min.y) / 2, z: max.z},
            r: {x: 0, y: 0, z: 0},
            w: max.x - min.x, h: max.y - min.y,
            f: element.faces.south,
            u: Resolver.getFallbackUv(element, 'south'),
        });
    }

    planes.forEach(function (planeStruct) {
        Resolver.getTextureMaterial(planeStruct.f, data, planeStruct.u.min, planeStruct.u.max, function (material) {
            const geometry = new THREE.PlaneGeometry(planeStruct.w, planeStruct.h);
            const plane = new THREE.Mesh(geometry, material);

            plane.position.x = planeStruct.p.x;
            plane.position.y = planeStruct.p.y;
            plane.position.z = planeStruct.p.z;
            plane.rotation.x = planeStruct.r.x;
            plane.rotation.y = planeStruct.r.y;
            plane.rotation.z = planeStruct.r.z;

            anchor.add(plane);
        });
    });

    pivot.add(anchor);

    const elementDimensions = max.sub(min);
    const elementPosition = min.add(elementDimensions.clone().divideScalar(2));
    const elementBox = new THREE.BoxGeometry(elementDimensions.x, elementDimensions.y, elementDimensions.z);
    const elementMesh = new THREE.Mesh(elementBox, elementLineMaterial);

    elementMesh.position.x = elementPosition.x;
    elementMesh.position.y = elementPosition.y;
    elementMesh.position.z = elementPosition.z;

    anchor.add(elementMesh);

    // TODO: "rescale": true
    if (_.has(element, 'rotation')) {
        const rotation = element.rotation;
        const axisCall = `rotate${rotation.axis.toUpperCase()}`;

        const origin = new THREE.Vector3();

        origin.fromArray(rotation.origin);

        anchor.position.sub(origin);
        pivot.position.add(origin);

        pivot[axisCall](rotation.angle * (π / 180));
    }

    parent.add(pivot);

    return pivot;
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
    const dotField = new THREE.Points(gridGeometry, dotMaterial);

    parent.add(dotField);
};

let globalRotation = null;

const Viewer = function () {
    const self = this;

    const $wrapper = $(viewerTemplate({
    }));

    const layers = new Layers($wrapper.find('.model-layers'));

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);

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
    // xCaption.lookAt(new THREE.Vector3());
    center(xCaption);

    const yCaption = addLetter(pivot, 'Y');

    yCaption.position.y = 18;
    // yCaption.lookAt(new THREE.Vector3());
    center(yCaption);

    const zCaption = addLetter(pivot, 'Z');

    zCaption.position.z = 18;
    // zCaption.lookAt(new THREE.Vector3());
    center(zCaption);

    const orientAxisCaptions = () => {
        xCaption.lookAt(camera.position);
        yCaption.lookAt(camera.position);
        zCaption.lookAt(camera.position);
    };

    orientAxisCaptions();

    const preview = new THREE.Object3D();

    pivot.add(center(preview));

    // https://stackoverflow.com/a/45046955
    const updateCameraProperties = () => {
        const canvas = renderer.domElement;

        const width = canvas.clientWidth;
        const height = canvas.clientHeight;

        if (canvas.width !== width || canvas.height !== height) {
            renderer.setSize(width, height, false);
            renderer.setClearColor(0x000000, 0);

            camera.aspect = width / height;
            camera.updateProjectionMatrix();
        }
    };


    let rendering = false;

    let dragPosition;

    const render = function () {
        if (rendering) {
            requestAnimationFrame(render);
        }

        updateCameraProperties();
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
        layers.clear();

        data.elements.forEach(function (element) {
            const object = addCube(preview, element, data);

            layers.add(object, element, data);
        });

        addGrid(preview);

        return self;
    }, 100);

    self.start = function () {
        if (globalRotation) {
            pivot.rotation.x = globalRotation.x;
            pivot.rotation.y = globalRotation.y;
            pivot.rotation.z = globalRotation.z;

            orientAxisCaptions();
        }

        rendering = true;
        render();

        return self;
    };

    self.stop = function () {
        rendering = false;

        return self;
    };

    self.destroy = function () {
        self.stop();

        renderer.forceContextLoss();
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

            orientAxisCaptions();

            dragPosition.x = event.offsetX;
            dragPosition.y = event.offsetY;

            event.preventDefault();

            return false;
        };

        $dom.on('mousedown', function (event) {
            dragPosition = new THREE.Vector2(event.offsetX, event.offsetY);

            $dom.on('mousemove', mouseMove);
        });

        $(document).on('mouseup', function () {
            globalRotation = pivot.rotation.clone();

            $dom.off('mousemove', mouseMove);
        });

        $wrapper.find('.model-view').append($dom.addClass('viewer'));
        $parent.append($wrapper);

        return self;
    };

    return self;
};

module.exports = Viewer;

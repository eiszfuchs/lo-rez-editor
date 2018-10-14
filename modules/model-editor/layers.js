/* global $ */

const _ = require('lodash');
const doT = require('dot');

const Resolver = require('./resolver.js');

const layerTemplate = doT.template(`<li class="layer">
    <span class="visibility"><input type="checkbox" checked></span>
    <span class="vec3">
        <span class="from">{{=it.from}}</span>
        <span class="to">{{=it.to}}</span>
    </span>
    <span class="hidden face" data-dir="N"><img class="tex"><img class="uv"></span>
    <span class="hidden face" data-dir="S"><img class="tex"><img class="uv"></span>
    <span class="hidden face" data-dir="E"><img class="tex"><img class="uv"></span>
    <span class="hidden face" data-dir="W"><img class="tex"><img class="uv"></span>
    <span class="hidden face" data-dir="U"><img class="tex"><img class="uv"></span>
    <span class="hidden face" data-dir="D"><img class="tex"><img class="uv"></span>
</li>`);

const Layers = function ($wrapper) {
    const self = this;

    self.clear = () => {
        $wrapper.html('');

        return self;
    };

    self.add = (object, element, data) => {
        const $layer = $(layerTemplate({
            from: element.from.join(', '),
            to: element.to.join(', '),
        }));

        if (_.some(element.from, (d) => d % 2 !== 0)) {
            $layer.find('.from').addClass('error');
        }

        if (_.has(element.faces, 'north')) {
            $layer.find('[data-dir="N"]').removeClass('hidden');

            const {min, max} = Resolver.getFallbackUv(element, 'north');

            Resolver.getFaceImage(element.faces.north, data, (src) => {
                $layer.find('[data-dir="N"] .tex').attr('src', src);
            });

            Resolver.getUvDebugImage(element.faces.north, data, min, max, (src) => {
                $layer.find('[data-dir="N"] .uv').attr('src', src);
            });
        }

        if (_.has(element.faces, 'south')) {
            $layer.find('[data-dir="S"]').removeClass('hidden');

            const {min, max} = Resolver.getFallbackUv(element, 'south');

            Resolver.getFaceImage(element.faces.south, data, (src) => {
                $layer.find('[data-dir="S"] .tex').attr('src', src);
            });

            Resolver.getUvDebugImage(element.faces.south, data, min, max, (src) => {
                $layer.find('[data-dir="S"] .uv').attr('src', src);
            });
        }

        if (_.has(element.faces, 'east')) {
            $layer.find('[data-dir="E"]').removeClass('hidden');

            const {min, max} = Resolver.getFallbackUv(element, 'east');

            Resolver.getFaceImage(element.faces.east, data, (src) => {
                $layer.find('[data-dir="E"] .tex').attr('src', src);
            });

            Resolver.getUvDebugImage(element.faces.east, data, min, max, (src) => {
                $layer.find('[data-dir="E"] .uv').attr('src', src);
            });
        }

        if (_.has(element.faces, 'west')) {
            $layer.find('[data-dir="W"]').removeClass('hidden');

            const {min, max} = Resolver.getFallbackUv(element, 'west');

            Resolver.getFaceImage(element.faces.west, data, (src) => {
                $layer.find('[data-dir="W"] .tex').attr('src', src);
            });

            Resolver.getUvDebugImage(element.faces.west, data, min, max, (src) => {
                $layer.find('[data-dir="W"] .uv').attr('src', src);
            });
        }

        if (_.has(element.faces, 'up')) {
            $layer.find('[data-dir="U"]').removeClass('hidden');

            const {min, max} = Resolver.getFallbackUv(element, 'up');

            Resolver.getFaceImage(element.faces.up, data, (src) => {
                $layer.find('[data-dir="U"] .tex').attr('src', src);
            });

            Resolver.getUvDebugImage(element.faces.up, data, min, max, (src) => {
                $layer.find('[data-dir="U"] .uv').attr('src', src);
            });
        }

        if (_.has(element.faces, 'down')) {
            $layer.find('[data-dir="D"]').removeClass('hidden');

            const {min, max} = Resolver.getFallbackUv(element, 'down');

            Resolver.getFaceImage(element.faces.down, data, (src) => {
                $layer.find('[data-dir="D"] .tex').attr('src', src);
            });

            Resolver.getUvDebugImage(element.faces.down, data, min, max, (src) => {
                $layer.find('[data-dir="D"] .uv').attr('src', src);
            });
        }

        $layer.on('change', '.visibility', (event) => {
            object.visible = event.target.checked;
        });

        $wrapper.append($layer);

        return self;
    };

    return self;
};

module.exports = Layers;

/* global $ */

const _ = require('lodash');

const isColorNeighbor = (color, compare, tolerance = 3) => {
    const diff = color.difference(compare);

    return diff > 0 && diff <= tolerance;
};

const thereAreNeighbors = (colors, tolerance = 3) =>
    colors.filter((color) =>
        colors.filter((compare) =>
            isColorNeighbor(color, compare, tolerance)
        ).length > 0
    ).length > 0;

const getTolerance = (palette) => {
    // Don't need to compress so few colors
    if (palette.length <= 15) {
        // TODO: Is this really a good idea?
        // return 0;
    }

    let maxDifference = 0;

    palette.forEach((color) => {
        palette.forEach((compare) => {
            maxDifference = Math.max(maxDifference,
                color.difference(compare));
        });
    });

    // Not much variety to compress
    if (maxDifference <= 15) {
        return 0;
    }

    if (palette.length > 768) {
        return 12;
    }

    if (palette.length > 512) {
        return 6;
    }

    if (palette.length > 256) {
        return 4;
    }

    return 3;
};

module.exports = {
    build: ($palette, palette) => {
        $palette.html('');

        palette.forEach((color, index) => {
            const $color = $(`<li>
                <b style="background-color: ${color.rgba()};"></b>
            </li>`);

            $color.on('click', function () {
                $color.addClass('selected').siblings().removeClass('selected');

                $palette.trigger('set-color', index);
            });

            $palette.append($color);
        });
    },

    cleanup: (colors) => {
        let palette = _.uniqBy(colors, (d) => d.hex());
        const tolerance = getTolerance(palette);

        for (let c = 0; c < palette.length; c += 1) {
            palette[c].id(c);
        }

        while (thereAreNeighbors(palette, tolerance)) {
            const neighborSets = palette.map(
                (color) => [color, palette.filter(
                    (compare) => isColorNeighbor(color, compare, tolerance)
                )]
            ).filter(([, neighbors]) => neighbors.length > 0);

            let maxNeighbors = 0;

            neighborSets.forEach(
                ([, neighbors]) => {
                    maxNeighbors = Math.max(maxNeighbors, neighbors.length);
                }
            );

            for (let c = neighborSets.length - 1; c >= 0; c -= 1) {
                const [color, neighbors] = neighborSets[c];

                if (neighbors.length === maxNeighbors) {
                    neighbors.forEach((neighbor) => {
                        neighbor.ids().forEach(
                            (colorId) => color.id(colorId)
                        );

                        neighbor.links().forEach(
                            (colorHex) => color.link(colorHex)
                        );

                        neighbor.invalidate();
                    });

                    break;
                }
            }

            palette = _.uniqBy(
                palette.filter((d) => d.valid()),
                (d) => d.hex()
            );
        }

        return palette;
    },
};

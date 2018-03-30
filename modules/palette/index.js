'use strict';

const _ = require('lodash');

const isColorNeighbor = (color1, color2) => {
    const diff = color1.difference(color2);

    return diff > 0 && diff <= 3;
};

const thereAreNeighbors = (colors) =>
    colors.filter((color) =>
        colors.filter((compareColor) =>
            isColorNeighbor(color, compareColor)
        ).length > 0
    ).length > 0;

module.exports = {
    cleanup: (colors) => {
        let palette = _.uniqBy(colors, (d) => d.hex());

        while (thereAreNeighbors(palette)) {
            const neighborSets = palette.map(
                (color) => [color, palette.filter(
                    (compareColor) => isColorNeighbor(color, compareColor)
                )]
            ).filter(([color, neighbors]) => neighbors.length > 0);

            let maxNeighbors = 0;

            neighborSets.forEach(
                ([color, neighbors]) => {
                    maxNeighbors = Math.max(maxNeighbors, neighbors.length);
                }
            );

            for (let c = neighborSets.length - 1; c >= 0; c -= 1) {
                const [color, neighbors] = neighborSets[c];

                if (neighbors.length === maxNeighbors) {
                    neighbors.forEach((neighbor) => {
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

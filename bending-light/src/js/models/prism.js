define(function (require) {

    'use strict';

    var Backbone = require('backbone');

    var PositionableObject = require('common/models/positionable-object');
    var Vector2            = require('common/math/vector2');

    /**
     * 
     */
    var Prism = PositionableObject.extend({

        /**
         * Initializes new Prism object.
         */
        initialize: function(attributes, options) {
            if (options.shape)
                this.shape = options.shape;
            else if (options.points)
                this.shape = new Polygon(options.points, options.referencePointIndex);
            
            this._point = new Vector2();
        },

        /**
         * Returns whether a point falls within the prism's shape
         */
        contains: function(point) {
            // Convert to the shape's local coordinates
            point = this.getPointRelativeToPosition(point);

            return this.shape.contains(point);
        },

        /**
         * Compute the intersections of the specified ray with this polygon's edges
         */
        getIntersections: function(incidentRay) {
            // Convert to the shape's local coordinates
            var tail = this.getPointRelativeToPosition(incidentRay.tail);
            return this.shape.getIntersections(tail, incidentRay.directionUnitVector);
        },

        /**
         * The shape is always centered on (0, 0), which is its pivot point,
         *   so to do checks in global space, we need to translate it 
         *   according to the prism's position.
         */
        getPointRelativeToPosition: function(point) {
            return this._point.set(point).sub(this.get('position'));
        },

        /**
         * Clones this prism instance and returns it
         */
        clone: function() {
            return new Prism({ 
                position: this.get('position') 
            }, { 
                shape: this.shape 
            });
        },

        /**
         * Rotates the shape in place
         */
        rotate: function(rotate) {
            this.shape.rotate(rotate);
        }

    }, Prism);

    return Prism;
});

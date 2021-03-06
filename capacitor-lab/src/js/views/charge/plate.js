define(function(require) {

    'use strict';

    var ChargeView        = require('views/charge');
    var calculateGridSize = require('views/calculate-grid-size');

    var Constants = require('constants');
    var Polarity = Constants.Polarity;

    /**
     * Base class for representation of plate charge.  Plate charge is
     *   represented as an integer number of '+' or '-' symbols. These
     *   symbols are distributed across some portion of the plate's top
     *   face.  All model coordinates are relative to the capacitor's
     *   local coordinate frame.
     */
    var PlateChargeView = ChargeView.extend({

        initialize: function(options) {
            this.transparency = options.transparency;
            this.polarity = options.polarity;
            this.maxPlateCharge = options.maxPlateCharge;

            // Call parent initialize
            ChargeView.prototype.initialize.apply(this, [options]);

            // Listen for model events
            
            this.listenTo(this.model, 'change:plateSeparation', this.updatePosition);
            this.listenTo(this.model, 'change', this.draw);
        },

        initGraphics: function() {
            ChargeView.prototype.initGraphics.apply(this, arguments);

            this.positiveCharges.alpha = this.transparency;
            this.negativeCharges.alpha = this.transparency;
        },

        draw: function() {
            ChargeView.prototype.draw.apply(this, arguments);

            var capacitor = this.model;

            var plateCharge = this.getPlateCharge();
            var numberOfCharges = this.getNumberOfCharges(plateCharge, this.maxPlateCharge);

            // Compute grid dimensions
            if (numberOfCharges > 0) {
                var zMargin = this.mvt.viewToModelDeltaX(PlateChargeView.SYMBOL_WIDTH);

                var gridWidth = this.getContactWidth(); // Contact between plate and dielectric
                var gridDepth = capacitor.get('plateDepth') - (2 * zMargin);

                // Grid dimensions
                var gridDimensions = calculateGridSize(numberOfCharges, gridWidth, gridDepth);
                var rows = gridDimensions.rows;
                var cols = gridDimensions.columns;

                // Distance between cells
                var dx = gridWidth / cols;
                var dz = gridDepth / rows;

                // Offset to move us to the center of cells
                var xOffset = dx / 2;
                var zOffset = dz / 2;

                var x;
                var y;
                var z;

                // Populate the grid
                for (var row = 0; row < rows; row++) {
                    for (var col = 0; col < cols; col++) {
                        // Position the charge in cell in the grid
                        x = this.getContactXOrigin() + xOffset + (col * dx);
                        y = 0;
                        z = -(gridDepth / 2) + (zMargin / 2) + zOffset + (row * dz);
                        if (numberOfCharges === 1)
                            z -= dz / 6; // So that single charge is not obscured by wire connected to center of top plate

                        if (this.isPositivelyCharged())
                            this.drawPositiveSymbol(x, y, z);
                        else
                            this.drawNegativeSymbol(x, y, z);
                    }
                }
            }
        },

        /**
         * Computes number of charges, linearly proportional to plate charge.
         *   All non-zero values below some minimum are mapped to 1 charge.
         */
        getNumberOfCharges: function(plateCharge, maxPlateCharge) {
            var absCharge = Math.abs(plateCharge);
            var numberOfCharges = parseInt(Constants.NUMBER_OF_PLATE_CHARGES.max * absCharge / maxPlateCharge);

            if (absCharge > 0 && numberOfCharges < Constants.NUMBER_OF_PLATE_CHARGES.min)
                numberOfCharges = Constants.NUMBER_OF_PLATE_CHARGES.min;

            return numberOfCharges;
        },

        getPlateCharge: function() {},

        getContactXOrigin: function() {},

        getContactWidth: function() {},

        isPositivelyCharged: function() {
            return (
                (this.getPlateCharge() >= 0 && this.polarity === Polarity.POSITIVE) || 
                (this.getPlateCharge() <  0 && this.polarity === Polarity.NEGATIVE)
            );
        },

        updatePosition: function() {
            var modelPoint;
            if (this.polarity === Polarity.POSITIVE)
                modelPoint = this.model.getTopPlateCenter();
            else {
                modelPoint = this.model.getBottomPlateCenter();
                modelPoint.y -= this.model.get('plateHeight');
            }
            var viewPos = this.mvt.modelToView(modelPoint);
            this.displayObject.x = viewPos.x;
            this.displayObject.y = viewPos.y;
        },
 
        updateMVT: function(mvt) {
            this.mvt = mvt;

            this.draw();
            this.updatePosition();
        },

        update: function() {
            this.draw();
            this.updatePosition();
        }

    });

    return PlateChargeView;
});
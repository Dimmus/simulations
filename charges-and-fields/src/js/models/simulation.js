define(function (require, exports, module) {

    'use strict';

    var _        = require('underscore');
    var Backbone = require('backbone');

    var Simulation = require('common/simulation/simulation');
    var Vector2    = require('common/math/vector2');

    var Charge = require('models/charge');

    /**
     * Constants
     */
    var Constants = require('constants');

    /**
     * The simulation model here is based on the ChargeGroup class from the
     *   original sim.  All functionality of ChargeGroup is contained in
     *   this class as well as any additionally needed functionality.
     */
    var ChargesAndFieldsSimulation = Simulation.extend({

        defaults: _.extend(Simulation.prototype.defaults, {
            k: 0.5 * 1E6,     // Prefactor in E-field equation: E= k*Q/r^2
            maxVoltage: 20000 // Voltage at which we would show total color saturation
        }),
        
        initialize: function(attributes, options) {
            Simulation.prototype.initialize.apply(this, [attributes, options]);

            // Collections
            this.charges = new Backbone.Collection([], { model: Charge });


            // Object caches
            this._efieldVec  = new Vector2();
            this._voltageLoc = new Vector2();
        },

        /**
         * Initializes the models used in the simulation
         */
        initComponents: function() {
            
        },

        /**
         * This simulation does not make use of time and updates only when
         *   things change.  The view should listen for change events to
         *   trigger rendering.
         */
        update: function(time, deltaTime) {},

        /**
         * Adds a charge to the simulation
         */
        addCharge: function(charge) {
            this.charges.add(charge);
        },

        /**
         * Removes a charge from the simulation
         */
        removeCharge: function(charge) {
            this.charges.remove(charge);
        },

        /**
         * Returns whether or not there are any charges
         */
        hasCharges: function() {
            return this.charges.length !== 0;
        },

        /**
         * Returns the E-field vector at the given point
         */
        getE: function(x, y) {
            var sumX = 0;
            var sumY = 0;
            var charges = this.charges.models;

            var pos;
            var distSq;
            var distPow;

            for (var i = 0; i < charges.length; i++) {
                pos = charges[i].get('position');
                distSq = (x - pos.x) * (x - pos.x) + (y - pos.y) * (y - pos.y);
                distPow = Math.pow(distSq, 1.5);
                sumX += charges[i].get('q') * (x - pos.x) / distPow;
                sumY += charges[i].get('q') * (y - pos.y) / distPow;
            }

            this._efieldVec.x = this.get('k') * sumX;
            this._efieldVec.y = this.get('k') * sumY;

            return this._efieldVec;
        },

        /**
         * Returns the voltage at the given point
         */
        getV: function(x, y) {
            var sumV = 0;
            var charges = this.charges.models;

            var location = this._voltageLoc.set(x, y);
            var dist;

            for (var i = 0; i < charges.length; i++) {
                dist = location.distance(charges[i].get('position'));
                sumV += charges[i].get('q') / dist;
            }

            sumV *= this.get('k');

            return sumV;
        },

    });

    return ChargesAndFieldsSimulation;
});

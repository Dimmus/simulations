define(function (require) {

    'use strict';

    var _ = require('underscore');

    var CircuitComponent = require('models/components/circuit-component');

    var Constants = require('constants');

    /**
     * A battery
     */
    var Battery = CircuitComponent.extend({

        defaults: _.extend({}, CircuitComponent.prototype.defaults, {
            voltageDrop: 9,
            internalResistance: undefined,
            internalResistanceOn: undefined,
            kirkhoffEnabled: false,
            length: 1,
            height: 1
        }),

        initialize: function(attributes, options) {
            CircuitComponent.prototype.initialize.apply(this, [attributes, options]);

            this.set('resistance', this.get('internalResistance'));

            this.on('change:internalResistanceOn', this.internalResistanceOnChanged);
        },

        getEffectiveVoltageDrop: function() {
            return this.get('voltageDrop') - this.get('current') * this.get('resistance');
        },

        internalResistanceOnChanged: function(model, internalResistanceOn) {
            if (internalResistanceOn)
                this.set('resistance', this.get('internalResistance'));
            else
                this.set('resistance', Constants.MIN_RESISTANCE);
        },

        reverse: function() {
            var start = this.get('startJunction');
            var end = this.get('endJunction');
            this.set('startJunction', end);
            this.set('endJunction', start);
        }

    }, Constants.Battery);

    return Battery;
});
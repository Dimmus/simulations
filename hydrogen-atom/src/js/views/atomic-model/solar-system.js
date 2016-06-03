define(function(require) {

    'use strict';

    var PIXI = require('pixi');

    var AtomicModelView = require('hydrogen-atom/views/atomic-model');

    var Constants = require('constants');
    
    /**
     * Represents the scene for the SolarSystemModel
     */
    var SolarSystemModelView = AtomicModelView.extend({

        /**
         * Initializes the new SolarSystemModelView.
         */
        initialize: function(options) {
            AtomicModelView.prototype.initialize.apply(this, arguments);
        },

        update: function(time, deltaTime, paused) {
            AtomicModelView.prototype.update.apply(this, arguments);
        }

    });


    return SolarSystemModelView;
});
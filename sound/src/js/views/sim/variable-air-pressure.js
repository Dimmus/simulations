define(function (require) {

    'use strict';

    var VariableAirPressureSimulation = require('models/simulation/variable-air-pressure');

    var SoundSimView                 = require('views/sim');
    var VariableAirPressureSceneView = require('views/scene/variable-air-pressure');

    var Constants = require('constants');

    var airDensityControlsHtml = require('text!templates/air-density-controls.html');
        
    /**
     * 
     */
    var VariableAirPressureSimView = SoundSimView.extend({

        showHelpBtn: false,

        /**
         * Dom event listeners
         */
        events: _.extend({}, SoundSimView.prototype.events, {
            'click .btn-add-air'    : 'addAirToBox',
            'click .btn-remove-air' : 'removeAirFromBox',
            'click .btn-reset-box'  : 'resetBox'
        }),

        /**
         * Inits simulation, views, and variables.
         *
         * @params options
         */
        initialize: function(options) {
            options = _.extend({
                title: 'Varying Air Pressure',
                name: 'variable-air-pressure-sim',
            }, options);

            SoundSimView.prototype.initialize.apply(this, [options]);
        },

        reset: function() {
            SoundSimView.prototype.reset.apply(this, arguments);

            this.$('.audio-listener').click();
        },

        /**
         * Initializes the Simulation.
         */
        initSimulation: function() {
            this.simulation = new VariableAirPressureSimulation();
        },

        /**
         * Initializes the SceneView.
         */
        initSceneView: function() {
            this.sceneView = new VariableAirPressureSceneView({
                simulation: this.simulation
            });
        },

        /**
         * Renders page content
         */
        renderScaffolding: function() {
            SoundSimView.prototype.renderScaffolding.apply(this, arguments);

            this.renderAudioControls();
            this.$('.audio-listener').click();

            // Air density controls
            this.$('.sim-controls-column').append(airDensityControlsHtml);
        },

        addAirToBox: function() {
            this.sceneView.addAirToBox();
        },

        removeAirFromBox: function() {
            this.sceneView.removeAirFromBox();
        },

        resetBox: function() {
            this.sceneView.resetBox();
        }

    });

    return VariableAirPressureSimView;
});

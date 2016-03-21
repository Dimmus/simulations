define(function(require) {

    'use strict';

    var _    = require('underscore');
    var PIXI = require('pixi');

    var AppView            = require('common/v3/app/app');
    var ModelViewTransform = require('common/math/model-view-transform');
    var Vector2            = require('common/math/vector2');

    var Nucleon       = require('models/nucleon');
    var AlphaParticle = require('models/alpha-particle');

    var NucleonView               = require('views/nucleon');
    var AlphaParticleView         = require('views/alpha-particle');
    var ParticleGraphicsGenerator = require('views/particle-graphics-generator');
    var SingleNucleusDecayChart   = require('views/nucleus-decay-chart/single');
    var ExplodingNucleusView      = require('views/nucleus/exploding');

    var NuclearPhysicsSceneView = require('views/scene');

    /**
     *
     */
    var SingleNucleusSceneView = NuclearPhysicsSceneView.extend({

        initialize: function(options) {
            NuclearPhysicsSceneView.prototype.initialize.apply(this, arguments);

            this.listenTo(this.simulation.emittedParticles, 'add', this.particleEmitted);
            this.listenTo(this.simulation, 'change:nucleusType', this.nucleusTypeChanged);
        },

        renderContent: function() {
            var self = this;
            this.$resetButton = $('<button class="btn btn-lg reset-nucleus-btn">Reset Nucleus</button>');
            this.$resetButton.on('click', function() {
                self.resetNucleus();
            });

            this.$ui.append(this.$resetButton);
        },

        initMVT: function() {
            this.viewOriginX = this.getLeftPadding() + this.getAvailableWidth() / 2;
            this.viewOriginY = this.getTopPadding() + this.getAvailableHeight() / 2;

            var pixelsPerFemtometer = 25;

            // The center of the screen is actually (5, 5) in the original
            this.mvt = ModelViewTransform.createSinglePointScaleMapping(
                new Vector2(0, 0),
                new Vector2(this.viewOriginX, this.viewOriginY),
                pixelsPerFemtometer
            );
        },

        initGraphics: function() {
            NuclearPhysicsSceneView.prototype.initGraphics.apply(this, arguments);

            this.nucleusLayer = new PIXI.Container();
            this.stage.addChild(this.nucleusLayer);

            this.initMVT();

            this.nucleusTypeChanged(this.simulation, this.simulation.get('nucleusType'));
        },

        _update: function(time, deltaTime, paused, timeScale) {
            NuclearPhysicsSceneView.prototype._update.apply(this, arguments);

            if (this.nucleusView)
                this.nucleusView.update(time, deltaTime, paused);
        },

        updateNucleusView: function() {
            this.nucleusLayer.removeChildren();

            // Add a node for each particle that comprises the nucleus.
            var constituents = this.simulation.atomicNucleus.getConstituents();
            for (var i = 0; i < constituents.length; i++) {
                var constituent = constituents[i];

                if (constituent instanceof Nucleon) {
                    // Add a visible representation of the nucleon to the canvas.
                    var nucleonView = new NucleonView({
                        model: constituent,
                        mvt: this.mvt
                    });
                    this.nucleusLayer.addChild(nucleonView.displayObject);
                }
                else if (constituent instanceof AlphaParticle) {
                    // Add a visible representation of the alpha particle to the canvas.
                    var alphaParticleView = new AlphaParticleView({
                        model: constituent,
                        mvt: this.mvt
                    });
                    this.nucleusLayer.addChild(alphaParticleView.displayObject);
                }
                else {
                    // There is some unexpected object in the list of constituents
                    // of the nucleus.  This should never happen and should be
                    // debugged if it does.
                    throw 'unexpected particle in constituent list';
                }
            }

            // Add the exploding nucleus view, which in this case is just the label and explosion animation
            this.nucleusView = new ExplodingNucleusView({
                model: this.simulation.atomicNucleus,
                mvt: this.mvt,
                showNucleus: false
            });
            this.nucleusLayer.addChild(this.nucleusView.displayObject);
        },

        resetNucleus: function() {
            this.simulation.resetNucleus();
        },

        particleEmitted: function(particle) {

        },

        nucleusTypeChanged: function(simulation, nucleusType) {
            this.updateNucleusView();
        }

    });

    return SingleNucleusSceneView;
});

define(function (require) {

    'use strict';

    var _         = require('underscore');
    var Vector2   = require('vector2-node');
    var Rectangle = require('rectangle-node');

    var Element                 = require('models/block');
    var EnergyContainerCategory = require('models/energy-container-category');

    /**
     * Constants
     */
    var Constants = require('models/constants');
    var Static = {};
    Static.WIDTH = 0.075; // In meters.
    Static.HEIGHT = WIDTH * 1;
    Static.MAX_ENERGY_GENERATION_RATE = 5000; // joules/sec, empirically chosen.
    Static.CONTACT_DISTANCE = 0.001; // In meters.
    Static.ENERGY_CHUNK_CAPTURE_DISTANCE = 0.2; // In meters, empirically chosen.

    //
    Static.PERSPECTIVE_ANGLE = Math.PI / 4;

    // Because of the way that energy chunks are exchanged between thermal
    //   modeling elements within this simulation, things can end up looking a
    //   bit odd if a burner is turned on with nothing on it.  To account for
    //   this, a separate energy generation rate is used when a burner is
    //   exchanging energy directly with the air.
    Static.MAX_ENERGY_GENERATION_RATE_INTO_AIR = Static.MAX_ENERGY_GENERATION_RATE * 0.3; // joules/sec, multiplier empirically chosen.

    /**
     * 
     */
    var Burner = Element.extend({

        defaults: _.extend({}, Element.prototype.defaults, {
            position: null,
            heatCoolLevel: 0,
            energyChunksVisible: false
        }),

        initialization: function(attributes, options) {
            // Internal object caches
            this._outlineRect  = new Rectangle();
            this._flameIceRect = new Rectangle();

            // Create vectors
            this.set('position', new Vector2(0, 0));
            this._energyChunkStartEndPoint = new Vector();
            this._centerPoint = new Vector();

            // Energy chunks
            this.energyChunkList = [];
            this.energyChunkWanderControllers = [];

            // Create and add the top surface.  Some compensation for perspective
            //   is necessary in order to avoid problems with edge overlap when
            //   dropping objects on top of burner.
            var perspectiveCompensation = this.getOutlineRect().h * Constants.BURNER_EDGE_TO_HEIGHT_RATIO * Math.cos(Burner.PERSPECTIVE_ANGLE);
            this.topSurface = new HorizontalSurface(
                this.getOutlineRect().left() - perspectiveCompensation, 
                this.getOutlineRect().right() + perspectiveCompensation, 
                this.getOutlineRect().top(),
                this
            );

            // Track energy transferred to anything sitting on the burner.
            this.energyExchangedWithObjectSinceLastChunkTransfer = 0;

            // Track build up of energy for transferring chunks to/from the air.
            this.energyExchangedWithAirSinceLastChunkTransfer = 0;

            this.on('change:heatCoolLevel', function(model, heatCoolLevel) {
                if (heatCoolLevel === 0 || (Math.sign(this.previous('heatCoolLevel')) !== Math.sign(heatCoolLevel))) {
                    // If the burner has been turned off or switched modes,
                    //   clear accumulated heat/cool amount.
                    this.energyExchangedWithAirSinceLastChunkTransfer = 0;
                }
            });
        },

        reset: function() {
            Burner.prototype.reset.apply(this);

            this.energyChunkList = [];
            this.energyChunkWanderControllers = [];
            this.energyExchangedWithAirSinceLastChunkTransfer = 0;
            this.energyExchangedWithObjectSinceLastChunkTransfer = 0;
            this.heatCoolLevel = 0;
        },

        update: function(time, deltaTime) {
            // Animate energy chunks.
            var controller;
            for (this.energyChunkWanderControllers.length - 1; i >= 0; i--) {
                controller = this.energyChunkWanderControllers[i];
                controller.updatePosition(deltaTime);

                // Remove controllers that have finished their animation
                if (controller.destinationReached()) {
                    this.energyChunkList = _.without(this.energyChunkList, controller.energyChunk);
                    this.energyChunkWanderControllers.splice(i, 1);
                }
            }
        },

        /**
         * Get a rectangle that defines the outline of the burner.  In the model,
         * the burner is essentially a 2D rectangle.
         *
         * @return Rectangle that defines the outline in model space.
         */
        getOutlineRect: function() {
            return this._outlineRect.set(
                this.get('position').x - Burner.WIDTH / 2,
                this.get('position').y,
                Burner.WIDTH,
                Burner.HEIGHT
            );
        },

        getTopSurfaceProperty: function() {
            return topSurface;
        },

        /**
         * Interact with a thermal energy container, adding or removing energy
         * based on the current heat/cool setting.
         *
         * @param thermalEnergyContainer Model object that will get or give energy.
         * @param deltaTime              Amount of time (delta time).
         */
        addOrRemoveEnergyToFromObject: function(thermalEnergyContainer, deltaTime) {
            if (thermalEnergyContainer instanceof Air)
                return;

            if (this.inContactWith(thermalEnergyContainer)) {
                var deltaEnergy = 0;
                if (thermalEnergyContainer.getTemperature() > Constants.FREEZING_POINT_TEMPERATURE)
                    deltaEnergy = Burner.MAX_ENERGY_GENERATION_RATE * this.get('heatCoolLevel') * deltaTime;
                thermalEnergyContainer.changeEnergy(deltaEnergy);
                this.energyExchangedWithObjectSinceLastChunkTransfer += deltaEnergy;
            }
        },

        addOrRemoveEnergyToFromAir: function(air, deltaTime) {
            var deltaEnergy = Burner.MAX_ENERGY_GENERATION_RATE_INTO_AIR * this.get('heatCoolLevel') * deltaTime;
            air.changeEnergy(deltaEnergy);
            this.energyExchangedWithAirSinceLastChunkTransfer += deltaEnergy;
        },

        inContactWith: function(thermalEnergyContainer) {
            var containerThermalArea = thermalEnergyContainer.getThermalContactArea().getBounds();
            return (
                containerThermalArea.getCenterX() > this.getOutlineRect().left()  &&
                containerThermalArea.getCenterX() < this.getOutlineRect().right() &&
                Math.abs(containerThermalArea.getMinY() - this.getOutlineRect().top()) < Burner.CONTACT_DISTANCE
            );
        },

        addEnergyChunk: function(chunk) {
            chunk.zPosition.set(0);
            this.energyChunkList.push(chunk);
            this.energyChunkWanderControllers.push(new EnergyChunkWanderController(chunk, this.getEnergyChunkStartEndPoint()));
            this.energyExchangedWithAirSinceLastChunkTransfer = 0;
            this.energyExchangedWithObjectSinceLastChunkTransfer = 0;
        },

        getEnergyChunkStartEndPoint: function() {
            return this._energyChunkStartEndPoint.set(this.getCenterPoint().x, this.getCenterPoint().y);
        },

        /**
         * Request an energy chunk from the burner.
         *
         * @param point Point from which to search for closest chunk.
         * @return Closest energy chunk, null if none are contained.
         */
        extractClosestEnergyChunk: function(point) {
            var closestChunk = null;
            if (this.energyChunkList.length) {
                var i;
                var removeIndex;
                var chunk;
                for (i = 0; i < this.energyChunkList.length; i++) {
                    chunk = this.energyChunkList[i];
                    if (chunk.position.distance(this.get('position')) > Burner.ENERGY_CHUNK_CAPTURE_DISTANCE && (
                            closestChunk == null || 
                            chunk.position.distance(point) < closestChunk.position.distance(point) 
                        )
                    ) {
                        // Found a closer chunk.
                        closestChunk = chunk;
                        removeIndex = i;
                    }
                }

                this.energyChunkList.splice(removeIndex, 1);

                for (i = 0; i < this.energyChunkWanderControllers.length; i++) {
                    if (this.energyChunkWanderControllers[i].energyChunk === closestChunk) {
                        this.energyChunkWanderControllers.splice(i, 1);
                        break;
                    }
                }
            }

            if (closestChunk === null && this.get('heatCoolLevel') > 0) {
                // Create an energy chunk.
                closestChunk = new EnergyChunk(EnergyChunk.THERMAL, this.getEnergyChunkStartEndPoint(), this.get('energyChunksVisible'));
            }

            if (closestChunk === null) {
                this.energyExchangedWithAirSinceLastChunkTransfer = 0;
                this.energyExchangedWithObjectSinceLastChunkTransfer = 0;
            }
            else {
                console.error('Burner - Warning: Request for energy chunk from burner when not in heat mode and no chunks contained, returning null.');
            }

            return closestChunk;
        },

        getCenterPoint: function() {
            return this._centerPoint.set(
                this.get('position').x,
                this.get('position').y + Burner.HEIGHT / 2
            );
        },

        areAnyOnTop: function(thermalEnergyContainers) {
            for (var i = 0; i < this.thermalEnergyContainers; i++) {
                if (this.inContactWith(this.thermalEnergyContainers[i]))
                    return true;
            }
            return false;
        },

        getEnergyChunkCountForAir: function() {
            var count = 0;
            // If there are approaching chunks, and the mode has switched to off or
            //   to heating, the chunks should go back to the air (if they're not
            //   almost to the burner).
            if (this.energyChunkList.length && this.get('heatCoolLevel') >= 0) {
                _.each(this.energyChunkList, function(chunk) {
                    if (this.get('position').distance(chunk.position) > Burner.ENERGY_CHUNK_CAPTURE_DISTANCE)
                        count++;
                });
            }
            if (count === 0) {
                // See whether the energy exchanged with the air since the last
                //   chunk transfer warrants another chunk.
                count = Math.round(this.energyExchangedWithAirSinceLastChunkTransfer / Constants.ENERGY_PER_CHUNK);
            }
            return count;
        },

        getFlameIceRect: function() {
            // This is the area where the flame and ice appear in the view.  Must
            //   be coordinated with the view.
            var outlineRect = this.getOutlineRect();
            var center = outlineRect.center();
            return this._flameIceRect.set(
                center.x - outlineRect.w / 4,
                center.y,
                outlineRect.w / 2,
                outlineRect.h / 2
            );
        },

        getTemperature: function() {
            // The multiplier is empirically determined for desired behavior. The
            //   low value is limited to the freezing point of water.
            return Math.max(Constants.ROOM_TEMPERATURE + this.get('heatCoolLevel') * 100, Constants.FREEZING_POINT_TEMPERATURE);
        },

        /**
         * Get the number of excess of deficit energy chunks for interaction with
         *   thermal objects (as opposed to air).
         *
         * @return Number of energy chunks that could be supplied or consumed.
         *         Negative value indicates that chunks should come in.
         */
        getEnergyChunkBalanceWithObjects: function() {
            var numChunks = Math.abs(this.energyExchangedWithObjectSinceLastChunkTransfer) / Constants.ENERGY_PER_CHUNK;
            return Math.floor(numChunks) * Math.sign(this.energyExchangedWithObjectSinceLastChunkTransfer);
        },

        canSupplyEnergyChunk: function() {
            return this.get('heatCoolLevel') > 0;
        },

        canAcceptEnergyChunk: function() {
            return this.get('heatCoolLevel') < 0;
        }

    }, Static);

    return Burner;
});
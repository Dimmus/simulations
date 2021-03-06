define(function (require, exports, module) {

    'use strict';

    var _ = require('underscore');
    var Pool = require('object-pool');

    var Simulation   = require('common/simulation/simulation');
    var MotionMath   = require('common/math/motion');
    var Vector2      = require('common/math/vector2');
    var Rectangle    = require('common/math/rectangle');
    var binarySearch = require('common/binarysearch/binarysearch');

    var Ladybug             = require('models/ladybug');
    var LadybugMover        = require('models/ladybug-mover');
    var LadybugStateRecord  = require('models/ladybug-state-record');
    var SamplingMotionModel = require('models/sampling-motion-model');

    /**
     * Constants
     */
    var Constants = require('constants');
    var UpdateMode = Constants.UpdateMode;

    /**
     * Object pooling
     */
    var penPathEntryPool = Pool({
        init: function() {
            return {};
        },
        enable: function(point) {
            point.time = 0;
            point.x = 0;
            point.y = 0;
        }
    });

    var ladybugStateRecordPool = Pool({
        init: function() {
            return new LadybugStateRecord();
        }
    });

    /**
     * The bulk of the logic for the simulation model resides here.
     */
    var LadybugMotionSimulation = Simulation.extend({

        defaults: _.extend(Simulation.prototype.defaults, {
            motionType: 'Manual',
            updateMode: UpdateMode.POSITION,
            recording: true,
            paused: true,

            furthestRecordedTime: 0, // Seconds
            maxRecordingTime:    20  // Seconds
        }),
        
        initialize: function(attributes, options) {
            // The centerpiece
            this.ladybug = new Ladybug();

            // Stuff for directing the motion of the ladybug:
            //   We're pretending there is a virtual pen that is drawing a path
            //   of where we want the ladybug to go.  It can either be from the
            //   user dragging the ladybug around the screen or from the remote
            //   control arrows.
            this.samplingMotionModel = new SamplingMotionModel(10, 5, 0, 0);
            this.penPath = []; // Holds the pen positions and the time they were taken
            this.penDown = false; // Whether or not the "pen" is down--whether we're receiving input
            this.penPoint = new Vector2(); // Current position of the pen
            this.ladybugMover = new LadybugMover(this);

            // State history
            this.stateHistory = [];

            // This version of state history has references to records in
            //   stateHistory but culls duplicate records in continuous
            //   blocks of states with unchanged position.
            this.culledStateHistory = [];

            // For determining appropriate motion in motion presets
            this.bounds = new Rectangle();

            // Object caches
            this._lastSamplePoint = new Vector2();
            this._velocity = new Vector2();
            this._acceleration = new Vector2();

            this.initEstimationObjects();

            Simulation.prototype.initialize.apply(this, [attributes, options]);

            this.on('change:recording',  this.recordingModeChanged);
            this.on('change:paused',     this.pausedChanged);
            this.on('change:updateMode', this.updateModeChanged);
            this.on('change:motionType', this.motionTypeChanged);
        },

        /**
         * We store our derivative-estimation arrays and the
         *   objects contained therein in order that we might
         *   reuse them and not cause unnecessary waste each
         *   frame.  This function sets it all up in the very
         *   beginning.
         */
        initEstimationObjects: function() {
            this.xTimeSeries = [];
            this.yTimeSeries = [];

            for (var i = 0; i < Constants.ESTIMATION_SAMPLE_SIZE; i++) {
                this.xTimeSeries.push({ time: 0, value: 0 });
                this.yTimeSeries.push({ time: 0, value: 0 });
            }
        },

        /**
         * Initializes the models used in the simulation
         */
        initComponents: function() {
            
        },

        /**
         * Overrides simulation's reset function
         */
        reset: function() {
            this.time = 0;
            this.set('time', 0);
            this.set(this.startingAttributes);
            this.clearHistory();
            this.resetSamplingMotionModel();
            this.penPoint.set(0, 0);
            this.stopSampling();
            this.ladybug.reset();
        },

        /**
         * Function called by Simulation.update only when the
         *   simulation is not paused.  It's just an update
         *   function that assumes not paused.
         * Only runs if simulation isn't currently paused.
         * If we're recording, it saves state
         */
        _update: function(time, deltaTime) {
            // For the time slider and anything else relying on time
            this.set('time', time);

            if (this.get('recording')) {
                // Run update and then save state
                this.ladybugMover.update(deltaTime);

                this.recordCurrentPenPoint();
                this.trimSampleHistory();

                if (this.ladybugMover.isInManualMode())
                    this.updateManualMovement(deltaTime);

                this.recordState();
                this.set('furthestRecordedTime', time);
            }
            else {
                // We're playing back, so apply a saved state instead of updating
                this.applyPlaybackState();

                // And if we've reached the end of what we've recorded, stop
                if (time >= this.get('furthestRecordedTime'))
                    this.pause();
            }
        },

        /**
         * Figures out which update function to run depending
         *   on whether the user is dragging the ladybug
         *   directly (penDown) or not and which update mode
         *   is currently selected.
         */
        updateManualMovement: function(deltaTime) {
            if (this.penDown) {
                this.updatePositionMode(deltaTime);
            }
            else {
                switch (this.get('updateMode')) {
                    case UpdateMode.POSITION:
                        this.updatePositionMode(deltaTime);
                        break;
                    case UpdateMode.VELOCITY: 
                        this.updateVelocityMode(deltaTime);
                        break;
                    case UpdateMode.ACCELERATION:
                        this.updateAccelerationMode(deltaTime);
                        break;
                }
            }
        },

        /**
         * The update function for when we are in position mode
         *   (when the ladybug is driven by its position--or in
         *   this case driven by the pen points that indirectly
         *   determine position), this function updates all of
         *   the ladybug's motion properties according to the
         *   time (time between steps).
         */
        updatePositionMode: function(deltaTime) {
            if (this.penPath.length > 2) {
                this.samplingMotionModel.addPointAndUpdate(this.getLastSamplePoint());
                this.ladybug.setPosition(this.samplingMotionModel.getAverageMid());

                // PhET: added fudge factors for getting the scale right with 
                //   current settings of [samplingMotionModel and] used 
                //   spreadsheet to make sure model v and a are approximately 
                //   correct.
                var vscale = (1 / deltaTime) / 10;
                var ascale = vscale * vscale * 3.835;
                this.ladybug.setVelocity(this.samplingMotionModel.getVelocity().scale(vscale));
                this.ladybug.setAcceleration(this.samplingMotionModel.getAcceleration().scale(ascale));
            }
            else {
                this.ladybug.setVelocity(0, 0);
                this.ladybug.setAcceleration(0, 0);
            }

            this.pointInDirectionOfMotion();
        },

        /**
         * The update function for when we are in velocity mode
         *   (when the ladybug is driven by its velocity), this
         *   function updates all of the ladybug's motion
         *   properties according to the delta time (time
         *   between steps).
         */
        updateVelocityMode: function(deltaTime) {
            if (this.penPath.length > 0)
                this.samplingMotionModel.addPointAndUpdate(this.getLastSamplePoint());

            this.ladybug.updatePositionFromVelocity(deltaTime);
            this.ladybug.setAcceleration(this.estimateAcceleration());
            
            this.pointInDirectionOfMotion();
        },

        /**
         * The update function for when we are in acceleration 
         *   mode (when the ladybug is driven by its 
         *   acceleration), this function updates all of the
         *   ladybug's motion properties according to the
         *   delta time (time between steps).
         */
        updateAccelerationMode: function(deltaTime) {
            this.ladybug.updatePositionFromVelocity(deltaTime);
            this.ladybug.updateVelocity(deltaTime);
            this.pointInDirectionOfMotion();
        },

        /**
         * Sets the motion type on the ladybug mover
         */
        motionTypeChanged: function(simulation, motionTypeKey) {
            this.ladybugMover.setMotionType(LadybugMover.MOTION_TYPES[motionTypeKey]);
        },

        /**
         * Called when we're entering manual mode and just
         *   came from one of the automated motion types.
         */
        initManual: function() {
            this.resetSamplingMotionModel();
            this.clearSampleHistory();
        },

        /**
         * Called when we're starting to add sample points.
         *   Sets penDown to true.
         */
        startSampling: function() {
            this.penDown = true;
        },

        /**
         * Called when we're finished adding sample points.
         *   Sets penDown to false.
         */
        stopSampling: function() {
            this.penDown = false;
        },

        /**
         * Returns whether or not we're taking input samples
         *   (penDown is true).
         */
        sampling: function() {
            return this.penDown;
        },

        /**
         * Takes the current pen point, which is stored in
         *   the property this.penPoint, and creates a pen
         *   path entry out of it (attaching the current
         *   time) and then appends it to the pen path.
         */
        recordCurrentPenPoint: function() {
            var pathEntry = penPathEntryPool.create();
            pathEntry.time = this.get('time');
            pathEntry.x = this.penPoint.x;
            pathEntry.y = this.penPoint.y;
            this.penPath.push(pathEntry);
        },

        /**
         * Finds the last sample point (pen path entry) and
         *   returns it as a Vector2.
         */
        getLastSamplePoint: function() {
            return this._lastSamplePoint.set(
                this.penPath[this.penPath.length - 1].x,
                this.penPath[this.penPath.length - 1].y
            );
        },

        /**
         * Sets the current sample point (this.penPoint) to
         *   the specified x and y values.  Also takes a
         *   single Vector2 object instead.
         */
        setSamplePoint: function(x, y) {
            if (x instanceof Vector2) {
                y = x.y;
                x = x.x;
            }

            this.penPoint.x = x;
            this.penPoint.y = y;
        },

        /**
         * Keeps the pen path under a certain length
         */
        trimSampleHistory: function() {
            while (this.penPath.length > 100)
                this.shiftSampleHistory();
        },

        /**
         * Shifts the first sample off the front of the pen
         *   path array in a way that is safe for the object
         *   pool.
         */
        shiftSampleHistory: function() {
            penPathEntryPool.remove(this.penPath.shift());
        },

        /**
         * Clears pen path (sample) history in a way that is
         *   safe for the object pool.
         */
        clearSampleHistory: function() {
            for (var i = 0; i < this.penPath.length; i++)
                penPathEntryPool.remove(this.penPath[i]);
            this.penPath.splice(0, this.penPath.length);
            this.penPoint.set(0, 0);
        },

        /**
         * Clears state and sample history.
         */
        clearHistory: function() {
            this.stateHistory.splice(0, this.stateHistory.length);
            this.culledStateHistory.splice(0, this.culledStateHistory.length);
            this.clearSampleHistory();
            this.trigger('history-removed');
        },

        /**
         * Clears all history after a specified time.
         */
        clearHistoryAfter: function(time) {
            // Remove records beyond a certain time
            var i;
            for (i = this.stateHistory.length - 1; i >= 0; i--) {
                if (this.stateHistory[i].time >= time)
                    this.stateHistory.splice(i, 1);
            }
            for (i = this.culledStateHistory.length - 1; i >= 0; i--) {
                if (this.culledStateHistory[i].time >= time)
                    this.culledStateHistory.splice(i, 1);
            }

            this._historyTimes = null;

            this.set('furthestRecordedTime', time);

            /* If we were previously dragging the position of the ladybug
             *   and we seek to a certain position in history and want to
             *   write over it and we start dragging again, it will think
             *   we're starting at the last dragged position instead of
             *   at the desired position in history if we fail to clear
             *   the sampling data, and it looks very unnatural when that
             *   happens.
             */
            if (this.penDown) {
                this.clearSampleHistory();
                this.resetSamplingMotionModel();
            }

            this.trigger('history-removed');
        },

        getCulledStateHistory: function() {
            return this.culledStateHistory;
        },

        /**
         * Resets the sampling motion model.
         */
        resetSamplingMotionModel: function() {
            this.samplingMotionModel.reset(this.ladybug.get('position'));
        },

        /**
         * Records the current state in the model history.
         */
        recordState: function() {
            var stateRecord = ladybugStateRecordPool.create();
            stateRecord.recordState(this.get('time'), this.ladybug);
        
            // Check if we want to add it to the culled history
            if (!this.stateMatchesPrevious(stateRecord))
                this.culledStateHistory.push(stateRecord);

            this.stateHistory.push(stateRecord);

            this.trigger('history-added');
        },

        /**
         * Returns whether or not the given state matches the
         *   previously recorded state.  If no previous state
         *   exists, it returns false.
         */
        stateMatchesPrevious: function(state) {
            if (this.stateHistory.length > 1 &&
                this.stateHistory[this.stateHistory.length - 1].position.equals(state.position)) {
                return true;
            }

            return false;
        },

        /**
         * Applies the appropriate saved state for this moment
         *   in history.
         */
        applyPlaybackState: function() {
            var stateRecord = this.findStateWithClosestTime(this.time);
            if (stateRecord)
                stateRecord.applyState(this.ladybug);
        },

        /**
         * Performs a binary search to find the state whose time
         *   is closest to the specified time.
         */
        findStateWithClosestTime: function(time) {
            if (!this._historyTimes)
                return null;
            
            var stateIndex = binarySearch.closest(this._historyTimes, time);
            return this.stateHistory[stateIndex];
        },

        /**
         * Listens for changes in the paused state of the sim.
         *   We need to set up some stuff before we can play back,
         *   and when we start recording at a new position, we
         *   need to make sure we clear history beyond that point.
         */
        pausedChanged: function(simulation, paused) {
            if (paused) {
                this.prepareForPlayback();
            }
            else {
                if (!this.get('recording'))
                    this.prepareForPlayback();
                else
                    this.clearHistoryAfter(this.get('time'));
            }
        },

        /**
         * Clears history without changing current state of the
         *   ladybug.
         */
        clear: function() {
            var paused = this.get('paused');
            this.pause();

            this.time = 0;
            this.set('time', 0);
            this.set('furthestRecordedTime', 0);
            this.clearHistory();

            if (!paused)
                this.play();
        },

        /**
         * Rewinds to the beginning.
         */
        rewind: function() {
            this.time = 0;
            this.set('time', 0);

            this.applyPlaybackState();

            if (this.get('recording'))
                this.clearHistory();
        },

        /**
         * Sets the sim time to the specified second and applies
         *   the current playback state so the user can see
         *   what happened at that point in time.
         */
        setTime: function(time) {
            this.time = time;
            this.set('time', time);

            this.applyPlaybackState();
        },

        updateModeChanged: function(simulation, updateMode) {
            if (updateMode === UpdateMode.POSITION) {
                this.clearSampleHistory();
                this.resetSamplingMotionModel();
            }
        },

        /**
         * We need to prepare for playback before we can re-apply
         *   any saved states, so we need to catch those cases
         *   when we are in danger of applying a state.
         */
        recordingModeChanged: function(simulation, recording) {
            if (!recording)
                this.prepareForPlayback();
        },

        /**
         * Called before switching to playback (non-recording) mode
         *   to get ready to read stored states in order. It sorts
         *   the array of historical states by time and then plucks
         *   just the times out into a separate array for faster 
         *   random access.
         */
        prepareForPlayback: function() {
            // Sort the historical states by time ascending
            _.sortBy(this.stateHistory, function(state) {
                return state.time;
            });

            /* Store just the times in a parallel array so we
             *   can do a binary search.
             */
            this._historyTimes = _.pluck(this.stateHistory, 'time');
        },

        /**
         * Rotates the ladybug model to the estimated direction
         *   of motion only if it is moving.
         */
        pointInDirectionOfMotion: function() {
            if (this.estimateVelocity().length() > 1E-6)
                this.ladybug.set('angle', this.estimateAngle());
        },

        /**
         * Returns an estimated angle in radians that is derived
         *   from the estimated velocity vector.
         */
        estimateAngle: function() {
            return this.estimateVelocity().angle();
        },

        /**
         * Estimates velocity from historical positions.
         * Note: The original version has an index parameter,
         *   but they must have refactored the function at
         *   some point and didn't update the references to
         *   it, so I've gone through and changed all the
         *   calls because it seemed to be ignoring the index
         *   parameter anyway.
         */
        estimateVelocity: function() {
            var xTimeSeries = this.xTimeSeries;
            var yTimeSeries = this.yTimeSeries;

            var historySample = this.stateHistory.slice(this.stateHistory.length - Constants.ESTIMATION_SAMPLE_SIZE, this.stateHistory.length);
            var diff = Constants.ESTIMATION_SAMPLE_SIZE - historySample.length;
            for (var i = 0; i < historySample.length; i++) {
                xTimeSeries[i + diff].time  = historySample[i].time;
                xTimeSeries[i + diff].value = historySample[i].position.x;

                yTimeSeries[i + diff].time  = historySample[i].time;
                yTimeSeries[i + diff].value = historySample[i].position.y;
            }
            for (var j = 0; j < diff; j++) {
                xTimeSeries[j].time  = 0;
                xTimeSeries[j].value = 0;
                yTimeSeries[j].time  = 0;
                yTimeSeries[j].value = 0;
            }

            var vx = MotionMath.estimateDerivative(xTimeSeries);
            var vy = MotionMath.estimateDerivative(yTimeSeries);

            return this._velocity.set(vx, vy);
        },

        /**
         * Estimates acceleration from historical velocities.
         * Note: The original version has an index parameter,
         *   but they must have refactored the function at
         *   some point and didn't update the references to
         *   it, so I've gone through and changed all the
         *   calls because it seemed to be ignoring the index
         *   parameter anyway.
         */
        estimateAcceleration: function() {
            var xTimeSeries = this.xTimeSeries;
            var yTimeSeries = this.yTimeSeries;

            var historySample = this.stateHistory.slice(this.stateHistory.length - Constants.ESTIMATION_SAMPLE_SIZE, this.stateHistory.length);
            for (var i = 0; i < historySample.length; i++) {
                xTimeSeries[i].time  = historySample[i].time;
                xTimeSeries[i].value = historySample[i].velocity.x;

                yTimeSeries[i].time  = historySample[i].time;
                yTimeSeries[i].value = historySample[i].velocity.y;
            }

            var ax = MotionMath.estimateDerivative(xTimeSeries);
            var ay = MotionMath.estimateDerivative(yTimeSeries);

            return this._acceleration.set(ax, ay);
        },

        /**
         * Sets a bounding box around the scene from the min
         *   and max x and y values.  It's easier to give
         *   these values because one can simply reverse the
         *   model-view-transform with screen coordinates.
         */
        setBounds: function(minX, minY, maxX, maxY) {
            var width = maxX - minX;
            var height = maxY - minY;
            this.bounds.set(minX, minY, width, height);
        },

        /**
         * Returns a bounding rectangle of the scene.
         */
        getBounds: function() {
            return this.bounds;
        },

        /**
         * Returns the ladybug to the center.
         */
        returnLadybug: function() {
            this.ladybug.setPosition(0, 0);
            this.ladybug.setVelocity(0, 0);
            this.clearSampleHistory();
            this.setSamplePoint(this.ladybug.get('position'));
            this.resetSamplingMotionModel();
        },

        ladybugOutOfBounds: function() {
            return !this.bounds.contains(this.ladybug.get('position'));
        }

    });

    return LadybugMotionSimulation;
});

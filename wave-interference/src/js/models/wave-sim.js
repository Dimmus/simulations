define([
	'underscore', 
	'backbone',

	'models/lattice2d',
	'models/oscillator',
	'models/wave-propagator'
], function (_, Backbone, Lattice2D, Oscillator, WavePropagator) {

	'use strict';

	var WaveSimulation = Backbone.Model.extend({
		defaults: {
			damping: {
				x: 20,
				y: 20
			},
			dimensions: {
				width: 100,
				height: 100
			},
			units: {
				distance: 'm',
				time: 's'
			},
			time: 0,
			timeScale: 1.0,

			oscillatorCount: 1,
			frequency: 0.5,
			amplitude: 1.0
		},
		
		initialize: function(options) {

			// Default options
			options = _.extend({
				/**
				 * Lattice size should only matter internally.
				 * It's basically the simulation's level of 
				 *   precision. Conversions
				 */
				latticeSize: {
					width: 60,
					height: 60
				}
			}, options);

			// Lattice
			this.lattice = new Lattice2D({
				width: options.latticeSize.width,
				height: options.latticeSize.height,
				initialValue: 0
			});

			// Wave propagator
			this.propagator = new WavePropagator({
				lattice: this.lattice
			});

			// Oscillators
			this.initOscillators();

			// Event listeners
			this.on('change:oscillatorCount', this.initOscillators);
			this.on('change:frequency',       this.changeFrequency);
			this.on('change:amplitude',       this.changeAmplitude);
		},

		update: function(time, delta) {

			this.propagator.propagate();
			this.oscillators[0].update(time);

		},

		reset: function() {

		},

		resize: function() {
			
		},

		initOscillators: function() {
			this.oscillators = [];
			for (var i = 0; i < this.get('oscillatorCount'); i++) {
				this.oscillators.push(new Oscillator({
					frequency: this.get('frequency'),
					amplitude: this.get('amplitude'),
					x: 4,
					y: 30,
					radius: 2,

					waveSimulation: this,
				}));
			}
		},

		isValidPoint: function(x, y) {
			return (x < this.lattice.width && x >= 0 && y < this.lattice.height && y >= 0);
		},

		setSourceValue: function(x, y, val) {
			this.propagator.setSourceValue(x, y, val);
		},

		changeFrequency: function(model, value) {
			_.each(this.oscillators, function(oscillator) {
				oscillator.frequency = value;
			}, this);
		},

		changeAmplitude: function(model, value) {
			_.each(this.oscillators, function(oscillator) {
				oscillator.amplitude = value;
			}, this);
		}
	});

	return WaveSimulation;
});
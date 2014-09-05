define(function(require) {

	'use strict';

	var $ = require('jquery');

	var OscillatorView = require('views/oscillator');

	/*
	 * "Local" variables for functions to share and recycle
	 */
	var period,
	    releaseTime,
	    n, // What PhET called it--I'm not sure what it represents
	    $drop,
	    i;

	var FaucetOscillatorView = OscillatorView.extend({

		initialize: function(options) {
			OscillatorView.prototype.initialize.apply(this, [options]);

			this.listenTo(this.waveSimulation, 'change:amplitude', this.resize);
		},

		render: function() {
			this.$el.html(this.template({ unique: this.cid }));
			this.$graphic = this.$('.oscillator-graphic');

			
			this.$stream = $('<div class="stream">').appendTo(this.$graphic.find('.part-1'));

			this.$stagedDrops = [];
			this.$activeDrops = [];
			for (i = 0; i < 6; i++) {
				$drop = $('<div class="drop">');
				this.$stream.append($drop);
				this.$stagedDrops.push($drop);
			}
			this.animationDuration = 1;
			this.animationOffset = -0.3;

			this.resize();
			this.update(0, 0);
		},

		update: function(time, delta) {
			if (!this.hidden) {
				this.updateDrops(time, delta);
			}

			if (this.updateOnNextFrame) {
				// Resize the drops
				this.$stream.width(((this.oscillator.amplitude / 2) * 100) + '%');
			}

			OscillatorView.prototype.update.apply(this, [time, delta]);
		},


		updateDrops: function(time, delta) {
			// Check first to see if we can recycle any drops so we can use them later
			for (i = this.$activeDrops.length - 1; i >= 0; i--) {
				if (time > this.$activeDrops[i].data('birth') + this.$activeDrops[i].data('period')) {
					this.recycleDrop(this.$activeDrops[i]);
					this.$activeDrops.splice(i, 1);
				}
			}

			// See if it's time to drip another drop
			if (this.oscillator.enabled) {
				if (this.justBeforeReleaseTime(this.lastOscillatorTime) && this.justAfterReleaseTime(this.oscillator.time))
					this.drip(time);
			}
			this.lastOscillatorTime = this.oscillator.time;
		},

		recycleDrop: function($drop) {
			this.$stagedDrops.push($drop);
			$drop.hide();
		},

		drip: function(time) {
			$drop = this.$stagedDrops.pop();
			if ($drop) {
				$drop.show();
				$drop.data('birth', time);
				$drop.data('period', this.animationDuration * 1000);
				this.$activeDrops.push($drop);
			}
		},

		justBeforeReleaseTime: function(time) {
			releaseTime = this.getNearestReleaseTime(time);
			if (time < releaseTime/* && Math.abs(releaseTime - time) < this.oscillator.period() / 4*/)
				return true;
			return false;
		},

		justAfterReleaseTime: function(time) {
			releaseTime = this.getNearestReleaseTime(time);
			if (time >= releaseTime/* && Math.abs(releaseTime - time) < this.oscillator.period() / 4*/)
				return true;
			return false;
		},

		/**
		 * Copied with very little modification from PhET's FaucetGraphic class.
		 */
		getNearestReleaseTime: function(time) {
			period = this.oscillator.period();
			n = Math.round((time / period) - 0.25 + ((this.animationDuration + this.animationOffset) / period));
			return (period / 4) - (this.animationDuration + this.animationOffset) + (n * period);
		}

	});

	return FaucetOscillatorView;
});
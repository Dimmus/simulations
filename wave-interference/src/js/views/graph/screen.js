define(function(require) {

	'use strict';

	var GraphView       = require('views/graph');

	var html = require('text!templates/screen-graph.html');

	/*
	 * "Local" variables for functions to share and recycle
	 */
	var length,
	    lat,
		latWidth,
		latHeight,
		height,
		xSpacing,
		points,
	    i,
	    j;


	/**
	 * ScreenGraphView shows the values of a certain row of the
	 *   lattice in real time in the form of a curve.
	 */
	var ScreenGraphView = GraphView.extend({

		template: _.template(html),
		className: 'screen-graph-view',

		events: {
			'click .screen-graph-show-button' : 'show',
			'click .screen-graph-hide-button' : 'hide'
		},

		initialize: function(options) {
			// Default values
			options = _.extend({
				title: 'Screen',
				x: null,
				y: null,
				latitudinalGridLines: 0,
				longitudinalGridLines: 0
			}, options);

			GraphView.prototype.initialize.apply(this, [options]);

			if (options.heatmapView)
				this.heatmapView = options.heatmapView;
			else
				throw 'ScreenGraphView requires a HeatmapView instance to render.';

			// Ratio between pixels and cell width
			this.xSpacing = 1;
		},

		/**
		 * Renders html container
		 */
		renderContainer: function() {
			this.$el.html(this.template(this.graphInfo));

			this.$showButton = this.$('.screen-graph-show-button');
			this.$hideButton = this.$('.screen-graph-hide-button');
		},

		/**
		 * Does the actual resizing of the canvas. We need to also update
		 *  our cached xSpacing whenever the canvas size changes.
		 */
		resize: function() {
			GraphView.prototype.resize.apply(this);
			this.xSpacing = this.width / (this.waveSimulation.lattice.width - 1);
		},

		/**
		 * Initializes points array and sets default points.  The number
		 *   of points is based on either the lattice width or height,
		 *   depending on whether the graph is in portrait or landscape.
		 *   This function should be overriden by child classes that
		 *   use the graph to show different data.
		 */
		initPoints: function() {
			this.points = [];

			length = this.portrait ? this.waveSimulation.lattice.height : this.waveSimulation.lattice.width;
			points = this.points;
			for (i = 0; i < length; i++) {
				points[i] = { 
					x: 0, 
					y: 0 
				};
			}
		},

		/**
		 * Calculates point data before drawing.
		 */
		calculatePoints: function() {
			points   = this.points;
			height   = this.height;
			xSpacing = this.xSpacing;

			lat = this.waveSimulation.lattice.data;

			latWidth  = this.waveSimulation.lattice.width;
			latHeight = this.waveSimulation.lattice.height;

			// Set row to where the cross section line is closest to
			j = parseInt(this.waveSimulation.get('crossSectionY') * this.waveSimulation.heightRatio);
			if (j > latHeight - 1)
				j = latHeight - 1;
			
			length = this.portrait ? latHeight : latWidth;
			for (i = 0; i < length; i++) {
				points[i].x = i * xSpacing;
				points[i].y = ((lat[i][j] - 2) / -4) * height;
			}

			// Hide the beginning
			points[0].x = -1;
		},

		show: function(event) {
			this.$('.screen-graph-container').addClass('open');
			this.$showButton.hide();
			this.$hideButton.show();
			this.heatmapView.enableScreenMode();
		},

		hide: function() {
			this.$('.screen-graph-container').removeClass('open');
			this.$hideButton.hide();
			this.$showButton.show();
			this.heatmapView.disableScreenMode();
		}

	});

	return ScreenGraphView;
});
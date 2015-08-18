define(function (require) {

    'use strict';

    var Vector2   = require('common/math/vector2');
    var Rectangle = require('common/math/rectangle');
    var range     = require('common/math/range');

    var Constants = {}; 

    /*************************************************************************
     **                                                                     **
     **                         UNIVERSAL CONSTANTS                         **
     **                                                                     **
     *************************************************************************/

    Constants.SPEED_OF_LIGHT = 6;

    // Original values were 40ms frame duration and 0.5s dt_per_frame, but I
    //   changed it to an equivalent sim-seconds-per-real-second in order to
    //   have a higher framerate.
    Constants.FRAME_DURATION = 0.030; // Seconds
    Constants.DT_PER_FRAME   = 0.375; // Seconds

    Constants.SIMULATION_BOUNDS = new Rectangle(0, 0, 1000, 700);
    Constants.SIMULATION_ORIGIN = new Vector2(108, 325);

    Constants.FREQUENCY_RANGE = range({ min: 0, max: 200, defaultValue: 100 });
    Constants.FREQUENCY_SCALE = 1 / 5000;
    Constants.AMPLITUDE_RANGE = range({ min: 0, max: 100, defaultValue: 50 });
    Constants.DEFAULT_FREQUENCY = Constants.FREQUENCY_RANGE.defaultValue * Constants.FREQUENCY_SCALE;
    Constants.DEFAULT_AMPLITUDE = Constants.AMPLITUDE_RANGE.defaultValue;

    Constants.PANEL_BG = '#D6DFE9';

    return Constants;
});

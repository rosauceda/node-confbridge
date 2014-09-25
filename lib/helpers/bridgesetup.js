'use strict';

var util = require('util');
var db = require('../../data/db.js');

function BridgeSetup(ari) {
  var self = this;

  // Will contain the bridge configuration fetched from the database.
  var settings = null;

  /**
   * Fetches the bridge configuration from the database and stores it in
   * the settings variable.
   */
  self.init = function() {
    db.getBridgeSettings()
      .then(function (result) {
        settings = result;
      })
      .catch(function (err) {
        console.error(err);
      })
      .done();
  }

  /**
   * Finds the bridge or creates one if it doesn't exist. Destroys the bridge
   * when no users remain. Registers listeners to handle events for the bridge.
   *
   * @param {Object} channel - the channel entering the bridge
   */
  self.getOrCreateBridge = function(channel) {
    var playback = ari.Playback();
    ari.bridges.list(function (err, bridges) {
      var bridge = null;
      bridges.forEach(function (candidate) {
        if (candidate.bridge_type === 'mixing') {
          bridge = candidate;
        }
      });
      if (!bridge) {
        bridge = ari.Bridge();
        bridge.create({type: 'mixing'}, function (err, bridge) {
          self.joinMixingBridge(bridge, channel);
        });
        bridge.on('ChannelEnteredBridge', function (event, instances) {
          var mixBridge = instances.bridge;
          if (settings.moh === 'y') {
            if (mixBridge.channels.length === 1 &&
                mixBridge.id === bridge.id) {
              mixBridge.startMoh(function (err) {});
            }
            else {
              mixBridge.stopMoh(function (err) {});
            }
          }
        });
        bridge.on('ChannelLeftBridge', function (event, instances) {
          var mixingBridge = instances.bridge;
          if (mixingBridge.channels.length === 0 &&
              mixingBridge.id === bridge.id) {
            bridge.destroy(function (err) {});
          }
          else {
            if (settings.moh === 'y') {
              if (mixingBridge.channels.length === 1 &&
                  mixingBridge.id === bridge.id) {
                mixingBridge.startMoh(function (err) {});
              }
            }
          }
          if (settings.quiet === 'n') {
            var soundToPlay = util.format('sound:%s', settings.leave_sound);
            mixingBridge.play({media: soundToPlay}, playback,
              function (err, playback) {});
          }
        });
      }
      else {
        self.joinMixingBridge(bridge, channel);
      }
    });
  }

  /**
   * Places the channel into the bridge and plays the join sound.
   *
   * @param {Object} bridge - the bridge to put the channel in
   * @param {Object} channel - the channel to put into the bridge
   */
  self.joinMixingBridge = function(bridge, channel) {
    var playback = ari.Playback();
    bridge.addChannel({channel: channel.id}, function (err) {
      if (settings.quiet === 'n') {
        var soundToPlay = util.format('sound:%s', settings.join_sound);
        bridge.play({media: soundToPlay}, playback, function (err,
          playback) {});
      }
    });
  }

}

module.exports = BridgeSetup;
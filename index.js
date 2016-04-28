'use strict';

var util = require('util');
var stream = require('stream');

var DEFAULT_FILTERS = [
  { 'vendorId': 0x2341, 'productId': 0x8036 }, // Arduino Leonardo
  { 'vendorId': 0x2341, 'productId': 0x8037 }, // Arduino Micro
  { 'vendorId': 0x239a, 'productId': 0x8011 } // Adafruit Circuit Playground
];


function WebUSBSerialPort(options) {
  var self = this;

  options = options || {};
  self.filters = options.filters || DEFAULT_FILTERS;

  navigator.usb.getDevices().then(function(devices){
    if(devices.length){
      return devices[options.deviceNumber || 0];
    }
    return navigator.usb.requestDevice({filters: self.filters });
  })
  .then(function(device){
    self.device = device;

    var readLoop = function(){
      self.device.transferIn(5, 64).then(function(result){
        console.log('read', result);
        self.emit('data', new Buffer(result.data.buffer));
        readLoop();
      }, function(error){
        console.log('read error', error);
        self.emit('emit', error);
      });
    };

    self.device.open()
      .then(function(){
        return self.device.configuration;
      })
      .then(function(config){
        if (config.configurationValue == 1) {
          return {};
        } else {
          throw new Error("Need to setConfiguration(1).");
        }
      })
      .catch(function(error){
        return self.device.setConfiguration(1);
      })
      .then(function(){
        return self.device.claimInterface(2);
      })
      .then(function(){
        return  self.device.controlTransferOut({
          'requestType': 'class',
          'recipient': 'interface',
          'request': 0x22,
          'value': 0x01,
          'index': 0x02});
      })
      .then(function() {
        self.emit('open');
        readLoop();
      });
  })
  .catch(function(err){
    self.emit('error', err);
  });

}

util.inherits(WebUSBSerialPort, stream.Stream);


WebUSBSerialPort.prototype.open = function (callback) {
  this.emit('open');
  if (callback) {
    callback();
  }

};



WebUSBSerialPort.prototype.write = function (data, callback) {
  console.log('send', data);
  return this.device.transferOut(4, data);

};



WebUSBSerialPort.prototype.close = function (callback) {
  console.log('closing');
  var self = this;
  self.device.controlTransferOut({
              'requestType': 'class',
              'recipient': 'interface',
              'request': 0x22,
              'value': 0x00,
              'index': 0x02})
    .then(function(){
      self.device.close();
      if(callback){
        callback();
      }
    });

};

WebUSBSerialPort.prototype.flush = function (callback) {
  console.log('flush');
  if(callback){
    callback();
  }
};

WebUSBSerialPort.prototype.drain = function (callback) {
  console.log('drain');
  if(callback){
    callback();
  }
};



module.exports = {
  SerialPort: WebUSBSerialPort
};

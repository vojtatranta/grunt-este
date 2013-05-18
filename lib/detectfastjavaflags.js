// Add JVM flags we believe will produce the best performance. See
// https://groups.google.com/forum/#!topic/closure-library-discuss/7w_O9-vzlj4

var flags = null;
var callbacksBeforeDetection = [];

module.exports = function(grunt, callback) {

  if (flags) {
    // slice, because we want to protect detected flags array
    callback(flags.slice(0));
    return;
  }

  callbacksBeforeDetection.push(callback);

  // -d32 needs to be tested, but only once because result is cached
  grunt.util.spawn({
    cmd: 'java'
  , args: ['-d32', '-version']
  }, function(error, result, code) {
    // -client should work and help everywhere
    flags = ['-client'];
    if (!error)
      flags.push('-d32');
    callbacksBeforeDetection.forEach(function(callback) {
      callback(flags);
    });
    callbacksBeforeDetection = null;
  });
};
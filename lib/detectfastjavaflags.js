module.exports = function(grunt, callback) {

  // There were more flags for Java 1.6, but current Closure Compiler needs
  // only one. I decided to not remove this file in case of new flags occur.
  var flags = ['-XX:+TieredCompilation'];
  callback(flags);
};
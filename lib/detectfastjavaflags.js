module.exports = function(grunt, callback) {
  // -client should work and help everywhere
  var flags = ['-client'];
  // -d32 need to be tested
  grunt.util.spawn({
    cmd: 'java'
  , args: ['-d32', '-version']
  }, function(error, result, code) {
    if (!error)
      flags.push('-d32');
    callback(flags);
  });
};
/*
 * grunt-este
 * https://github.com/este/grunt-este
 *
 * Copyright (c) 2013 Daniel Steigerwald
 */

module.exports = function(grunt) {
  'use strict';

  var coffee2closure = require('coffee2closure');

  grunt.registerMultiTask('coffee2closure', 'Fixes CoffeeScript compiled output for Google Closure Compiler', function() {

    var count = 0;
    this.files.forEach(function (f) {
      try {
        var file = grunt.file.read(f.dest);
        file = coffee2closure.fix(file);
        grunt.file.write(f.dest, file);
        count++;
      }
      catch(e) {
        grunt.log.writeln('File ' + f.dest + ' failed.');
      }
    });
    grunt.log.ok(count + ' files fixed by coffee2closure.');

  });

};
/*
 * grunt-este
 * https://github.com/este/grunt-este
 * Derived from https://github.com/gruntjs/grunt-contrib-coffee.
 * Uses https://github.com/Steida/coffee2closure module.
 *
 * Copyright (c) 2013 Daniel Steigerwald
 */
module.exports = function (grunt) {

  var coffee2closure = require('coffee2closure');
  var path = require('path');

  grunt.registerMultiTask('esteCoffee', 'Compile CoffeeScript files into JavaScript.',
    function () {

      var options = this.options({
        bare: false,
        separator: grunt.util.linefeed
      });
      var files = this.files;
      var consoleColor = 'cyan';

      if (options.basePath || options.flatten) {
        grunt.fail.warn('Experimental destination wildcards are no longer supported. please refer to README.');
      }

      grunt.verbose.writeflags(options, 'Options');

      // dirty hack to pass only changed file
      // TODO: wait for official solution
      var flags = Object.keys(this.flags);
      if (flags.length == 1) {
        consoleColor = 'yellow';
        files = [{
          src: [flags[0]],
          dest: flags[0].replace('.coffee', '.js')
        }];
      }

      files.forEach(function(f) {
        var output = f.src.filter(function(filepath) {
          // Warn on and remove invalid source files (if nonull was set).
          if (!grunt.file.exists(filepath)) {
            grunt.log.warn('Source file "' + filepath + '" not found.');
            return false;
          } else {
            return true;
          }
        }).map(function(path) {
          return compileCoffee(path, options);
        }).join(grunt.util.normalizelf(options.separator));

        if (output.length < 1) {
          grunt.log.warn('Destination not written because compiled files were empty.');
        } else {
          output = coffee2closure.fix(output);
          grunt.file.write(f.dest, output);
          grunt.log.writeln('File ' + f.dest[consoleColor] + ' created.');
        }
      });
    });

  var compileCoffee = function(srcFile, options) {
    options = grunt.util._.extend({filename: srcFile}, options);

    var srcCode = grunt.file.read(srcFile);

    try {
      return require('coffee-script').compile(srcCode, options);
    } catch (e) {
      grunt.log.error(e);
      grunt.fail.warn('CoffeeScript failed to compile.');
    }
  };
};
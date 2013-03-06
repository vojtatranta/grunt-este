/*
 * grunt-este
 * https://github.com/este/grunt-este
 * Derived from https://github.com/gruntjs/grunt-contrib-stylus
 *
 * Copyright (c) 2013 Daniel Steigerwald
 */

module.exports = function(grunt) {
  var path = require('path');

  grunt.registerMultiTask('esteStylus', 'Compile Stylus files into CSS', function() {
    var done = this.async();

    var options = this.options({
      compress: true
    });

    if (options.basePath || options.flatten) {
      grunt.fail.warn('Experimental destination wildcards are no longer supported. please refer to README.');
    }

    grunt.verbose.writeflags(options, 'Options');

    // dirty hack to pass only changed file
    // TODO: wait for official solution
    var files = this.files;
    var flags = Object.keys(this.flags);
    if (flags.length == 1) {
      files = [];
      var add = function(src) {
        files.push({
          src: [src],
          dest: src.replace('.styl', '.css')
        });
      };
      add(flags[0]);
      // workaround to ensure file importing changed file is compiled too
      this.files.forEach(function(item) {
        if (item.src[0] == flags[0]) return;
        src = grunt.file.read(item.src[0]);
        if (src.indexOf('@import') < 0) return;
        add(item.src[0]);
      });
    }

    grunt.util.async.forEachSeries(files, function(f, n) {
      var destFile = path.normalize(f.dest);
      var srcFiles = f.src.filter(function(filepath) {
        // Warn on and remove invalid source files (if nonull was set).
        if (!grunt.file.exists(filepath)) {
          grunt.log.warn('Source file "' + filepath + '" not found.');
          return false;
        } else {
          return true;
        }
      });

      if (srcFiles.length === 0) {
        // No src files, goto next target. Warn would have been issued above.
        n();
      }

      var compiled = [];
      grunt.util.async.concatSeries(srcFiles, function(file, next) {
        compileStylus(file, options, function(css, err) {
          if (!err) {
            compiled.push(css);
            next(null);
          } else {
            n(false);
          }
        });
      }, function() {
        if (compiled.length < 1) {
          grunt.log.warn('Destination not written because compiled files were empty.');
        } else {
          grunt.file.write(destFile, compiled.join(grunt.util.normalizelf(grunt.util.linefeed)));
          grunt.log.writeln('File ' + destFile.cyan + ' created.');
        }
        n();
      });
    }, done);
  });

  var compileStylus = function(srcFile, options, callback) {
    options = grunt.util._.extend({filename: srcFile}, options);

    // Never compress output in debug mode
    if (grunt.option('debug')) {
      options.compress = false;
    }

    var srcCode = grunt.file.read(srcFile);
    var stylus = require('stylus');
    var s = stylus(srcCode);

    grunt.util._.each(options, function(value, key) {
      if (key === 'urlfunc') {
        // Custom name of function for embedding images as Data URI
        s.define(value, stylus.url());
      } else if (key === 'use') {
        value.forEach(function(func) {
          if (typeof func === 'function') {
            s.use(func());
          }
        });
      } else if (key === 'import') {
        value.forEach(function(stylusModule) {
          s['import'](stylusModule);
        });
      } else {
        s.set(key, value);
      }
    });

    // Load Nib if available
    try {
      s.use(require('nib')());
    } catch (e) {}

    s.render(function(err, css) {
      if (err) {
        grunt.log.error(err);
        grunt.fail.warn('Stylus failed to compile.');

        callback(css, true);
      } else {
        callback(css, null);
      }
    });
  };
};

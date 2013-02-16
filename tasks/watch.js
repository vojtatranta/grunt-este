/*
 * grunt-este
 * https://github.com/este/grunt-este
 * Custom watch, because https://github.com/gruntjs/grunt/issues/581.
 * Features
 *   - support targets (it's multitask)
 *   - compiles just one changed file (for tasks which supports it)
 *   - it detects added files (but not in just created dirs)
 * There is no 'too much tasks is running' control, so be careful.
 *
 * Copyright (c) 2013 Daniel Steigerwald
 */
module.exports = function (grunt) {

  var path = require('path');
  var Gaze = require('gaze').Gaze;
  var waiting = 'Waiting...';

  grunt.registerMultiTask('esteWatch', 'Custom watch, because https://github.com/gruntjs/grunt/issues/581.',
    function () {

      var options = this.options({
        // not supported yet
        // autoDelete: {
        //   coffee: 'js',
        //   soy: 'js',
        //   styl: 'css'
        // }
      });
      var done = this.async();

      for (var target in this.data) {
        var targetFiles = this.data[target].files;
        var targetTasks = this.data[target].tasks;
        runGaze(target, targetFiles, targetTasks, options, done);
      }

      grunt.log.writeln(waiting);

    }
  );

  var runGaze = function(target, targetFiles, targetTasks, options, done) {
    // Don't use grunt.file.expand on targetFiles, like grunt-contrib-watch,
    // because then watching for added files does not work. Unfortunately, this
    // disables exclusion pattern too. Fortunately, there is a pull request
    // https://github.com/shama/gaze/pull/21 yet.

    if (!Array.isArray(targetTasks))
      targetTasks = [targetTasks];

    var gaze = new Gaze(targetFiles, {}, function(err) {
      if (err) {
        grunt.log.error(err.message);
        return done();
      }

      this.on('all', function(status, filePath) {
        filePath = path.relative(process.cwd(), filePath);
        onGazeAll(target, targetTasks, status, filePath, options);
      });

      this.on('error', function(err) {
        grunt.log.error(err);
      });
    });

  };

  var onGazeAll = function(target, targetTasks, status, filePath, options) {
    origFilePath = filePath;
    // fix for windows
    filePath = filePath.replace(/\\/g, '/');

    // dirty workaround, pass filePath as target flag
    var args = targetTasks.map(function(target) {
      return target + ':' + filePath;
    });

    if (status == 'deleted') {
      return;
    }

    // does not work yet, disables watching, try restart gaze
    // if (status == 'deleted' && options.autoDelete) {
    //   for (var ext1 in options.autoDelete) {
    //     var ext2 = options.autoDelete[ext1];
    //     if (~filePath.indexOf('.' + ext1)) {
    //       origFilePath = origFilePath.replace('.' + ext1, '.' + ext2);
    //       grunt.file['delete'](origFilePath);
    //       grunt.log.writeln('File ' + origFilePath + ' deleted.');
    //       return;
    //     }
    //   }
    //   return;
    // }

    grunt.log.writeln(status + ' ' + filePath);

    grunt.util.spawn({
      grunt: true,
      opts: {
        cwd: process.cwd(),
        stdio: 'inherit'
      },
      args: args
    }, function(error, result, code) {
      grunt.log.writeln('').writeln('Waiting...');
    });

  };
};
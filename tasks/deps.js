/*
 * grunt-este
 * https://github.com/este/grunt-este
 *
 * Copyright (c) 2013 Daniel Steigerwald
 */
module.exports = function (grunt) {

  var path = require('path');
  var cache = {};

  grunt.registerMultiTask('esteDeps', 'Google Closure dependency calculator.',
    function () {

      var options = this.options({

        depsWriterPath: './bower_components/closure-library/closure/bin/build/depswriter.py',

        /**
         * Python bin name. Useful for Linux where both Python 2 and 3 can be
         * installed. Use Python 2 for Windows.
         * @type {string}
         */
        pythonBin: 'python',

        /**
         * If specified, write output to this path instead of writing to
         * standard output.
         * @type {string}
         */
        outputFile: '',

        /**
         * Use this option only with root definiton. It will convert root into
         * root_with_prefix.
         * @type {string}
         */
        prefix: '',

        /**
         * A root directories to scan for JS source files. Paths of JS files in
         * generated deps file will be relative to this path.
         * @type {string|Array.<string>}
         */
        root: '',

        /**
         * Folder where is script executed
         * @type {string}
         */
        execDir: './'

      });

      var args = [options.depsWriterPath];
      var pythonBin = options.pythonBin;
      var prefix = options.prefix;
      var outputFile = options.outputFile;
      var execDir = options.execDir;

      // check if we really need to run deps on watch
      if (this.filesSrc.length) {
        var previousCacheState = JSON.stringify(cache);
        this.filesSrc.forEach(function(fileSrc) {
          var file = grunt.file.read(fileSrc);
          cache[fileSrc] = {
            requires: file.match(/goog\.require\(\s*['"](.+?)['"]\s*\)/g),
            provides: file.match(/goog\.provide\(\s*['"](.+?)['"]\s*\)/g)
          };
        });
        if (previousCacheState == JSON.stringify(cache)) {
          grunt.log.writeln('Nothing changed.');
          return;
        }
      }

      delete options.depsWriterPath;
      delete options.pythonBin;
      delete options.prefix;
      delete options.outputFile;
      delete options.execDir;

      options.output_file = outputFile;

      for (var option in options) {
        var value = options[option];
        if (!value) continue;
        if (!Array.isArray(value)) value = [value];

        var addPrefix = prefix && option == 'root';
        if (addPrefix) option = 'root_with_prefix';

        for(var i = 0; i < value.length; i++) {
          var item = value[i];
          if (addPrefix) item += ' ' + prefix + item;
          args.push('--' + option + '=' + item);
        }
      }

      var done = this.async();
      var onSpawnDone = function(error, result, code) {
        // Missing required namespace and others error are reported in
        // esteBuilder tasks.
        if (error) {
          grunt.log.error(error);
          done(false);
        }
        else {
          grunt.log.writeln('File ' + outputFile.yellow + ' created.');
          done();
        }
      };

      grunt.file.mkdir(path.dirname(outputFile));
      grunt.util.spawn({
        cmd: pythonBin,
        args: args,
        opts: {
          cwd: execDir
        }
      }, onSpawnDone);

    }
  );
};
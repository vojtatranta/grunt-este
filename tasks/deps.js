/*
 * grunt-este
 * https://github.com/este/grunt-este
 *
 * Copyright (c) 2013 Daniel Steigerwald
 */
module.exports = function (grunt) {

  var path = require('path');

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
        root: ''

      });

      var args = [options.depsWriterPath];
      var pythonBin = options.pythonBin;
      var prefix = options.prefix;
      var outputFile = options.outputFile;

      delete options.depsWriterPath;
      delete options.pythonBin;
      delete options.prefix;
      delete options.outputFile;

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
        args: args
      }, onSpawnDone);

    }
  );
};
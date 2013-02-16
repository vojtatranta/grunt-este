/*
 * grunt-este
 * https://github.com/este/grunt-este
 * https://developers.google.com/closure/library/docs/closurebuilder
 *
 * Copyright (c) 2013 Daniel Steigerwald
 */
module.exports = function (grunt) {

  var path = require('path');
  var fs = require('fs');
  var gzip = require('zlib').gzip;
  var Tempdir = require('temporary/lib/dir');
  var Tempfile = require('temporary/lib/file');
  var wrench = require('wrench');

  grunt.registerMultiTask('esteBuilder', 'Google Closure dependency calculator.',
    function () {

      var done = this.async();
      var tempdir = new Tempdir();
      var tempFlagFile = new Tempfile();
      var options = this.options({

        /**
         * The location of the Closure builder .py file.
         */
        closureBuilderPath: 'bower_components/closure-library/closure/bin/build/closurebuilder.py'

        /**
         * The location of the Closure compiler .jar file.
         */
      , compilerPath: 'bower_components/closure-compiler/compiler.jar'

        /**
         * Path for compiled file.
         */
      , outputFilePath: ''

        /**
         * Path to deps file.
         */
      , depsPath: 'client/app/js/deps.js'

        /**
         * Strip this.logger_ from compiled code.
         */
      , stripLoggers: false

        /**
         * The paths that should be traversed to build the dependencies.
         * @type {string|Array.<string>}
         */
      , root: ''

        /**
         * One or more namespaces to calculate dependencies for. These
         * namespaces will be combined with those given with the input option
         * to form the set of namespaces to find dependencies for. A Closure
         * namespace is a dot-delimited path expression declared with a call to
         * goog.provide() (e.g. "goog.array" or "foo.bar").
         * @type {string|Array.<string>}
         */
      , namespace: ''

        /**
         * Additional flags to pass to the Closure compiler. To pass multiple
         * flags, --compiler_flags has to be specified multiple times.
         * @type {string|Array.<string>}
         */
      , compilerFlags: ''

        /**
         * Python bin name. Useful for Linux where both Python 2 and 3 can be
         * installed. Use Python 2 for Windows.
         * @type {string}
         */
      , pythonBin: 'python'

        /**
         * Java CL options to much faster Closure compilation.
         * false by default, because it needs Java 1.7+.
         * @type {string}
         */
      , fastCompilation: false

        /**
         * One or more input files to calculate dependencies for. The
         * namespaces in this file will be combined with those given with the
         * namespace option to form the set of namespaces to find dependencies
         * for.
         * @type {string|Array.<string>}
         */
        // input: ''

      });

      // It's good to have real temp dir for build. We need to change them
      // sometimes, and Windows has no problem with deleting.
      updateOptionsRootToTemp(options.root, tempdir.path);
      copyRootsToTemp(options.root, tempdir.path);
      if (options.stripLoggers)
        removeLoggersFromCode(options.root);

      var builderArgs = [
        options.closureBuilderPath
      ].concat(createArgs({
        namespace: options.namespace
      , root: options.root
      , output_mode: 'list'
      , output_file: tempFlagFile.path
      }));

      // Run closure builder to get list of files to compile.
      grunt.util.spawn({
        cmd: options.pythonBin
      , args: builderArgs
      }, function(error, result, code) {
        if (isError(error, result.stderr, done))
          return;

        makeFlagFileFromListOfFilesToCompile(tempFlagFile.path);

        // -client and -d32 options is a huge speed improvement for compilation
        // https://groups.google.com/forum/?fromgroups=#!topic/closure-library-discuss/7w_O9-vzlj4
        var compilerArgs = ['-jar'];
        if (options.fastCompilation)
          compilerArgs.push('-client', '-d32');
        compilerArgs.push(options.compilerPath);
          
        compilerArgs = compilerArgs
        .concat(options.compilerFlags)
        .concat(createArgs({
          js_output_file: options.outputFilePath
        , js: options.depsPath
          // This fixes Windows command line length limitation.
        , flagfile: tempFlagFile.path
        }));

        grunt.log.write('Compiling.');
        var timer = setInterval(function() {
          grunt.log.write('.');
        }, 1000);

        // Run Closure compiler. We can't use closurebuilder.py, because
        // Windows has a limit for command line length (8191 characters).
        var compilationStart = Date.now();
        grunt.util.spawn({
          cmd: 'java'
        , args: compilerArgs
        }, function(error, result, code) {
          clearInterval(timer);
          grunt.log.write('\n');

          // Wrench is good, because it removes nonempty directories.
          wrench.rmdirSyncRecursive(tempdir.path);

          if (isError(error, result.stderr, done))
            return;

          grunt.log.writeln(
            'File ' + options.outputFilePath.yellow + ' created. ' +
            ('(' + (Date.now() - compilationStart) + ' ms)').grey
          );

          showGzipSize(options.outputFilePath, done);
        });
      });
    }
  );

  var updateOptionsRootToTemp = function(roots, tempDirPath) {
    for(var i = 0; i < roots.length; i++) {
      roots[i] = tempDirPath + '/' + roots[i];
    }
  };

  var createArgs = function(options) {
    var args = [];
    for (var option in options) {
      var value = options[option];
      if (!value) continue;
      if (!Array.isArray(value))
        value = [value];
      for(var i = 0; i < value.length; i++)
        args.push('--' + option + '=' + value[i]);
    }
    return args;
  };

  // Because warnings are errors too.
  var isError = function(error, stderr, done) {
    // python error, or force compiler warnings and some other errors
    if (error || looksLikeError(stderr)) {
      var message = removeLastLine(stderr);
      grunt.log.error(message);
      done(false);
      return true;
    }
  };

  // Fuzzy a bit, but it works good enough.
  var looksLikeError = function(result) {
    return  ~result.indexOf(': WARNING - ') ||
            ~result.indexOf(': ERROR - ') ||
            ~result.indexOf('JavaScript compilation failed.') ||
            ~result.indexOf('Traceback (most recent call last):');
  };

  // Because it can be misleading, Warnings mean fail.
  var removeLastLine = function(msg) {
    msg = canonicalizeNewlines(msg);
    var lines = msg.split('\n');
    var lastLine = lines[lines.length - 1];
    if (~lastLine.indexOf('JavaScript compilation succeeded.') ||
        ~lastLine.indexOf('JavaScript compilation failed.')) {
      lines.pop();
      msg = lines.join('\n');
    }
    return msg;
  };

  var canonicalizeNewlines = function(str) {
    return str.replace(/(\r\n|\r|\n)/g, '\n');
  };

  var removeLoggersFromCode = function(roots) {
    for (var i = 0; i < roots.length; i++) {
      var root = roots[i];
      grunt.file.recurse(root, function(path) {
        if (path.indexOf('.js') < 0)
          return;
        var source = grunt.file.read(path);
        if (source.indexOf('this.logger_.') < 0)
          return;
        // Just put goog.DEBUG before and compiler will remove them.
        source = source
          .replace(/[^_](this\.logger_\.)/g, 'goog.DEBUG && this.logger_.')
          .replace(/_this\.logger_\./g, 'goog.DEBUG && _this.logger_.');
        grunt.file.write(path, source);
      });
    }
  };

  var copyRootsToTemp = function(roots, tempDirPath) {
    for (var i = 0; i < roots.length; i++) {
      var root = roots[i];
      var from = root.replace(tempDirPath + '/', '');
      // Is 0777 mode default still needed?
      wrench.mkdirSyncRecursive(root);
      wrench.copyDirSyncRecursive(from, root, {
        excludeHiddenUnix: true,
        whitelist: true,
        // Only dirs and .js files.
        filter: /^[\w\-]+$|\.js$/i
      });
    }
  };

  var makeFlagFileFromListOfFilesToCompile = function(path) {
    var listOfFiles = grunt.file.read(path);
    var flagFile = [];
    var lines = listOfFiles.split('\n');
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line) continue;
      flagFile.push('--js=' + line);
    }
    grunt.file.write(path, flagFile.join('\n'));
  };

  var showGzipSize = function(filePath, done) {
    var file = grunt.file.read(filePath);
    gzip(file, function(error, buffer) {
      if (error) {
        grunt.log.error(error);
        done(false);
        return;
      }
      var gzipSize = buffer.toString().length;
      grunt.log.writeln('Compressed size: ' +
        String((gzipSize / 1024).toFixed(2)).green + ' KB gzipped.');
      done();
    });
  };
};
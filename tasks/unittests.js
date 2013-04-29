/*
 * grunt-este
 * https://github.com/este/grunt-este
 * TODO: consider Testacular, PhantomJS, JSDOM
 *
 * Copyright (c) 2013 Daniel Steigerwald
 */
module.exports = function (grunt) {

  var fs = require('fs');
  var Mocha = require('mocha');
  var path = require('path');
  var Tempfile = require('temporary/lib/file');

  grunt.registerMultiTask('esteUnitTests', 'Fast unit testing.',
    function() {

      var options = this.options({
        basePath: 'bower_components/closure-library/closure/goog/base.js',
        depsPath: 'client/app/js/deps.js',
        prefix: '../../../../../',
        mockFile: __dirname + '../lib/mocks.js',

        // Mocha options
        ui: 'tdd',
        reporter: 'dot',
        globals: [],
        timeout: 100

        // bail: true,
        // slow: xy,
        // ignoreLeaks: false,
        // grep: string or regexp to filter tests with
      });

      var basePath = options.basePath;
      var deps = getDeps(options.depsPath, options.prefix);
      var testFiles = this.filesSrc;
      var tempNodeBaseFile = new Tempfile();

      // dirty hack to pass only changed file
      // TODO: wait for official solution
      var flags = Object.keys(this.flags);
      if (flags.length == 1) {
        var filePath = flags[0];
        // both foo.js and foo_test.js supported
        if (filePath.indexOf('_test.js') < 0)
          filePath = filePath.replace('.js', '_test.js');
        if (!grunt.file.exists(filePath)) {
          grunt.log.writeln('No tests.');
          return;
        }
        testFiles = [filePath];
      }

      var namespaces = getNamespaces(testFiles, deps);
      var depsFiles = getDepsFiles(namespaces, deps);
      var mocksPath = options.mockFile;

      delete options.basePath;
      delete options.depsPath;
      delete options.prefix;
      delete options.mockFile;

      var mocha = new Mocha(options);

      var fixedBasePath = fixGoogBaseForNodeAndGetPath(
        basePath,
        tempNodeBaseFile);
      var files = [
        fixedBasePath,
        mocksPath
      ];

      files.push.apply(files, depsFiles);
      files.push.apply(files, testFiles);

      var absoluteFiles = files.map(function(file) {
        return path.resolve(file);
      });
      absoluteFiles.forEach(mocha.addFile.bind(mocha));

      var done = this.async();
      // Enforce stack if Mocha crash, for example with "Cannot read property
      // 'required' of undefined" message.
      try {
        mocha.run(function(errCount) {
          tempNodeBaseFile.unlink();
          done(!errCount);
        });
      }
      catch (e) {
        tempNodeBaseFile.unlink();
        grunt.log.error(e.stack);
        done(false);
      }

    }
  );

  /**
    @return {Object} Example:
      'app.start': {
        src: 'client/app/js/start.js',
        dependencies: [
          'app.templates',
          'este.dev.Monitor.create',
          'goog.dom',
          'goog.events']
      }
  */
  var getDeps = function(depsPath, prefix) {
    var deps = {};
    var depsFile = fs.readFileSync(depsPath, 'utf8');
    var goog = {
      addDependency: function(src, namespaces, dependencies) {
        for (var i = 0; i < namespaces.length; i++) {
          deps[namespaces[i]] = {
            src: src.replace(prefix, ''),
            dependencies: dependencies
          };
        }
      }
    };
    eval(depsFile);
    return deps;
  };

  /**
    @param {Array.<string>} testFiles
    @param {Object} deps
    @return {Array.<string>}
  */
  var getNamespaces = function(testFiles, deps) {
    var namespaces = [
      // for DOM event simulation
      'goog.testing.events'
    ];
    for (var namespace in deps) {
      var src = deps[namespace].src;
      if (~testFiles.indexOf(src.replace('.js', '_test.js')))
        namespaces.push(namespace);
    }
    return namespaces;
  };

  /**
    @param {Array.<string>} namespaces
    @param {Object} deps
    @return {Array.<string>}
  */
  var getDepsFiles = function(namespaces, deps) {
    var files = [];
    var resolve = function(namespaces) {
      for (var i = 0, length = namespaces.length; i < length; i++) {
        var namespace = namespaces[i];
        if (!deps[namespace])
          continue;
        var src = deps[namespace].src;
        if (~files.indexOf(src))
          continue;
        resolve(deps[namespace].dependencies);
        files.push(src);
      }
    };
    resolve(namespaces);
    return files;
  };

  /**
    @param {string} basePath
    @param {Tempfile} tempNodeBaseFile
    @return {string}
  */
  var fixGoogBaseForNodeAndGetPath = function(basePath, tempNodeBaseFile) {
    var file = fs.readFileSync(basePath, 'utf8');
    // fix Google Closure base.js for NodeJS
    file = file.replace('var goog = goog || {};', 'global.goog = global.goog || {};');
    file = file.replace('goog.global = this;', 'goog.global = global;');
    grunt.file.write(tempNodeBaseFile.path, file, 'utf8');
    return tempNodeBaseFile.path;
  };

};

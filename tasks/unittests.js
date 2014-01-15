/*
 * grunt-este
 * https://github.com/este/grunt-este
 * Copyright (c) 2013 Daniel Steigerwald
 */
module.exports = function (grunt) {

  var jsdom = require('jsdom').jsdom;
  var Mocha = require('mocha');
  var path = require('path');
  var previousGlobalKeys;
  var requireUncache = require('require-uncache');
  var shouldResetGoog = false;
  var React;

  // Useful global shortcuts available in every test.
  global.assert = require('chai').assert;
  global.sinon = require('sinon');

  grunt.registerMultiTask('esteUnitTests', 'Super-fast unit testing for Google Closure with Mocha in Node.js',
    function() {

      var options = this.options({
        bootstrapPath: 'bower_components/closure-library/closure/goog/bootstrap/nodejs.js',
        depsPath: 'client/deps.js',
        // TODO: Try to compute it.
        prefix: '../../../../',
        mocha: {
          ui: 'tdd',
          reporter: 'dot',
          globals: [],
          timeout: 100
        }
      });

      // Investigate why path resolving is needed.
      var bootstrapPathResolved = path.resolve(options.bootstrapPath);
      var depsPathResolved = path.resolve(options.depsPath);

      if (shouldResetGoog) {
        requireUncache(bootstrapPathResolved);
        requireUncache(depsPathResolved);
        Object.keys(global).forEach(function(key) {
          if (previousGlobalKeys.indexOf(key) > -1) return;
          delete global[key];
        });
      }
      else {
        shouldResetGoog = true;
      }

      previousGlobalKeys = Object.keys(global);

      require(bootstrapPathResolved);
      require(depsPathResolved);

      // Lazy preload React.
      goog.require('este.thirdParty.react');
      React = React || goog.global.React;

      // Mock browser.
      var doc = jsdom();
      global.window = doc.parentWindow;
      global.document = doc.parentWindow.document;
      global.React = global.window.React = React;

      var testFiles = this.filesSrc;

      // Watch node, map tests to tested files.
      testFiles = testFiles.map(function(file) {
        if (file.indexOf('_test.') == -1)
          file = file.replace('.', '_test.');
        return file;
      });

      // Watch mode, do nothing for missing test.
      if (testFiles.length == 1 && !grunt.file.exists(testFiles[0])) {
        return;
      }

      // Require tests deps.
      testFiles.forEach(function(testFile) {
        file = testFile.replace('_test.js', '.js');
        namespaces = goog.dependencies_.pathToNames[options.prefix + file];
        for (var namespace in namespaces) {
          goog.require(namespace);
        }
      });

      var mocha = new Mocha(options.mocha);

      // Workaround for mocha "0 tests complete" issue.
      // github.com/visionmedia/mocha/issues/445#issuecomment-17693393
      mocha.suite.on('pre-require', function(context, file) {
        requireUncache(file);
      });

      testFiles.forEach(function(testFile) {
        mocha.addFile(path.resolve(testFile));
      });

      // Enforce stack on Mocha crash.
      var done = this.async();
      try {
        mocha.run(function(errCount) {
          done(!errCount);
        });
      }
      catch (e) {
        grunt.log.error(e.stack);
        done(false);
      }

    }
  );
};
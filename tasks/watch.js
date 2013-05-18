/**
  @fileoverview Este files watcher. Node 0.9.2+ is required.

  What's wrong with grunt-contrib-watch?
   It's slow, buggy, and not handy.
   And simply does not work. (TODO: add opened issues)

  Why Este watch is better than grunt-contrib-coffee?
    It's fast, reliable, and handy.
    With concise configuration.
    Without LiveReload console.log mess.
    Also files created in new directories are detected.
    And saves battery.

  Copyright (c) 2013 Daniel Steigerwald
*/
module.exports = function(grunt) {

  var fs = require('fs');
  var path = require('path');
  var tinylr = require('tiny-lr');

  var RESTART_WATCHERS_DEBOUNCE = 10;

  var changedFilesForLiveReload = [];
  var circularsCache = {};
  var repeatedCache = {};
  var done;
  var filesChangedWithinTask = {};
  var firstRun = true;
  var lrServer;
  var options;
  var watchers = [];
  var watchTaskStart;

  grunt.registerTask('esteWatch', 'Este files watcher.', function() {

    options = this.options({
      dirs: [
        'bower_components/closure-library/**/',
        'bower_components/este-library/**/',
        '!bower_components/este-library/node_modules/**/',
        'client/**/{js,css}/**/'
      ],
      livereload: {
        port: 35729,
        extensions: ['js', 'css']
      }
    });
    done = this.async();
    repeatedCache = {};

    if (firstRun) {
      firstRun = false;
      restartWatchers();
      runLiveReloadServer();
      keepThisTaskRunForeverViaHideousHack();
    }

    grunt.log.ok('Waiting...');
    watchTaskStart = Date.now();

  });

  grunt.registerTask('esteWatchLiveReload', function() {
    if (changedFilesForLiveReload.length) {
      notifyLiveReloadServer(changedFilesForLiveReload);
      changedFilesForLiveReload = [];
    }
  });

  // watchers are restarted on start and dir change
  // TODO: handle hypothetic situation, when task create dir
  var restartWatchers = function() {
    var start = Date.now();
    closeWatchers();
    var allDirs = grunt.file.expand(options.dirs);
    grunt.verbose.writeln('Watched dirs: ' + allDirs);
    watchDirs(allDirs);
    var duration = Date.now() - start;
    grunt.log.writeln((
      allDirs.length + ' dirs watched within ' + duration + ' ms.').cyan);
  };

  // It's safer to wait in case of bulk changes.
  var restartWatchersDebounced = grunt.util._.debounce(
    restartWatchers, RESTART_WATCHERS_DEBOUNCE);

  var runLiveReloadServer = function() {
    lrServer = tinylr();
    lrServer.server.removeAllListeners('error');
    lrServer.server.on('error', function(err) {
      if (err.code === 'EADDRINUSE') {
        grunt.fatal('Port ' + options.port + ' is already in use by another process.');
        grunt.fatal('Open OS process manager and kill all node\'s processes.');
      } else {
        grunt.fatal(err);
      }
      process.exit(1);
    });
    lrServer.listen(options.livereload.port, function(err) {
      if (err) {
        grunt.fatal(err);
        return;
      }
      grunt.log.writeln(
        'LiveReload server started on port: ' + options.livereload.port);
    });
  };

  // TODO: fork&fix Grunt
  var keepThisTaskRunForeverViaHideousHack = function() {
    grunt.warn = grunt.fail.warn = function(e) {
      var message = typeof e === 'string' ? e : e.message;
      grunt.log.writeln(('Warning: ' + message).yellow);
      if (grunt.option('force')) return;
      rerun();
    };

    grunt.fatal = grunt.fail.fatal = function(e) {
      var message = typeof e === 'string' ? e : e.message;
      grunt.log.writeln(('Fatal error: ' + message).red);
      rerun();
    };
  };

  var rerun = function() {
    grunt.task.clearQueue();
    grunt.task.run('esteWatch');
  };

  var closeWatchers = function() {
    watchers.forEach(function(watcher) {
      watcher.close();
    });
    watchers = [];
  };

  var watchDirs = function(dirs) {
    dirs.forEach(function(dir) {
      var watcher = fs.watch(dir, function(event, filename) {
        onDirChange(event, filename, dir);
      });
      watchers.push(watcher);
    });
  };

  var onDirChange = function(event, filename, dir) {
    var filepath = path.join(dir || '', filename || '');
    // fs.statSync fails on deleted symlink dirs with "Abort trap: 6" exception
    // https://github.com/bevry/watchr/issues/42
    // https://github.com/joyent/node/issues/4261
    var fileExists = fs.existsSync(filepath);
    if (!fileExists)
      return;
    if (fs.statSync(filepath).isDirectory()) {
      grunt.log.ok('Dir changed: ' + filepath);
      restartWatchersDebounced();
      return;
    }
    onFileChange(filepath);
  };

  var onFileChange = function(filepath) {
    if (repeatedCache[filepath])
      return;
    repeatedCache[filepath] = true;

    grunt.verbose.writeln('onFileChange, filepath: ' + filepath);

    // postpone changes occured during tasks execution
    if (grunt.task.current.name != 'esteWatch') {
      filesChangedWithinTask[filepath] = true;
      return;
    }

    // detect user 'unit of work', to reset circular deps detection
    var userAction = (Date.now() - watchTaskStart) > 500;
    if (userAction) {
      circularsCache = {};
      grunt.log.ok('User action.'.yellow);
    }

    // concat and unique all changed files
    var changedDuringTask = grunt.util._.keys(filesChangedWithinTask);
    filesChangedWithinTask = {};
    var filepaths = [filepath].concat(changedDuringTask);
    filepaths = grunt.util._.uniq(filepaths);
    changedFilesForLiveReload = changedFilesForLiveReload.concat(filepaths);

    // run tasks for changed files
    var tasks = [];
    for (var i = 0; i < filepaths.length; i++) {
      var filepathsItem = filepaths[i];
      // detect circular tasks, to prevent infinite loop
      if (circularsCache[filepathsItem]) {
        grunt.log.error('Circular dependency detected: ' + filepathsItem);
        grunt.log.error('Check your esteWatch:options:dir configuration.');
        grunt.log.error('For example, if css task generate also watched css file, we are in loop.');
        grunt.log.error('But you probably pressed cmd-s to fastly.');
        return;
      }
      circularsCache[filepathsItem] = true;
      grunt.log.ok('File changed: ' + filepathsItem);
      var filepathTasks = getFilepathTasks(filepathsItem);
      tasks = tasks.concat(filepathTasks);
    }
    tasks.push('esteWatchLiveReload', 'esteWatch');
    done();
    grunt.task.run(tasks);
  };

  var notifyLiveReloadServer = function(filepaths) {
    grunt.verbose.ok('notifyLiveReloadServer: ' + filepaths);
    filepaths = filepaths.filter(function(filepath) {
      var ext = path.extname(filepath).slice(1);
      return options.livereload.extensions.indexOf(ext) != -1;
    });
    if (!filepaths.length) {
      grunt.log.writeln('Nothing to live reload.')
      return;
    }
    lrServer.changed({
      body: {
        files: filepaths
      }
    });
  };

  var getFilepathTasks = function(filepath) {
    var ext = path.extname(filepath).slice(1);
    var config = grunt.config.get(['esteWatch', ext]);
    if (!config)
      return [];
    return config(filepath) || [];
  };

};
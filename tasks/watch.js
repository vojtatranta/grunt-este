/**
  @fileoverview Este file watcher.

  What's wrong with grunt-contrib-watch?
   It's slow, buggy, and not handy.

  Why Este watch is better than grunt-contrib-coffee?
    It's fast, reliable, and handy.
    With concise configuration.
    Without LiveReload console.log mess.
    And files created in new directories are detected.
    Also does not use polled fs.fileWatch, which saves battery a lot.

  Copyright (c) 2013 Daniel Steigerwald
*/
module.exports = function(grunt) {

  var fs = require('fs');
  var path = require('path');
  var tinylr = require('tiny-lr');

  var RESTART_WATCHERS_DEBOUNCE = 10;

  var changedFilesForLiveReload = [];
  var circularsCache = Object.create(null);
  var done;
  var esteWatchTaskIsRunning = false
  var filesChangedWithinWatchTask = [];
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
    esteWatchTaskIsRunning = false;
    watchTaskStart = Date.now();

    grunt.log.ok('Waiting...');

    if (firstRun) {
      firstRun = false;
      restartWatchers();
      runLiveReloadServer();
      keepThisTaskRunForeverViaHideousHack();
    }

    var waitingFiles = grunt.util._.uniq(filesChangedWithinWatchTask);
    grunt.verbose.ok('Files changed within watch task:');
    grunt.verbose.ok(waitingFiles);
    var ignore = filesChangedWithinWatchTask.fileWhichDispatchedChanging;
    filesChangedWithinWatchTask = []
    waitingFiles.forEach(function(filepath) {
      if (filepath == ignore)
        return;
      onFileChange(filepath);
    });

  });

  grunt.registerTask('esteWatchLiveReload', function() {
    if (changedFilesForLiveReload.length) {
      changedFilesForLiveReload = grunt.util._.uniq(changedFilesForLiveReload);
      notifyLiveReloadServer(changedFilesForLiveReload);
      changedFilesForLiveReload = [];
    }
  });

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
  var restartDirsWatchersDebounced = grunt.util._.debounce(
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
    // Normalize \\ paths to / paths. Yet another Windows fix.
    filepath = filepath.replace(/\\/g, '/');
    // fs.statSync fails on deleted symlink dir with "Abort trap: 6" exception
    // https://github.com/bevry/watchr/issues/42
    // https://github.com/joyent/node/issues/4261
    var fileExists = fs.existsSync(filepath);
    if (!fileExists)
      return;
    if (fs.statSync(filepath).isDirectory()) {
      grunt.log.ok('Dir changed: ' + filepath);
      restartDirsWatchersDebounced();
      return;
    }
    onFileChange(filepath);
  };

  var onFileChange = function(filepath) {

    changedFilesForLiveReload.push(filepath);

    // postpone changes occured during tasks execution
    if (esteWatchTaskIsRunning) {
      grunt.verbose.writeln('filesChangedWithinWatchTask.push ' + filepath);
      filesChangedWithinWatchTask.push(filepath);
      return;
    }

    if (grunt.task.current.name == 'esteWatch') {
      esteWatchTaskIsRunning = true;
      filesChangedWithinWatchTask.fileWhichDispatchedChanging = filepath;
    }

    // detect user's 'unit of work' to reset circular deps detection
    var userAction = (Date.now() - watchTaskStart) > 500;
    if (userAction) {
      circularsCache = Object.create(null);
      grunt.log.ok('User action.'.yellow);
    }

    // run tasks for changed file
    grunt.log.ok('File changed: ' + filepath);
    var tasks = getFilepathTasks(filepath);
    tasks.push('esteWatchLiveReload', 'esteWatch');
    done();
    grunt.task.run(tasks);

    //   // detect circular tasks, to prevent infinite loop
    //   if (circularsCache[filepathsItem]) {
    //     grunt.log.error('Circular dependency detected: ' + filepathsItem);
    //     grunt.log.error('Check your esteWatch:options:dir configuration.');
    //     grunt.log.error('For example, if css task generate also watched css file, we are in loop.');
    //     grunt.log.error('But you probably pressed cmd-s to fastly.');
    //     return;
    //   }
    //   circularsCache[filepathsItem] = true;
  };

  var notifyLiveReloadServer = function(filepaths) {
    grunt.verbose.ok('notifyLiveReloadServer: ' + filepaths);
    filepaths = filepaths.filter(function(filepath) {
      var ext = path.extname(filepath).slice(1);
      return options.livereload.extensions.indexOf(ext) != -1;
    });
    if (!filepaths.length) {
      grunt.log.writeln('Nothing to live reload.');
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
    var tasks = config(filepath) || [];
    if (!Array.isArray(tasks))
      tasks = [tasks];
    return tasks;
  };

};
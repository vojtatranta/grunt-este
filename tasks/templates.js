/*
 * grunt-este
 * https://github.com/este/grunt-este
 * https://developers.google.com/closure/templates/docs/javascript_usage
 *
 * Copyright (c) 2013 Daniel Steigerwald
 */
module.exports = function (grunt) {

  grunt.registerMultiTask('esteTemplates', 'Google Closure Template compiler.',
    function () {

      var options = this.options({
        soyToJsJarPath: './bower_components/closure-templates/SoyToJsSrcCompiler.jar',
        outputPathFormat: '{INPUT_DIRECTORY}/{INPUT_FILE_NAME_NO_EXT}.js',
        shouldGenerateJsdoc: true,
        bidiGlobalDir: 1,
        codeStyle: 'concat',
        shouldGenerateGoogMsgDefs: true,
        shouldProvideRequireSoyNamespaces: true
      });
      var args = ['-jar', options.soyToJsJarPath];
      var filesSrc = this.filesSrc;

      // dirty hack to pass only changed file
      // TODO: wait for official solution
      var flags = Object.keys(this.flags);
      if (flags.length == 1)
        filesSrc = flags;

      delete options.soyToJsJarPath;

      for (var option in options) {
        args.push('--' + option);
        if (options[option] !== true)
          args.push(options[option]);
      }
      args.push.apply(args, filesSrc);

      var done = this.async();
      var onSpawnDone = function(error, result, code) {
        if (error) {
          var msg = extractErrorMessage(error);
          grunt.log.error(msg);
          done(false);
        }
        else {
          filesSrc.forEach(function(item) {
            grunt.log.writeln('File ' + item.cyan + ' compiled.');
          });
          done();
        }
      };

      grunt.util.spawn({
        cmd: 'java',
        args: args
      }, onSpawnDone);

    }
  );

  /**
    Remove stack trace.
    @param {Error} error
    @return {string}
  */
  var extractErrorMessage = function(error) {
    msg = error.toString();
    match = msg.match(/com.google.template.soy.base.SoySyntaxException: (.+)/);
    if (match && match[1])
      return match[1];
    return msg;
  };

};
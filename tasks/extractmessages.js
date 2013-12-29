/*
 * grunt-este
 * https://github.com/este/grunt-este
 *
 * Extract messages from source code into one or more JSON dictionaries.
 * Only new messages are added and unused messages are removed.
 *
 * Copyright (c) 2013 Daniel Steigerwald
 */
module.exports = function (grunt) {

  var path = require('path');
  var messages = require('../lib/messages');

  grunt.registerMultiTask('esteExtractMessages', 'Extract messages defined with goog.getMsg',
    function() {

      var options = this.options({
        root: [],
        messagesPath: 'messages/app',
        languages: ['cs', 'de']
      });

      var files = messages.getFiles(options.root, grunt);
      var dictionary = createDictionary(files);

      for (var i = 0; i < options.languages.length; i++) {
        var language = options.languages[i];
        saveDictionary(dictionary, language, options.messagesPath);
      }

    }
  );

  /*
   * @param {Array.<string>} files
   * @return {Array.<string>}
   */
  var createDictionary = function(files) {
    var dictionary = {};
    for (var i = 0; i < files.length; i++) {
      var file = files[i];
      var source = grunt.file.read(file);
      if (source.indexOf('goog.getMsg') == -1)
        continue;
      var tokens = messages.getTokens(source);
      for (var j = 0; j < tokens.length; j++) {
        var token = tokens[j];
        if (token.type != 'Identifier' || token.value != 'getMsg')
          continue;
        var message = messages.getMessage(tokens, j);
        if (!message)
          continue;
        var description = messages.getMessageDescription(tokens, j);
        if (!description)
          continue;
        dictionary[message] = dictionary[message] || {};
        dictionary[message][description] = 'to translate: ' + message;
      }
    }
    return dictionary;
  };

  /*
   * @param {Object} dictionary
   * @param {string} language
   * @param {string} messagesPath
   */
  var saveDictionary = function(dictionary, language, messagesPath) {
    var languagePath = path.join(messagesPath, language + '.json');
    var json = {};
    var languageFileExists = grunt.file.exists(languagePath);
    if (languageFileExists) {
      var source = grunt.file.read(languagePath);
      json = JSON.parse(source);
    }
    for (var message in dictionary) {
      var translations = dictionary[message];
      var jsonMessage = json[message] || (json[message] = {});
      for (var description in translations) {
        var translation = translations[description];
        if (jsonMessage[description])
          continue;
        jsonMessage[description] = translation;
      }
    }
    var keysToRemove = [];
    for (message in json)
      if (!dictionary[message])
        keysToRemove.push(message);
    for (var i = 0; i < keysToRemove.length; i++)
      delete json[keysToRemove[i]];
    var text = JSON.stringify(json, null, 2);
    grunt.file.write(languagePath, text);
    if (languageFileExists)
      grunt.log.writeln('File ' + languagePath.cyan + ' updated.');
    else
      grunt.log.writeln('File ' + languagePath.cyan + ' created.');
  };
};
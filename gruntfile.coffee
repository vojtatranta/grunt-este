module.exports = (grunt) ->

  grunt.initConfig
    jshint:
      options:
        evil: true
        laxcomma: true
        loopfunc: true
      all: [
        'lib/**/*.js'
        'tasks/**/*.js'
      ]
    
  grunt.loadNpmTasks 'grunt-contrib-jshint'

  grunt.registerTask 'test', 'jshint'
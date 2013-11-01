module.exports = (grunt) ->

  grunt.initConfig
    jshint:
      options:
        evil: true
        laxcomma: true
        loopfunc: true
        eqnull: true
      all: [
        'lib/**/*.js'
        'tasks/**/*.js'
      ]

    release:
      options:
        bump: true
        add: true
        commit: true
        tag: true
        push: true
        pushTags: true
        npm: true

    simplemocha:
      options:
        ui: 'tdd'
        compilers: 'coffee:coffeescript'
        # reporter: 'tap'

      all:
        src: [
          'lib/global.js'
          'lib/**/*_test.coffee'
        ]

  grunt.loadNpmTasks 'grunt-release'
  grunt.loadNpmTasks 'grunt-contrib-jshint'
  grunt.loadNpmTasks 'grunt-simple-mocha'

  grunt.registerTask 'test', ['jshint']
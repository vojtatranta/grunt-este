var fs = require('fs');

/**
 * @param {string} depsPath
 * @param {string} prefix
 * @return {Object} Example:
 *  'app.start': {
 *    src: 'client/app/js/start.js',
 *    dependencies: [
 *      'app.templates',
 *      'goog.events']
 *  }
 */
module.exports = function(depsPath, prefix) {
  var deps = {};
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
  var depsFile = fs.readFileSync(depsPath, 'utf8');
  eval(depsFile);
  return deps;
};


var path = require('path');
var esprima = require('esprima');

/*
 * @param {Array.<string>} root
 * @return {Array.<string>}
 */
exports.getFiles = function(root, grunt) {
  var patterns = [];
  for (var i = 0; i < root.length; i++)
    patterns.push(path.join(root[i], '/**/*.js'));
  return grunt.file.expand(patterns);
};

/*
 * @param {string} source
 * @return {Array.<Object>}
 */
exports.getTokens = function(source) {
  var syntax = esprima.parse(source, {
    comment: true,
    range: true,
    tokens: true
  });
  var tokens = syntax.tokens.concat(syntax.comments);
  sortTokens(tokens);
  return tokens;
};

/*
 * @param {Array.<Object>} tokens
 * @param {number} i
 * @return {string}
 */
exports.getMessage = function(tokens, i) {
  if (tokens[i + 1].type == 'Punctuator' &&
      tokens[i + 1].value == '(' &&
      tokens[i + 2].type == 'String')
        return tokens[i + 2].value.slice(1, -1);
};

/*
 * @param {Array.<Object>} tokens
 * @param {number} i
 * @return {string}
 */
exports.getMessageDescription = function(tokens, i) {
  var description, token, _ref;
  while (true) {
    token = tokens[--i];
    if (!token)
      return;
    if (!(token.type == 'Identifier' || token.type == 'Punctuator'))
      break;
  }
  if (token.type === 'Keyword' && token.value === 'var')
    token = tokens[--i];
  if (token.type !== 'Block')
    return;
  description = token.value.split('@desc')[1];
  description = description.split('@')[0];
  if (!description)
    return;
  return description.trim();
};

/*
 * @param {Array.<Object>}
 */
var sortTokens = function(tokens) {
  tokens.sort(function(a, b) {
    if (a.range[0] > b.range[0])
      return 1;
    else if (a.range[0] < b.range[0])
      return -1;
    else
      return 0;
  });
};
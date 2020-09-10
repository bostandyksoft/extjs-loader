const esprima = require('esprima');
const escodegen = require('escodegen');
const esUtils = require('esprima-ast-utils');
const crypto = require("crypto");
const fs = require('fs');
const chalk = require('chalk');

const cacheDir = './.cache';

const ExtJSEntry = require('./extjs-entry.js');

class ExtClassParser {

    static extJsRe = new RegExp('^Ext\.');
    static dotRe = new RegExp('\\.', 'g');

    constructor(options) {
        var me = this;

        try {
            fs.statSync(cacheDir);
        } catch (e) {
            fs.mkdirSync(cacheDir);
        }

        me.pathMap = options.paths || {};
        me.debug = options.debug;
        me.nameSpace = options.nameSpace;
        me.imports = options.imports;
        me.resourcePath = options.resourcePath;
    }

    sha1(content) {
        return crypto.createHash("sha1").update(content, "binary").digest("hex");
    }

    /**
     * Resolve the given className as a path using the options->paths mapping defined in the config
     *
     * @param className
     * @returns {*}
     */
    resolveClassFile(className) {
        let pathMap = this.pathMap;
        let fileToLoad = className;

        var keys = Object.keys(pathMap).sort((a, b) => b.length - a.length);
        for (let i = 0, len = keys.length; i < len; i++) {
            let prefix = keys[i];
            let re = new RegExp('^' + prefix.replace(ExtClassParser.dotRe, '\\.') + '\\.');
            if (className.match(re)) {
                if (pathMap[prefix] !== false) {
                    if (typeof pathMap[prefix].query === 'function') {
                        let classes = pathMap[prefix].query(className);
                        if (classes instanceof Array) {
                            return classes.map((className) => {
                                return className.src
                            });
                        } else {
                            try {
                                return [classes.src, ...classes.overrides];
                            } catch (e) {
                                console.log(prefix, className);
                            }
                        }
                    } else {
                        return [prefix.replace(prefix, pathMap[prefix]) + className.replace(prefix, '').replace(/\./g, '/') + '.js'];
                    }
                }
                return [];
            }
        }
        if (className.match(ExtClassParser.extJsRe) && !pathMap['Ext']) {
            return [];
        }
        throw new Error('Unable to resolve ' + className);
    }

    requireString(_path) {
        let importStr = escodegen.generate({
            type: 'Literal',
            value: _path
        });
        if (this.imports) {
            return `import ${importStr};\r\n`
        } else {
            return `require(${importStr});\r\n`;
        }
    }

    parse(content) {
        var me = this;

        const contentDigest = me.sha1(content);
        const cacheFile = cacheDir + '/' + contentDigest;
        let tree;

        if (fs.existsSync(cacheFile)) {
            tree = JSON.parse(fs.readFileSync(cacheFile, {encoding: 'utf-8'}));
        } else {
            tree = esprima.parse(content, {
                range: true
            });
            fs.writeFileSync(cacheFile, JSON.stringify(tree));
        }

        const entries = ExtJSEntry.Entries;

        var sync = {};
        var async = [];
        var cuts = [];

        esUtils.parentize(tree);
        esUtils.traverse(tree, function (node) {
            entries.forEach((entry) => {
                var root = entry.test(node);
                if (root) {
                    var action = entry.process(node, root);
                    if (action) {
                        if (action.requires) {
                            if (action.async) {
                                async = async.concat(action.requires);
                            } else {
                                var weight = action.weight || 0;
                                sync[weight] = (sync[weight] || []).concat(action.requires);
                            }
                        }
                        if (action.remove) {
                            cuts.push({
                                start: node.range[0],
                                end: node.range[1]
                            });
                        }
                    }
                }
            });
        });

        var start = tree.range[0];

        cuts.sort((a, b) => b.end - a.end).forEach((cut) => {
            content = content.slice(0, cut.start) + content.slice(cut.end).replace(/^\s*,/im, '');
        });

        Object.keys(sync).sort((a, b) => a - b).forEach((weight) => {
            let classes = [...new Set(sync[weight])];
            classes.forEach((clazz) => {
                me.resolveClassFile(clazz).forEach((_path) => {
                    if (_path) {
                        var require = me.requireString(_path);
                        content = [content.slice(0, start), require, content.slice(start)].join('');
                        start += require.length;
                    }
                });
            });
        });

        async = [...new Set(async)];
        let setTimeout = [];
        async.forEach((clazz) => {
            me.resolveClassFile(clazz).forEach((_path) => {
                if (_path) {
                    setTimeout = [...setTimeout, me.requireString(_path)];
                }
            });
        });
        if (setTimeout.length) {
            const fullList = setTimeout.join('');
            content = [content.slice(0, start), `setTimeout(function() {\n ${fullList} });\n`, content.slice(start)].join('');
        }

        return content
    }
}

module.exports = {
    ExtClassParser,
    ExtJSEntry
};
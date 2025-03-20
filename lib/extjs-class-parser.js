const esprima = require('esprima-next');
const escodegen = require('escodegen');
const esUtils = require('esprima-ast-utils');
const crypto = require("crypto");
const fs = require('fs');
const chalk = require('chalk');

const cacheDir = './.cache';

const ExtJSEntry = require('./entry/ExtJsEntry');

const baseEntries = [
    require('./entry/application'),
    require('./entry/autoCreateViewport'),
    require('./entry/controllers'),
    require('./entry/create'),
    require('./entry/define'),
    require('./entry/mixins'),
    require('./entry/model'),
    require('./entry/override_extend'),
    require('./entry/require'),
    require('./entry/requires'),
    require('./entry/stores'),
    require('./entry/uses'),
];

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
        me.debug = options.deb
        me.imports = options.imports || false;
        me.extentions = options.extentions || ['js'];
        me.sourceType = options.sourceType || 'module';
        me.encoding = options.encoding || 'utf-8';
        me.entries = options.entries || baseEntries;
    }

    sha1(content) {
        return crypto.createHash("sha1").update(content, "binary").digest("hex");
    }

    /**
     * Resolving the given className as a path using the options->paths mapping defined in the config
     *
     * @param className
     * @returns {*}
     */
    resolveClassFile(className) {
        const me = this;
        let pathMap = me.pathMap;
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
                        let filePrefix = prefix.replace(prefix, pathMap[prefix]) + className.replace(prefix, '').replace(/\./g, '/');

                        let extentions = me.extentions.map((ext) => `.${ext}`);

                        for (let i = 0, len = extentions.length; i < len; i++) {
                            let ext = extentions[i];
                            let file = filePrefix + ext;
                            if (me.debug) {
                                console.log('Checking file ' + file);
                            }
                            if (fs.existsSync(file)) {
                                if (me.debug) {
                                    console.log('Found');
                                }
                                return [file];
                            }
                            if (me.debug) {
                                console.log('Not found');
                            }
                        }

                        throw new Error('Unable to find file ' + filePrefix + ' with some extentions of ' + me.extentions.join(','));
                    }
                }
                return [];
            }
        }
        if (className.match(ExtClassParser.extJsRe) && !pathMap['Ext']) {
            return [];
        }
        throw new Error('Unable to resolve ' + className + '. Check option "path" to matching this namespase');
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

        let exists = false;
        try {
            if (fs.accessSync(cacheFile)) {
                exists = true;
            }
        }catch (ignore) {
            exists = false;
        }

        if (exists) {
            tree = JSON.parse(fs.readFileSync(cacheFile, {encoding: me.encoding}));
        } else {
            tree = esprima.parse(content, {
                sourceType: me.sourceType,
                range: true
            });
            fs.writeFileSync(cacheFile, JSON.stringify(tree));
        }

        const entries = me.entries;

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
                            let remove = action.remove;
                            if (remove === true) {
                                remove = 0;
                            }
                            let currentNode = node;
                            for(var i= 0;i<remove;i++) {
                                currentNode = node.$parent;
                            }
                            cuts.push({
                                start: currentNode.range[0],
                                end: currentNode.range[1]
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

        if (!me.imports) {
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
        }
        return content
    }
}

module.exports = {
    ExtClassParser,
    ExtJSEntry
};

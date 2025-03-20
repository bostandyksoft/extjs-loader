const ExtJSEntry = require('./ExtJsEntry');

module.exports = new ExtJSEntry(
    [{
        type: 'Call',
        argumentIndex: 0,
        callee: {
            object: 'Ext',
            method: 'require'
        }
    }],
    null,
    function (node) {
        let requires;
        if (node.type === 'Literal') {
            requires =[node.value]
        } else if (node.value.type === 'ArrayExpression') {
            requires = node.value.elements.map((element) => element.value);
        }
        return {
            remove: 1,
            requires: requires
        }
    }
);

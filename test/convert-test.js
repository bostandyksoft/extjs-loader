const chai = require('chai');
chai.use(require('chai-string'));
const sinon = require("sinon").createSandbox();
const assert = chai.assert;
const expect = chai.expect;
const fs = require('fs');
const path = require('path');
const Promise = require('bluebird');

const {ExtClassParser} = require('../lib/extjs-class-parser.js');

describe('ExtClassParser convert result', function () {

    beforeEach(() => {
        sinon.stub(fs, 'existsSync').returns(true);
    });

    afterEach(() => {
        sinon.restore();
    });

    const test = function (caseName, imports, done) {
        const source = fs.readFileSync(path.resolve('test/case', caseName + '.js'), {encoding: 'utf-8'});
        const expected = fs.readFileSync(path.resolve('test/case', caseName + '.exp' + (imports ? '.imports.js' : '.js')), {encoding: 'utf-8'});

        try {
            const parseResult = new ExtClassParser({
                debug: true,
                imports: imports,
                paths: {
                    Test: './test/extjs',
                    Test2: './test/source'
                }
            }).parse(source);

            expect(expected).to.equalIgnoreSpaces(parseResult);

            done();
        } catch (e) {
            console.error(e);
            throw e;
        }
    }

    const cases = {
        'Simple': 'simple',
        'Requires': 'requires',
        'Simple Require': 'ext_require',
        'Single Requires': 'single_requires',
        'Requires app': 'requires.app',
        'Uses': 'uses',
        'Namespace bug is fixed': 'namespace',
        'Using override property in config': 'property_override',
        'Ext create': 'ext_create',
        'Stores': 'stores',
        'Controllers': 'controllers',
        'Model': 'model',
        'AutoCreateViewport': 'autoCreateViewport',
        'AutoCreateViewport True': 'autoCreateViewport_true',
        'Mixins Array': 'mixins_array',
        'Mixins Object': 'mixins_object',
        'Extend': 'extend',
        'Module Import': 'module',
        'Module Requires': 'js_require'
    }

    const makeTest = function (key, importflag) {
        return function (done) {
            test(cases[key], importflag, done);
        }
    }

    for (var key in cases) {
        if (cases.hasOwnProperty(key)) {
            it(key, makeTest(key, false));
            it(key + ' / Imports', makeTest(key, true));
        }
    }

});

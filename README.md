# Ext.js Loader for Webpack

Based on https://www.npmjs.com/package/extjs-loader

## Install
```bash
npm install --save-dev extjs-class-loader
```
## Usage

The `extjs-class-loader` interprets:
 
 * `Ext.define` properties `requires`, `uses`, `mixins` configs like `requires`.
 * `Ext.application` property `controllers`
 * `Ext.define` of controller property `stores`

Use the loader either via your webpack config, CLI or inline.

### Via webpack config (recommended)

**webpack.config.js**
```js
module.exports = {
  module: {
    rules: [
      {
        test: /\.js/,
        use: [
            {
                loader: 'extjs-class-loader',
                options : {
                    debug: true,
                    paths: {
                        'Deft': false,
                        'Ext.ux': 'utils/ux',
                        'Ext': false,
                        'Override': path.resolve('app/overrides'),
                        'MyApp': path.resolve('app/src')
                    },
                    imports: false,
                    extentions : ['js', 'ts']
                }
            } ]
      }
    ]
  }
}
```

## Options

|Name|Default value|Description|
|:--:|:-----:|:----------|
|**`debug`**|`false`|Print status messages for debugging purpose|
|**`paths`** |`{}`| Define your loader config here. I.e. define how the namespaces in your app should be resolved. If `false` value is used then the given namespace is ignored. It is useful when you include that namespace on other way. E.g. if you include Ext-debug-all.js in your HTML then you do not want to include individual components.|
|**`extentions`** | `['js']` | Array of Defines extentions of included files. Loader will check, that file is exists before include |
|**`imports`**| `false`| Use import statement instead of require
|**`sourceType`**| `module`| Type of source for parsing by <a href="https://esprima.org">esprima</a>. 
|**`encoding`**| `utf-8`| Encoding of source codes

<h2 align="center">Maintainers</h2>

<table>
  <tbody>
    <tr>
      <td align="center">
        <img width="150" height="150"
        src="https://avatars1.githubusercontent.com/u/1021537?v=3&s=460">
        <br/>
        <a href="https://github.com/zmagyar">Zoltan Magyar</a>
      </td>
      <td align="center">
        <img width="150" height="150"
        src="https://avatars1.githubusercontent.com/u/11589541?v=3&s=460">
        <br/>
        <a href="https://github.com/steveetm">Steveetm</a>
      </td>
    </tr>
  <tbody>
</table>

## History

### v0.0.1
Initial release to process project files

### v0.0.2
Support for [extjs-parser](https://www.npmjs.com/package/extjs-parser) to allow processing of Ext.js sdk dependencies

### v1.0.0
Removed support of extjs-parser. Full refactoring of loader.
 
### v1.0.1
Added tests for various situations

### v1.0.19
Added ability to parse files with different sourceType of esprima
Added ability to use imports instead of require
Added ability to set array of supported files extentions
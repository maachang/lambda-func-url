////////////////////////////////////////////////
// 定数定義.
////////////////////////////////////////////////
(function(_g) {
'use strict';

// package.json.
const pkg = require("./package.json");

// 名前
exports.NAME = pkg.name;

// バージョン.
exports.VERSION = pkg.version;

// 説明.
exports.DESCRIPTION = pkg.description;

// バインドポート番号.
exports.BIND_PORT = 3456;

})(global);
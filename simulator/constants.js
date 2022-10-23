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

// [http]バインドポート番号.
exports.BIND_PORT = 3456;

// [環境変数]Env定義Confファイル名.
// 拡張子を除いて設定.
exports.ENV_TO_CONF_ENV_NAME = "LFU_ENV_CONF";

// [環境変数]暗号キー条件のKey条件.
exports.ENV_CIPHER_KEY = "LFU_CIPHOER_KEY";

// [環境変数]暗号キー条件のPass条件.
exports.ENV_CIPHER_PASS = "LFU_CIPHOER_PASS";

// [環境変数]loggerディレクトリ.
exports.ENV_LOGGER_DIR = "LFU_LOGGER_DIR";

// [環境変数]logger名.
exports.ENV_LOGGER_NAME = "LFU_LOGGER_NAME";

})(global);
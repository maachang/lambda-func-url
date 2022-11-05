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

// HTTPサーバ名.
exports.SERVER_NAME = "" + exports.NAME +
    "(" + exports.VERSION + ")";

// [http]バインドポート番号.
exports.BIND_PORT = 3456;

// デフォルトのconfenvファイル名(拡張子なし).
exports.DEF_CONF_ENV_NAME = "./lfu";

// LFU環境(Lambda環境のローカル)パス.
//   LFUSetup.jsが存在するパス名を設定する必要があります.
exports.ENV_LFU_PATH = "LFU_PATH";

// [環境変数]偽S3のローカルパス.
exports.ENV_FAKE_S3_PATH = "LFU_FAKE_S3_PATH";

// [環境変数]偽gitのローカルパス.
exports.ENV_FAKE_GITHUB_PATH = "LFU_FAKE_GITHUB_PATH";

// [環境変数]Env定義Confファイル名.
// 拡張子を除いて設定.
exports.ENV_TO_CONF_ENV_NAME = "LFU_ENV_CONF";

// [環境変数]httpCrosアクセス許可.
// "true" で許可.
exports.ENV_HTTP_CROS_MODE = "LFU_HTTP_CROS_MODE";

// [環境変数]lfuコンフィグを暗号・復号するキー条件のKey条件.
exports.ENV_CIPHER_KEY = "LFU_CIPHOER_KEY";

// [環境変数]lfuコンフィグを暗号・復号するキー条件のPass条件.
exports.ENV_CIPHER_PASS = "LFU_CIPHOER_PASS";

// [環境変数]loggerディレクトリ.
exports.ENV_LOGGER_DIR = "LFU_LOGGER_DIR";

// [環境変数]loggerファイルヘッダ名.
exports.ENV_LOGGER_NAME = "LFU_LOGGER_NAME";

// [環境変数]loggerファイル出力レベル.
exports.ENV_LOGGER_LEVEL = "LFU_LOGGER_LEVEL";

// logTimes名.
exports.LOG_TIMES = "lfu-simurator";

})(global);
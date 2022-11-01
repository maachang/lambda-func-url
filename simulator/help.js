////////////////////////////////////////////////
// lfusimヘルプ表示.
////////////////////////////////////////////////
(function(_g) {
'use strict';

// 定数定義.
const constants = require("./constants.js");

// 出力処理.
const p = function() {
    console.log.apply(null, arguments);
}

// バージョン出力.
exports.version = function() {
    p(constants.VERSION);
}

// ヘルプ出力.
exports.print = function() {
    p("Usage: %s [OPTION]...", constants.NAME);
    p("Simulate LUF. It also performs processing to assist with simulation.");
    p("");
    p("By specifying [OPTION] below, it is possible to change the conversion conditions.");
    p(" 1.Run the LFU simulator.");
    p("   -p --port Set the port number to bind.");
    p("   -w --worker Set the number of workers. If not set, the number of CPUs will be set.")
    p(" 2.Execution provision for encrypting/decrypting config definitions.");
    p("   2-1.Creating access keys and access passes.");
    p("     --keygen Required if you want to run this action.");
    p("     -k --key {key} Set the Key name for creating an access key.");
    p("     -p --path {path} Set the Pass name for creating an access key.");
    p("   2-2.Encryption of config files.");
    p("     --encode Required for encryption.");
    p("     -f --file {fileName} Set the file name without extension to be encrypted.");
    p("     -k --key {key} Set your access key.")
    p("                    If not set, the environment variable `LFUS_CIPHOER_KEY` will be used.");
    p("     -p --path {path} Set an access pass.");
    p("                      If not set, the environment variable `LFUS_CIPHOER_PATH` will be used.");
    p("   2-3.Decryption of encrypted config files.");
    p("     --decode Required for decryption.");
    p("     -f --file {fileName} Set the file name without extension to decrypt.");
    p("     -k --key {key} Set your access key.")
    p("                    If not set, the environment variable `LFUS_CIPHOER_KEY` will be used.");
    p("     -p --path {path} Set an access pass.");
    p("                      If not set, the environment variable `LFUS_CIPHOER_PATH` will be used.");
}

})(global);
#!/usr/bin/env node

/*!
 * lfu-simulator(Lambda function URLs Simulator).
 * Copyright(c) 2022 maachang.
 * MIT Licensed
 */

(function(_g) {
'use strict';

// プログラム(node)引数.
const args = require("./modules/args.js");

// バージョン表示.
if(args.isValue("-v", "--version")) {
    require("./help.js").version();
    return;
// ヘルプ表示.
} else if(args.isValue("-h", "--help")) {
    require("./help.js").print();
    return;
// アクセスキーを生成.
} else if(args.isValue("--keygen")) {
    const ret = require("./confenv.js").getKeyCode(
        args.get("-k", "--key"),
        args.get("-p", "--pass")
    );
    console.log("access key : %s", ret.key);
    console.log("access path: %s", ret.pass);
    return;
// confEnvファイルの暗号化.
} else if(args.isValue("--encode")) {
    const ret = require("./confenv.js").encodeCipherConfEnv(
        args.get("-f", "--file"),
        args.get("-k", "--key"),
        args.get("-p", "--pass")
    );
    console.log("success.");
    console.log("src : %s", ret.src);
    console.log("dest: %s", ret.dest);
    return;
// confEnvファイルの復号化.
} else if(args.isValue("--decode")) {
    const ret = require("./confenv.js").decodeCipherConfEnv(
        args.get("-f", "--file"),
        args.get("-k", "--key"),
        args.get("-p", "--pass")
    );
    console.log("success.");
    console.log("src : %s", ret.src);
    console.log("dest: %s", ret.dest);
    return;
}

// クラスタ.
const cluster = require('cluster');

// confEnvをロード.
const loadConfEnv = function() {
    // confEnv条件を取得.
    const confEnv = require("./confenv.js");
    if(typeof(confEnv.getEnvToConfEnvName()) == "string") {
        confEnv.loadConfEnv();
    }
}

// [環境変数]loggerディレクトリ.
const ENV_LOGGER_DIR = "LFU_LOGGER_DIR";
// [環境変数]logger名.
const ENV_LOGGER_NAME = "LFU_LOGGER_NAME";

// logger設定をロード.
const loadLogger = function() {
    // ログ初期化.
    const logger = require("./modules/logger.js");
    logger.setting({
        dir: process.env[ENV_LOGGER_DIR],
        file: process.env[ENV_LOGGER_NAME]
    });
}

// クラスター起動.
const startupCluster = function() {
    // confEnvをロード.
    loadConfEnv();

    // ログ初期化.
    loadLogger();

    // ワーカー数を取得.
    let workerLen = args.get("-w", "--worker")|0;
    if(workerLen == 0) {
        // ワーカー数が設定されていない場合
        // cpu数をワーカー数とする.
        workerLen = require('os').cpus().length;
    }

    // ワーカー起動.
    for (let i = 0; i < workerLen; ++i) {
        cluster.fork();
    }

    // プロセスが落ちた時の処理.
    const _exitNodeJs = function() {
        console.log("## exit lfu-simurator");
        process.exit();
    };

    // node処理終了.
    process.on('exit', function() {
        console.log("exit");
    });

    // 割り込み系と、killコマンド終了.
    process.on('SIGINT', _exitNodeJs);
    process.on('SIGBREAK', _exitNodeJs);
    process.on('SIGTERM', _exitNodeJs);

    // クラスタプロセスが落ちた場合、再起動.
    cluster.on('exit', function () {
        console.debug("## cluster exit to reStart.");
        // 再起動.
        cluster.fork();
    });
}

// ワーカー起動.
// workerNo ワーカーNoが設定されます.
const startWorker = function(workerNo) {
    // confEnvをロード.
    loadConfEnv();

    // ログ初期化.
    loadLogger();

    // バインドポート番号を取得.
    let bindPort = args.get("-p", "--port")|0;
    if(bindPort <= 0) {
        // デフォルトのバインドポートをセット.
        bindPort = require("./constants.js").BIND_PORT;
    }

    // プロセス例外ハンドラ.
    process.on('uncaughtException', function(e) {
        console.trace("error uncaughtException", e);
    });

    // promise例外ハンドラ.
    process.on('unhandledRejection', function(rejection) {
        console.trace("error unhandledRejection", rejection);
    });

    // fakereqreg.jsを呼び出す.
    // 偽s3requireを定義.
    // 偽grequireを定義.
    require("./fakereqreg.js");

    // lfuweb.jsを呼び出す.
    require("./lfuweb.js").startup(bindPort);
}

// ワーカーカウンター.
let workerCounter = 0;

// クラスタ起動.
if (cluster.isMaster) {
    startupCluster();

// ワーカー起動.
} else {
    // ワーカー起動.
    startWorker(workerCounter ++);
}

})(global);
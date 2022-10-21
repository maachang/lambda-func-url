#!/usr/bin/env node

/*!
 * lfu-simulator(Lambda function URLs Simulator).
 * Copyright(c) 2022 maachang.
 * MIT Licensed
 */

(function(_g) {
'use strict';

// クラスタ.
const cluster = require('cluster');

// [環境変数]: ログ出力ディレクトリ名.
const ENV_LOG_DIR = "LFU_LOG_DIR";

// [環境変数]: ログファイル名.
const ENV_LOG_NAME = "LFU_LOG_NAME";

// ログ初期処理.
const initLogger = function() {
    // 環境変数から条件を取得.
    const dir = process.env[ENV_LOG_DIR];
    const name = process.env[ENV_LOG_NAME];
    // loggerのモジュール呼び出し.
    const logger = require("./modules/logger.js");
    // logger設定.
    logger.setting(dir, name);
}

// クラスター起動.
const startupCluster = function() {
    // ログ初期化.
    initLogger();

    // cpu数を取得.
    const cpuLen = require('os').cpus().length;

    // マスター起動.
    for (let i = 0; i < cpuLen; ++i) {
        // CPU毎にクラスター起動.
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
const startWorker = function(no) {
    // ログ初期化.
    initLogger();
    
    // プロセス例外ハンドラ.
    process.on('uncaughtException', function(e) {
        console.trace("error uncaughtException", e);
    });

    // promise例外ハンドラ.
    process.on('unhandledRejection', function(rejection) {
        console.trace("error unhandledRejection", rejection);
    });



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
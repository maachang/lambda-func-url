// LFUをminify化して、zip変換.
//
// - linux上での実行を想定.
// - uglify-js(npm)を利用.
//   > npm -g install uglify-js
//     でインストール.
// - zipコマンドを利用.
//   > sudo apt install zip
//     でインストール.
//
(function() {
'use strict';

//
// このコマンドはそのうち `lfuSim` に統合する.
//

// コマンド実行.
const { execSync } = require("child_process");

// fs.
const fs = require("fs");

// LFUソースファイルリスト.
const LFU_SRC_LIST = ".lfuSrcList.JSON";

// minify用ディレクトリ.
const MINIFY_DIR = ".minSrc";

// 起動パラメータで設定されたパスを取得.
// 戻り値: パスが返却されます.
const getPath = function() {
    // 対象パスを取得.
    let path = process.argv[2];
    // パスが設定されていません.
    if(path == undefined) {
        throw new Error("Target path is not set.");
    }

    // 0x0d, 0x0d が終端に設定されている場合.
    // ※どうやらLinux上でcrlf改行のbashファイルから呼び出した場合
    //   プロセスパラメータ(process.argv)の最後0x0d, 0x0dが入る
    //   みたい.
    let bpath = Buffer.from(path);
    if(bpath.length >= 2 &&
        bpath[bpath.length -1] == 0x0d && bpath[bpath.length - 2] == 0x0d) {
        path = path.substring(0, path.length - 2);
    }
    bpath = null;

    // パスが設定されていません.
    if(path == undefined) {
        throw new Error("Target path is not set.");

    // LFUソースリストが指定パスに存在しない場合.
    } else if(!fs.existsSync(path + "/" + LFU_SRC_LIST)) {
        throw new Error("The file '" + LFU_SRC_LIST +
            "' does not exist in the target path '" +
            path + "'.");
    }
    
    // パスの最後のスラッシュを削除.
    if(path.endsWith("/")) {
        path = path.substring(0, path.length - 1);
    }
    return path;
}

// ディレクトリ作成.
// path 対象の基本パスを設定します.
// src 対象のディレクトリやファイルを設定します.
const mkdir = function(path, src) {
    const p = src.lastIndexOf("/");
    if(p == -1) {
        return false;
    }
    const dir = src.substring(0, p);
    try {
        fs.mkdirSync(path + "/" + dir);
        return true;
    } catch(e) {
        return false;
    };    
}

// .lfuSrcList.JSONファイルを取得.
// path 対象の基本パスを設定します.
// 戻り値 JSONの内容が返却されます.
const loadLfuSrcListJsonFile = function(path) {
    // 指定ファイルが存在しない場合.
    if(!fs.existsSync(path + "/" + LFU_SRC_LIST)) {
        throw new Error("The specified file "
            + path + "/" + LFU_SRC_LIST + " does not exist.");
    }
    // ファイル情報を取得.
    let srcList = fs.readFileSync(
        path + "/" + LFU_SRC_LIST).toString();
    // リスト一覧.
    return JSON.parse(srcList); 
}

// コマンドでjsのminify実行.
// path 対象の基本パスを設定します.
// jsName ディレクトリ名＋jsファイル名を設定します.
// moveDir 移動先のディレクトリ名(path + "/" + moveDir)
//         の条件を設定します.
const cmdMimify = function(path, jsName, moveDir) {
    // minifyする.
    // > uglifyjs <input js file> --compress drop_console=true
    //   --mangle -o <js.min file>
    mkdir(path, moveDir + "/" + jsName);
    execSync("uglifyjs " + path + "/" + jsName +
        " --compress drop_console=true --mangle -o " +
        path + "/" + moveDir + "/" + jsName);

}

// .lfuSrcList.JSONのjsファイルをミニファイする.
// path 対象の基本パスを設定します.
// srcList loadLfuSrcListJsonFile で取得した内容を設定します.
const executeMinify = function(path, srcList) {
    // 初期ディレクトリを作成.
    mkdir(path, MINIFY_DIR);

    // [base]minify.
    const baseList = srcList.base;
    let len = baseList.length;
    for(let i = 0; i < len; i ++) {
        // 指定ファイルが存在しない場合.
        if(!fs.existsSync(path + "/" + baseList[i])) {
            throw new Error("The specified file "
                + path + "/" + baseList[i] + " does not exist.");
        }
        // minify化.
        cmdMimify(path, baseList[i], MINIFY_DIR);
        console.log("> [base]" + baseList[i]);
    }

    console.log();

    // [costom]minify.
    let count = 0;
    const costomList = srcList.custom;
    len = costomList.length;
    for(let i = 0; i < len; i ++) {
        // 指定ファイルが存在しない場合.
        if(!fs.existsSync(path + "/" + costomList[i])) {
            // 存在しない場合は処理しない.
            continue;
        }
        // minify化.
        cmdMimify(path, costomList[i], MINIFY_DIR);
        console.log("> [costom]" + costomList[i]);
        count ++;
    }

    // costom条件が１件でも処理された場合.
    if(count > 0) {
        console.log();
    }


    // minifyした内容をzip化する.
    // > cd ../.minSrc/src; zip archive -r ./
    console.log("> zip");
    execSync("cd " + path + "/" + MINIFY_DIR + "/src" + "; zip archive -r ./");
    console.log();

    // zip化したものを移動.
    console.log("> lfu.zip");
    execSync("mv " + path + "/" + MINIFY_DIR + "/src/archive.zip " + path + "/lfu.zip");
    console.log();
}

// 実行処理.
const path = getPath();
const srcList = loadLfuSrcListJsonFile(path);
executeMinify(path, srcList);

})();

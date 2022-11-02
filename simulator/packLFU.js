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

// コマンド実行.
const { execSync } = require("child_process");

// fs.
const fs = require("fs");

// LFUソースファイルリスト.
const LFU_SRC_LIST = ".lfuSrcList.JSON";

// minify用ディレクトリ.
const MINIFY_DIR = ".minSrc";

// 対象パスを取得.
let path = process.argv[2];

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
    console.error("[ERROR] Target path is not set.");
    process.exit(1);

// LFUソースリストが指定パスに存在しない場合.
} else if(!fs.existsSync(path + "/" + LFU_SRC_LIST)) {
    console.error("[ERROR] The file '" + LFU_SRC_LIST +
        "' does not exist in the target path '" +
        path + "'.")
    process.exit(1);
}

// パスの最後のスラッシュを削除.
if(path.endsWith("/")) {
    path = path.substring(0, path.length - 1);
}

// ファイル情報を取得.
let srcList = fs.readFileSync(
    path + "/" + LFU_SRC_LIST).toString();

// リスト一覧.
srcList = JSON.parse(srcList); 

try {
    fs.mkdirSync(path + "/" + MINIFY_DIR + "/");
} catch(e) {};  

// minify先のディレクトリ作成.
const mkdir = function(path, src) {
    const p = src.lastIndexOf("/");
    if(p == -1) {
        return;
    }
    const dir = src.substring(0, p);
    try {
        fs.mkdirSync(path + "/" + MINIFY_DIR + "/" + dir);
    } catch(e) {};    
}

// minifyする.
// > uglifyjs <input js file> --compress drop_console=true --mangle -o <js.min file>
const len = srcList.length;
for(let i = 0; i < len; i ++) {
    // 指定ファイルが存在しない場合.
    if(!fs.existsSync(path + "/" + srcList[i])) {
        console.error("[ERROR] The specified file "
            + path + "/" + srcList[i] + " does not exist.");
        process.exit(1);
    }
    mkdir(path, srcList[i]);
    execSync("uglifyjs " + path + "/" + srcList[i] +
        " --compress drop_console=true --mangle -o " +
        path + "/" + MINIFY_DIR + "/" + srcList[i]);
    console.log("> " + srcList[i]);
}
console.log();

// minifyした内容をzip化する.
// > cd ../.minSrc/src; zip archive -r ./
console.log("> zip");
execSync("cd " + path + "/" + MINIFY_DIR + "/src" + "; zip archive -r ./");
console.log();

// zip化したものを移動.
console.log("> lfu.zip");
execSync("mv " + path + "/" + MINIFY_DIR + "/src/archive.zip " + path + "/lfu.zip");
console.log();

// 正常終了.
process.exit(0);

})();

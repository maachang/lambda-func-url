// LFUをminify化して、zip変換.
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
const path = process.argv[2];

// パスが設定されていません.
if(path == undefined) {
    console.error("[ERROR] Target path is not set.");
    process.exit(1);

// LFUソースリストが指定パスに存在しない場合.
} else if(!fs.existsSync(path + "/" + LFU_SRC_LIST)) {
    console.error("[ERROR] The file " + LFU_SRC_LIST +
        " does not exist in the target path " +
        path + ".")
    process.exit(1);
}

// ファイル情報を取得.
let srcList = fs.readFileSync(
    path + "/" + LFU_SRC_LIST).toString();

// リスト一覧.
srcList = JSON.parse(srcList); 

// minify先のディレクトリ作成.
fs.mkdirSync(path + "/" + MINIFY_DIR);

// uglifyjs <input js file> --compress drop_console=true --mangle -o <js.min file>

const len = srcList.length;
for(let i = 0; i < len; i ++) {
    execSync("uglifyjs " + path + "/" + srcList[i])
}

//const res = execSync("pwd");
//console.log(res.toString());


})();

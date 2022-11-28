////////////////////////////////////////////////
// simurator向けの偽regreg.
// - s3require関連のローカル実装.
// - grequire関連のローカル実装.
//
// ※ この実装によって、LFUSetup.jsでのs3requireや
// grequireの処理を呼び出さないようにする.
//
// またこのrequireでは、キャッシュしない.
// 理由はシミュレーター環境のため.
////////////////////////////////////////////////
(function(_g) {
'use strict';

// nodejs library.
const vm = require('vm');
const fs = require('fs');

// lfusim library.
const util = require("./modules/util/util.js");
const cons = require("./constants.js");

// 偽S3のメインパス.
let fakeS3Path = null;

// 偽gitのメインパス.
let fakeGitPath = null;

// 指定パス名を整形.
// jsFlag true の場合jsファイルを対象とします.
// mainPath 対象のメインパスを設定します.
// currentPath カレントパスを設定します.
// name パス名を設定.
// 戻り値: 整形されたパス名が返却されます.
const trimPath = function(
    jsFlag, mainPath, currentPath, name) {
    if(typeof(currentPath) != "string") {
        currentPath = "";
    } else if((currentPath = currentPath.trim()).endsWith("/")) {
        currentPath = currentPath.substring(
            0, currentPath.length - 1),trim();
    }
    if(name.startsWith("/")) {
        name = name.substring(1).trim();
    }
    const checkName = name.toLowerCase(); 
    // jsファイルを対象読み込みで、拡張子がjsでない場合.
    if(jsFlag == true &&
        !checkName.endsWith(".js")) {
        // ただし、json拡張子を除く.
        if(!checkName.endsWith(".json")) {
            name += ".js";
        }
    }
    return mainPath + "/" + currentPath + "/" + name;
}

// ファイル存在確認.
// name 対象のファイル名を設定します.
// 戻り値: ファイル名が存在する場合 true.
const isFile = function(name) {
    return fs.existsSync(name);
}

// ファイルを詠み込む.
// name 対象のファイル名を設定します.
// 戻り値: ファイル内容がBufferで返却されます.
//        存在しない場合は null が返却されます.
const readFile = function(name) {
    if(isFile(name)) {
        return fs.readFileSync(name);
    }
    return null;
}

// stat情報を読み込む.
// name 対象のファイル名を設定します.
// 戻り値: stat情報が返却されます.
//        存在しない場合は null が返却されます.
const readStat = function(name) {
    if(isFile(name)) {
        return fs.statSync(name);
    }
    return null;
}

// 後ろの`=`が続く限り削除.
// value 対象の文字列を設定します.
// 戻り値 後ろの`=`を削除します.
const cutBeforeEq = function(value) {
    const len = value.length;
    for(let i = len - 1; i >= 0; i --) {
        if(value.charAt(i) != "=") {
            return value.substring(0, i + 1);
        }
    }
    return "";
}

// sha256変換.
// key 対象のキー.
// returnMode digestにわたす引数(string).
// 戻り値 変換結果(returnModeに依存)
const sha256 = function(key, returnMode) {
    const crypto = require('crypto');
    return crypto.createHash('sha256')
        .update(key).digest(returnMode);
}

// 対象条件からetagを作成.
// name ファイル名を設定します.
// fileLen ファイル長を設定します.
// fileTime 最終更新時間を設定します.
// 戻り値: sha256(base64)で返却します.
const getEtag = function(
    name, fileLen, fileTime) {
    return cutBeforeEq(sha256(
        name + "\n" +
        fileLen + "\n" +
        fileTime,
        "base64"
    ));
}


// HTTPエラー.
// status 対象のステータスを設定します.
// message 対象のメッセージを設定します.
const httpError = function(status, message) {
    // メッセージが設定されていない場合.
    if(message == undefined || message == null) {
        message = "";
    } else {
        message = "" + message;
    }
    const err = new Error(message);
    err.status = status;
    err.message = message;
    return err;
}

// originRequire読み込みスクリプトheader.
const ORIGIN_REQUIRE_SCRIPT_HEADER =
    "(function() {\n" +
    "'use strict';\n" +
    "return async function(args){\n" +
    "const exports = args;\n";
    "const module = {exports: args};\n";

// originRequire読み込みスクリプトfooder.
const ORIGIN_REQUIRE_SCRIPT_FOODER =
    "\n};\n})();";

// originRequireを実施.
// name load対象のNameを設定します.
// js load対象のjsソース・ファイルを設定します.
// 戻り値: exportsに設定された内容が返却されます.
const originRequire = function(name, js) {
    // origin的なrequireスクリプトを生成.
    let srcScript = ORIGIN_REQUIRE_SCRIPT_HEADER
        + js
        + ORIGIN_REQUIRE_SCRIPT_FOODER;
    try {
        // Contextを生成.
        // runInContextはsandboxなので、現在のglobalメモリを設定する.
        let memory = _g;
        let context = vm.createContext(memory);
    
        // スクリプト実行環境を生成.
        let script = new vm.Script(srcScript, {filename: name});
        srcScript = null;
        const executeJs = script.runInContext(context, {filename: name});
        script = null; context = null; memory = null;
    
        // スクリプトを実行して、exportsの条件を取得.
        var ret = {};
        executeJs(ret);
    
        // 実行結果を返却.
        return ret;
    } catch(e) {
        console.error(
            "## [ERROR] originRequire name: " + name);
        throw e;
    }
}

// etagレスポンス返却.
// response 出力先のレスポンスを設定します.
// fileName 対象のファイル名を設定します.
// 戻り値: response情報が返却されます.
const getResponse = function(response, fileName) {
    // レスポンスが存在しない場合.
    if(response == undefined || response == null) {
        // 返却用として生成.
        response = {};
    }
    // stat情報を取得.
    const stat = readStat(fileName);
    if(stat == null) {
        // 404エラー返却.
        // headerは空.
        response["status"] = 404;
        response["header"] = {
            "server": cons.SERVER_NAME,
            "date": new Date().toISOString()
        }
        return response;
    }
    // ファイル長を取得.
    const fileLen = stat.size;
    // ファイル最終更新時間を取得.
    const fileTime = stat.mtime;
    // etagを作成.
    const etag = getEtag(
        fileName, fileLen, fileTime.getTime());
    // レスポンス返却.
    response["status"] = 200;
    response["header"] = {
        "server": cons.SERVER_NAME,
        "date": new Date().toISOString(),
        "content-length": "" + fileLen,
//        "last-modified": fileTime.toISOString(),
        "etag": etag
    };
    return response;
}

// [偽]ローカルrequire取得.
// mainPath 対象のメインパスを設定します.
// currentPath 対象のカレントパスを設定します.
// name require先のファイルを取得します.
// noneCache [任意]キャッシュしない場合は trueを設定します.
// response レスポンス情報を取得したい場合設定します.
// 戻り値: require結果が返却されます.
const fakeRequire = function(mainPath, currentPath, name,
    noneCache, response) {
    // ファイル名を整形.
    const jsName = trimPath(
        true, mainPath, currentPath, name);
    // レスポンス取得.
    response = getResponse(response, jsName);
    if(response.status >= 400) {
        // エラー返却.
        throw httpError(response.status,
            "Specified file name does not exist: " +
            name);
    }
    // ファイル内容を取得.
    let js = readFile(jsName);
    // ただし指定内容がJSONの場合はJSON.parseでキャッシュ
    // なしで返却.
    if(jsName.toLowerCase().endsWith(".json")) {
        return JSON.parse(js);
    }

    // jsロード処理.
    return originRequire(jsName, js.toString());
}

// [偽]ローカルcontains取得.
// mainPath 対象のメインパスを設定します.
// currentPath 対象のカレントパスを設定します.
// name contains先のファイルを取得します.
// response レスポンス情報を取得したい場合設定します.
// 戻り値: contains結果(binary)が返却されます.
const fakeContents = function(mainPath, currentPath, name, response) {
    // ファイル名を整形.
    const contentsName = trimPath(
        false, mainPath, currentPath, name);
    // レスポンス取得.
    response = getResponse(response, contentsName);
    if(response.status >= 400) {
        // エラー返却.
        throw httpError(response.status,
            "Specified file name does not exist: " +
            name);
    }
    // ファイル内容を取得.
    return readFile(contentsName);
}

// [偽]ローカルhead取得.
// mainPath 対象のメインパスを設定します.
// currentPath 対象のカレントパスを設定します.
// name head先のファイルを取得します.
// 戻り値: response形式の内容が返却されます.
const fakeHead = function(mainPath, currentPath, name) {
    // ファイル名を整形.
    const contentsName = trimPath(
        false, mainPath, currentPath, name);
    // レスポンス情報を取得.
    const response = {};
    getResponse(response, contentsName);
    return response;
}

// s3requireを登録.
// path require先のファイルを取得します.
// currentPath 対象のカレントパスを設定します.
// noneCache [任意]キャッシュしない場合は trueを設定します.
// response レスポンス情報を取得したい場合設定します.
// 戻り値: require結果が返却されます.
const s3require = function(path, currentPath, noneCache, response) {
    if(fakeS3Path == null) {
        throw new Error(
            "Permission to use the s3 environment has not been set.");
    }
    return fakeRequire(
        fakeS3Path, currentPath, path, noneCache, response);
}

// s3containsを登録.
// path contains先のファイルを取得します.
// currentPath 対象のカレントパスを設定します.
// response レスポンス情報を取得したい場合設定します.
// 戻り値: contains結果(binary)が返却されます.
const s3contents = function(path, currentPath, response) {
    if(fakeS3Path == null) {
        throw new Error(
            "Permission to use the s3 environment has not been set.");
    }
    return fakeContents(fakeS3Path, currentPath, path, response);
}

// s3headを登録.
// path contains先のファイルを取得します.
// currentPath 対象のカレントパスを設定します.
// 戻り値: response情報が返却されます.
const s3head = function(path, currentPath) {
    if(fakeS3Path == null) {
        throw new Error(
            "Permission to use the s3 environment has not been set.");
    }
    return fakeHead(fakeS3Path, currentPath, path);
}

// [s3require]偽exportsを登録.
s3require.exports = {
    setOption: function(){}
};

// grequireを登録.
// path require先のファイルを取得します.
// currentPath 対象のカレントパスを設定します.
// noneCache [任意]キャッシュしない場合は trueを設定します.
// response レスポンス情報を取得したい場合設定します.
// 戻り値: require結果が返却されます.
const grequire = function(path, currentPath, noneCache, response) {
    if(fakeGitPath == null) {
        throw new Error(
            "Permission to use the github environment has not been set.");
    }
    return fakeRequire(
        fakeGitPath, currentPath, path, noneCache, response);
}

// gcontainsを登録.
// path contains先のファイルを取得します.
// currentPath 対象のカレントパスを設定します.
// response レスポンス情報を取得したい場合設定します.
// 戻り値: contains結果(binary)が返却されます.
const gcontents = function(path, currentPath, response) {
    if(fakeGitPath == null) {
        throw new Error(
            "Permission to use the github environment has not been set.");
    }
    return fakeContents(fakeGitPath, currentPath, path, response);
}

// gheadを登録.
// path contains先のファイルを取得します.
// currentPath 対象のカレントパスを設定します.
// 戻り値: response情報が返却されます.
const ghead = function(path, currentPath) {
    if(fakeGitPath == null) {
        throw new Error(
            "Permission to use the github environment has not been set.");
    }
    return fakeHead(fakeGitPath, currentPath, path);
}

// [grequire]偽exportsの偽設定を登録.
grequire.exports = {
    setOptions: function(){},
    setDefault: function(){},
    setOrganizationToken: function(){}
}

// 偽メインパスを取得.
const fakeMainPath = function() {
    const cons = require("./constants.js");

    // 偽S3のメインパス.
    fakeS3Path = util.getEnv(cons.ENV_FAKE_S3_PATH);

    // 偽gitのメインパス.
    fakeGitPath = util.getEnv(cons.ENV_FAKE_GITHUB_PATH);

    // 両方とも設定されていない場合.
    const s3t = typeof(fakeS3Path);
    const gitt = typeof(fakeGitPath);
    if(s3t != "string" && gitt != "string") {
        fakeS3Path = null;
        fakeGitPath = null;
        // エラーとする.
        throw new Error("The main path of s3 and github is not set.");
    }
    // s3メインパスを整形する.
    if(s3t == "string") {
        if(fakeS3Path.endsWith("/")) {
            fakeS3Path = fakeS3Path.substring(0, fakeS3Path.length - 1);
        }
    } else {
        fakeS3Path = null;
    }
    // gitメインパスを整形する.
    if(gitt == "string") {
        if(fakeGitPath.endsWith("/")) {
            fakeGitPath = fakeGitPath.substring(0, fakeGitPath.length - 1);
        }
    } else {
        fakeGitPath = null;
    }
}

// 初期設定.
const init = function() {    
    // メインパスを取得.
    fakeMainPath();

    // グローバル定義.
    Object.defineProperty(_g, "s3require",
        {writable: false, value: s3require});
    Object.defineProperty(_g, "s3contents",
        {writable: false, value: s3contents});
    Object.defineProperty(_g, "s3head",
        {writable: false, value: s3head});
    Object.defineProperty(_g, "grequire",
        {writable: false, value: grequire});
    Object.defineProperty(_g, "gcontents",
        {writable: false, value: gcontents});
    Object.defineProperty(_g, "ghead",
        {writable: false, value: ghead});
}

// 初期化設定を行って `frequire` をgrobalに登録.
init();

})(global);

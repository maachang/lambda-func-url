///////////////////////////////////////////////////////////////////////////////
// lambda側のjsファイルをrequireする(file require).
// または requreで詠み込む nodejsの基本ライブラリもrequireする.
// script.runInContext() で実行した場合、context=global設定していても、requireが
// 利用できない.
// そうすると s3require や grequire で requireが利用できないので、使い勝手が非常に
// 悪い.
// 代替え的にrequireを利用できるようにして、lmdLib以下のrequireもできるようにする.
///////////////////////////////////////////////////////////////////////////////
(function(_g) {
'use strict'

// すでに定義済みの場合.
if(_g.frequire != undefined) {
    return;
}

// nodejs library.
const vm = require('vm');
const fs = require('fs');

// カレントパス名.
const _CURRENT_PATH = __dirname + "/";

// 元のrequire.
const srcRequire = require;

// 指定パス名を整形.
// jsFlag true の場合jsファイルを対象とします.
// name パス名を設定.
// 戻り値: 整形されたパス名が返却されます.
const trimPath = function(jsFlag, name) {
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
    return name;
}

// ファイル存在確認.
// name 対象のファイル名を設定します.
// 戻り値: ファイル名が存在する場合 true.
const isFile = function(name) {
    return fs.existsSync(_CURRENT_PATH + name);
}

// ファイルを詠み込む.
// name 対象のファイル名を設定します.
// 戻り値: ファイル内容がstringで返却されます.
//        存在しない場合は null が返却されます.
const readFile = function(name) {
    const fileName = _CURRENT_PATH + name;
    if(isFile(fileName)) {
        return fs.readFileSync(fileName);
    }
    return null;
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
        memory = null;
    
        // スクリプト実行環境を生成.
        let script = new vm.Script(srcScript, {filename: name});
        srcScript = null;
        const executeJs = script.runInContext(context, {filename: name});
        script = null; context = null;
    
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

// frequireeでloadした内容をCacheする.
const _GBL_FILE_VALUE_CACHE = {};

// 禁止requireファイル群.
const _FORBIDDEN_FREQUIRES = {
    "freqreg.js": true,
    "s3reqreg.js": true,
    "greqreg.js": true,
    "LFUSetup.js": true,
    "index.js": true
};

// file or 元のrequire 用の require.
// name require先のファイルを取得します.
// 戻り値: require結果が返却されます.
const frequire = function(name) {
    // ファイル名を整形.
    const jsName = trimPath(true, name);
    // 禁止されたrequire先.
    if(_FORBIDDEN_FREQUIRES[jsName] == true) {
        throw new Error(
            "Forbidden require destinations specified: " +
            name);
    }
    // ファイル内容を取得.
    let js = readFile(jsName);
    if(js == null) {
        // 存在しない場合はrequireで取得.
        return srcRequire(name);
    }
    // ただし指定内容がJSONの場合はJSON.parseでキャッシュ
    // なしで返却.
    if(jsName.toLowerCase().endsWith(".json")) {
        return JSON.parse(js.toString());
    }
    // キャッシュ情報から取得.
    let ret = _GBL_FILE_VALUE_CACHE[jsName];
    // 存在しない場合.
    if(ret == undefined) {
        // ロードしてキャッシュ.
        ret = originRequire(js.toString());
        js = null;
        _GBL_FILE_VALUE_CACHE[jsName] = ret;
    }
    return ret;
}

// file 用の contents.
// name contains先のファイルを取得します.
// 戻り値: contains結果(binary)が返却されます.
const fcontents = function(name) {
    // ファイル名を整形.
    const containsName = trimPath(false, name);
    // ファイル内容を取得.
    const ret = readFile(containsName);
    if(ret == null) {
        throw new Error(
            "Specified file name does not exist: " +
            name);
    }
    return ret;
}

// キャッシュをクリア.
const clearCache = function() {
    for(let k in _GBL_FILE_VALUE_CACHE) {
        delete _GBL_FILE_VALUE_CACHE[k];
    }
}

// 初期設定.
const init = function() {
    // キャッシュクリアをセット.
    frequire.clearCache = clearCache;
    Object.defineProperty(_g, "frequire",
        {writable: false, value: frequire});
    Object.defineProperty(_g, "fcontents",
        {writable: false, value: fcontents});
}

// 初期化設定を行って `frequire` をgrobalに登録.
init();

})(global);

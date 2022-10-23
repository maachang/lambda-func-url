////////////////////////////////////////////////
// simurator向けの偽regreg.
// - s3require関連のローカル実装.
// - grequire関連のローカル実装.
////////////////////////////////////////////////
(function(_g) {
'use strict';

// nodejs library.
const vm = require('vm');
const fs = require('fs');

// 指定パス名を整形.
// jsFlag true の場合jsファイルを対象とします.
// currentPath カレントパスを設定します.
// name パス名を設定.
// 戻り値: 整形されたパス名が返却されます.
const trimPath = function(jsFlag, currentPath, name) {
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
    return currentPath + "/" + name;
}

// ファイル存在確認.
// name 対象のファイル名を設定します.
// 戻り値: ファイル名が存在する場合 true.
const isFile = function(name) {
    return fs.existsSync(name);
}

// ファイルを詠み込む.
// name 対象のファイル名を設定します.
// 戻り値: ファイル内容がstringで返却されます.
//        存在しない場合は null が返却されます.
const readFile = function(name) {
    if(isFile(name)) {
        return fs.readFileSync(name);
    }
    return null;
}

// originRequire読み込みスクリプトheader.
const ORIGIN_REQUIRE_SCRIPT_HEADER =
    "(function() {\n" +
    "'use strict';\n" +
    "return function(args){\n" +
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

// [偽]ローカルrequire取得.
// currentPath 対象のカレントパスを設定します.
// name require先のファイルを取得します.
// 戻り値: require結果が返却されます.
const fakeRequire = function(currentPath, name) {
    // ファイル名を整形.
    const jsName = trimPath(true, currentPath, name);
    // ファイル内容を取得.
    let js = readFile(jsName);
    if(js == null) {
        throw new Error(
            "Specified file name does not exist: " +
            namjsNamee);
    }
    // ただし指定内容がJSONの場合はJSON.parseでキャッシュ
    // なしで返却.
    if(jsName.toLowerCase().endsWith(".json")) {
        return JSON.parse(js);
    }

    // jsロード処理.
    return originRequire(js.toString());
}

// [偽]ローカルcontains取得.
// currentPath 対象のカレントパスを設定します.
// name contains先のファイルを取得します.
// 戻り値: contains結果(binary)が返却されます.
const fakeContents = function(currentPath, name) {
    // ファイル名を整形.
    const contentsName = trimPath(false, currentPath, name);
    // ファイル内容を取得.
    const ret = readFile(contentsName);
    if(ret == null) {
        throw new Error(
            "Specified file name does not exist: " +
            name);
    }
    return ret;
}

// s3requireを登録.
// path require先のファイルを取得します.
// currentPath 対象のカレントパスを設定します.
// 戻り値: require結果が返却されます.
const s3require = function(path, currentPath) {
    return fakeRequire(currentPath, path);
}

// s3containsを登録.
// path contains先のファイルを取得します.
// currentPath 対象のカレントパスを設定します.
// 戻り値: contains結果(binary)が返却されます.
const s3contents = function(path, currentPath) {
    return fakeContents(currentPath, path);
}

// [s3require]偽exportsを登録.
s3require.exports = {
    setOption: function(){}
};

// grequireを登録.
// path require先のファイルを取得します.
// currentPath 対象のカレントパスを設定します.
// 戻り値: require結果が返却されます.
const grequire = function(path, currentPath) {
    return fakeRequire(currentPath, path);
}

// gcontainsを登録.
// path contains先のファイルを取得します.
// currentPath 対象のカレントパスを設定します.
// 戻り値: contains結果(binary)が返却されます.
const gcontents = function(path, currentPath) {
    return fakeContents(currentPath, path);
}

// [grequire]偽exportsの偽設定を登録.
grequire.exports = {
    setOptions: function(){},
    setDefault: function(){},
    setOrganizationToken: function(){}
}

// 初期設定.
const init = function() {    
    Object.defineProperty(_g, "s3require",
        {writable: false, value: s3require});
    Object.defineProperty(_g, "s3contents",
        {writable: false, value: s3contents});
    Object.defineProperty(_g, "grequire",
        {writable: false, value: grequire});
    Object.defineProperty(_g, "gcontents",
        {writable: false, value: gcontents});
}

// 初期化設定を行って `frequire` をgrobalに登録.
init();

})(global);

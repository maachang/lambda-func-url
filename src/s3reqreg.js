///////////////////////////////////////////////////////////////////////////////
// S3に格納されているjsファイルをrequire的に使えるようにする.
// そのための登録用呼び出し.
// <例>
// // s3requireを利用するための呼び出し処理.
// require("s3reqreg.js")
//
// // カレントパスを設定する場合.
// require("s3reqreg.js").setOption(
//   {contentPath: "s3://bucket/prefix/"});
//
// これら呼び出しで `s3require` が利用可能となります.
// また、カレントパスを設定するとs3側に設置したjs内でのs3require
// 呼び出しにおいて、環境依存しなくて済みます.
// 
// <例>
// [Lambda]index.js
// (async function() {
// require("s3reqreg.js").setOption(
//   {contentPath: "s3://bucket/prefix/"});
// const hoge = async s3require("hoge.js");
//   ・・・・・
// })();
//
// s3://bucket/prefix/hoge.js
// (async function() {
//    const convert = await s3require("convert.js");
// })();
// 
// 従来なら
// > const hoge = async s3require("hoge.js");
// > const convert = await s3require("convert.js");
// は
// > const hoge = async s3require("s3://bucket/prefix/hoge.js");
// > const convert = await s3require("s3://bucket/prefix/convert.js");
//
// の定義が必要ですが、currentPathを設定することでこれらの設定は不要と
// なり、環境に依存した記載をしなくて済みます.
//
// また、s3requireは一度呼び出したものはキャッシュ化されるので、２度目からの
// 実行コストは軽減されます.
///////////////////////////////////////////////////////////////////////////////
(function(_g) {
'use strict'

// すでに定義済みの場合.
if(_g.s3require != undefined) {
    const m = _g.s3require.exports;
    for(let k in m) {
        exports[k] = m[k];
    }
    return;
}

// frequireが設定されていない場合.
let frequire = global.frequire;
if(frequire == undefined) {
    // frequire利用可能に設定.
    require("./freqreg.js");
    frequire = global.frequire;
}

// nodejs library(vm).
const vm = require('vm');

// s3restApi.
const s3 = frequire("./lib/s3restApi.js");

// HttpStatus.
const httpStatus = frequire("./lib/httpStatus.js");

// s3requireでloadした内容をCacheする.
const _GBL_S3_VALUE_CACHE = {};

// キャッシュタイムアウト値.
// 初期値 30000msec.
let _CACHE_TIMEOUT = 30000;

// cache名を取得.
// params getS3Pathで生成された内容を設定します.
// 戻り値: 文字列が返却されます.
const getCacheName = function(params) {
    return "s3://" + params.Bucket + "/" + params.Key;
}

// キャッシュOFF条件.
let _NONE_CACHE = false;

// カレントパス.
let _CURRENT_PATH = undefined;

// リージョン.
let _REGION = undefined;

// S3カレントパスを変換.
// path `s3://` から始まるカレントパスを設定します.
// 戻り値: 正しいS3カレントパス
const convertS3CurrentPath = function(path) {
    path = ("" + path).trim();
    // パスを解析.
    const p = path.indexOf("://");
    // 頭に`s3://`系 が設定されていない場合セットする.
    if(p == -1) {
        path = "s3://" + path;
    }
    // 最後尾に `/` が存在しない場合.
    if(!path.endsWith("/")) {
        // `/` を最後尾に付与.
        path += "/";
    }
    return path;
}

// オプション設定.
// option {currentPath: string} カレントパスを設定します.
//        {region: string} リージョンを設定します.
//        {timeout: number} キャッシュタイムアウトを設定します.
//        {noneCache: boolean} 未キャッシュ条件を設定します.
// 戻り値 exports と同等の内容が戻されます.
const setOption = function(option) {
    // カレントパスを設定.
    let path = option.currentPath;
    if(path != undefined && path != null) {
        _CURRENT_PATH = convertS3CurrentPath("" + path);
    }
    // リージョンを設定.
    let region = option.region;
    if(region != undefined && region != null) {
        _REGION = "" + region;
    }
    // キャッシュタイムアウト.
    let timeout = option.timeout|0;
    if(timeout > 0) {
        _CACHE_TIMEOUT = timeout;
    }
    // noneCache条件.
    _NONE_CACHE = ("" + option.noneCache) == "true";
    
    // exportsを返却.
    return exports;
}

// 設定リージョンが存在しない場合`東京(ap-northeast-1)`を
// 設定するようにする.
const getRegion = function() {
    let ret = _REGION;
    if(ret == undefined || ret == null) {
        // 指定が無い場合は東京をセット.
        ret = _REGION = "ap-northeast-1";
    }
    return ret;
}  

// s3pathをbucketとkeyに変換.
// path S3pathを設定します.
// currentPath 別途カレントパスを設定した場合、こちらが有効になります.
// 戻り値: {Bucket: bucket名, Key: key名}が返却されます.
const getS3Path = function(path, currentPath) {
    // カレントパスが設定されていない場合.
    if(_CURRENT_PATH == undefined &&
        currentPath == undefined) {
        // パスを解析.
        const p = path.indexOf("://");
        // 頭に`s3://`系 が設定されていない場合セットする.
        if(p == -1) {
            path = "s3://" + path;
        }
    // カレントパスが設定されている場合.
    } else {
        // 今回設定されたカレントパスが存在しない場合.
        if(currentPath == undefined) {
            // デフォルトのカレントパスを利用する.
            currentPath = _CURRENT_PATH;
        // カレントパスが設定されている場合.
        } else {
            // 正しい条件に変換.
            currentPath = convertS3CurrentPath(
                currentPath);
        }
        // s3:// や s3a:// が存在しない場合のみ
        // カレントパスをセットする.
        let p = path.indexOf("://");
        if(p == -1) {
            // 一番前に `/` が存在する場合.
            if(path.startsWith("/")) {
                // 除外.
                path = path.substring(1);
            }
            // カレントパスとマージ.
            path = currentPath + path;
        }
    }
    // s3:// or s3a:// の区切り位置を検索.
    const b = path.indexOf("://") + 3;
    // バケット名とkey名を分ける.
    let p = path.indexOf("/", b);
    // 分けれない場合.
    if(p == -1) {
        throw new Error(
            "The path definition (" + path +
            ") to read is strange.");
    }
    // 解析して返却.
    return {
        Bucket: path.substring(b, p),
        Key: path.substring(p + 1)
    };
}

// 指定S3からオブジェクトを取得.
// params urlをgetS3Path()で処理した内容を設定します.
// response レスポンス情報を取得したい場合設定します.
// 戻り値: promiseが返却されます.
const loadS3 = async function(params, response) {
    if(response == undefined || response == null) {
        response = {};
    }
    const ret = await s3.getObject(
        response, getRegion(), params.Bucket, params.Key)
    if(response.status >= 400) {
        // ステータス入りエラー返却.
        throw httpStatus.httpError(response.status,
            "error load s3: " + response.status +
            " " + JSON.stringify(params));
    }
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

// 文字デコード.
const _TEXT_DECODE = new TextDecoder();

// originRequireを実施.
// name load対象のs3Nameを設定します.
// js load対象のjsソース・ファイルを設定します.
// 戻り値: exportsに設定された内容が返却されます.
const originRequire = function(name, js) {
    // origin的なrequireスクリプトを生成.
    let srcScript = ORIGIN_REQUIRE_SCRIPT_HEADER
        + _TEXT_DECODE.decode(js)
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

// s3情報を指定してrequire的実行.
// path requireするs3pathを設定します.
// currentPath 今回有効にしたいcurrentPathを設定する場合、設定します.
// noneCache キャッシュしない場合は trueを設定します.
// response レスポンス情報を取得したい場合設定します.
// 戻り値: promiseが返却されます.
//         利用方法として以下の感じで行います.
//           ・・・・・・
//           exports.handler = function(event, context) {
//              const conv = await s3require("s3://hoge/moge/conv.js");
//             ・・・・・・
//           }
//         
//         面倒なのは、s3requireを利用する毎に毎回(async function() {})()
//         定義が必要なことと、通常のrequireのように、function外の呼び出し
//         定義ができない点(必ずFunction内で定義が必須)です.
const s3require = async function(path, currentPath, noneCache, response) {
    // noneCacheモードを取得.
    if(typeof(noneCache) != "boolean") {
        // 取得できない場合は、デフォルトのnoneCacheモードをセット.
        noneCache = _NONE_CACHE;
    }
    // s3pathをBucket, Keyに分解.
    const s3params = getS3Path(path, currentPath);
    // 分解したs3paramsをキャッシュ名として取得.
    const s3name = getCacheName(s3params);
    // キャッシュオブジェクトを取得.
    const cache = _GBL_S3_VALUE_CACHE;
    // キャッシュありで処理する場合.
    if(!noneCache) {
        // 既にロードされた内容がキャッシュされているか.
        // ただしタイムアウトを経過していない場合.
        const ret = cache[s3name];
        if(ret != undefined && ret[1] > Date.now()) {
            // キャッシュされている場合は返却(promise).
            return new Promise((resolve) => {
                resolve(ret[0]);
            });
        }
    }
    // S3からデータを取得して実行してキャッシュ化する.
    const js = (await loadS3(s3params, response)).toString();
    // ただし指定内容がJSONの場合はJSON.parseでキャッシュ
    // なしで返却.
    if(path.toLowerCase().endsWith(".json")) {
        return JSON.parse(js);
    }
    // jsを実行.
    const result = originRequire(s3name, js);

    // キャッシュありで処理する場合.
    if(!noneCache) {
        // キャッシュにセット.
        // [0] キャッシュデータ.
        // [1] キャッシュタイムアウト時間.
        cache[s3name] = [result, Date.now() + _CACHE_TIMEOUT];
    }

    // 実行結果を返却.
    return result;
}

// s3情報を設定してコンテンツ(binary)を取得.
// path requireするs3pathを設定します.
// currentPath 今回有効にしたいcurrentPathを設定する場合、設定します.
// response レスポンス情報を取得したい場合設定します.
// 戻り値: promiseが返却されます.
const s3contents = function(path, currentPath, response) {
    // s3pathをBucket, Keyに分解.
    // S3からコンテンツ(binary)を返却.
    return loadS3(getS3Path(path, currentPath), response);
}

// s3情報のレスポンス情報を取得.
// path requireするs3pathを設定します.
// currentPath 今回有効にしたいcurrentPathを設定する場合、設定します.
// 戻り値: promiseが返却されます.
const s3head = async function(path, currentPath) {
    const response = {}
    const params = getS3Path(path, currentPath);
    await s3.headObject(
        response, getRegion(), params.Bucket, params.Key);
    return response;
}

// キャッシュをクリア.
const clearCache = function() {
    for(let k in _GBL_S3_VALUE_CACHE) {
        delete _GBL_S3_VALUE_CACHE[k];
    }
}

// 初期設定.
const init = function() {
    // キャッシュクリアをセット.
    s3require.clearCache = clearCache;
    // s3requireをglobalに登録(書き換え禁止).
    Object.defineProperty(_g, "s3require",
        {writable: false, value: s3require});
    // s3contentsをglobalに登録(書き換え禁止).
    Object.defineProperty(_g, "s3contents",
        {writable: false, value: s3contents});
    // s3headをglobalに登録(書き換え禁止).
    Object.defineProperty(_g, "s3head",
        {writable: false, value: s3head});

    // exportsを登録.
    s3require.exports = {
        setOption: setOption
    };

    /////////////////////////////////////////////////////
    // 外部定義.
    /////////////////////////////////////////////////////
    const m = s3require.exports;
    for(let k in m) {
        exports[k] = m[k];
    }
}

// 初期化設定を行って `s3require`, `s3contents` を
// grobalに登録.
init();

})(global);

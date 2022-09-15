///////////////////////////////////////////////////////////////////////////////
// githubに格納されているjsファイルをrequire的に使えるようにする.
// そのための登録用呼び出し.
//
// githubのソースコード取得方法のURL.
// https://raw.githubusercontent.com/{organization}/{repogitory}/{branch}/{path}
// privateリポジトリの場合は、HttpHeaderに対して{Authorization: token {personal access token}
// を設定する必要がある.
// これによりgithubからjsのソースコードを取得することができるので、AWS Lambdaからの
// 呼び出しに対して、共通ライブラリの管理がgithub管理で利用する事ができる。
///////////////////////////////////////////////////////////////////////////////
(function(_g) {
'use strict'

// nodejs library.
const vm = require('vm');
const https = require('https');

// githubリポジトリ内のオブジェクトを取得するためのURLを生成.
// https://raw.githubusercontent.com/{organization}/{repo}/{branch}/{path}
// organization githubのorganization を設定します.
// repo githubのrepogitory を設定します.
// branch 対象のbranch を設定します.
// path 対象のpath を設定します.
// 戻り値: URLが返却されます.
const getGithubObjectToURL = function(organization, repo, branch, path) {
    return "https://raw.githubusercontent.com/" +
        organization + "/" + repo + "/" + branch + "/" + path;
}

// 対象Githubリポジトリ内のオブジェクトを取得.
// url 対象のURLLを設定します.
// token privateリポジトリにアクセスする場合は、githubのtokenをセットします.
// 戻り値: HTTPレスポンスBodyが返却されます.
const getGithubObject = function(url, token) {
    return new Promise((resolve, reject) => {
        // デフォルトヘッダを設定.
        const headers = {
            "X-Header": "X-Header"
        };
        // privateリポジトリにアクセスする場合
        // tokenが必要.
        if(typeof(token) == "string") {
            headers["Authorization"] = "token " + token;
        }
        try {
            // request作成.
            const req = https.request(url, {
                "method": "GET",
                "headers": headers 
            }, (res) => {
                // httpステータスエラーの場合(400以上).
                if(res.statusCode >= 400) {
                    reject(new Error("httpState: " + res.statusCode +
                        " messaeg: " + res.statusMessage));
                    return;
                }
                // response処理.
                try {
                    res.setEncoding("utf8");
                    let body = "";
                    res.on("data", (chunk)=>{
                        body += chunk;
                    });
                    res.on("end", ()=>{
                        resolve(body);
                    });
                    res.on("error", reject);
                } catch (err) {
                    reject(err)
                }
            });
            // request処理.
            req.on('error', reject);
            req.end();
        } catch (err) {
            reject(err)
        }
    });
}

// organizationTokeを管理.
// 対象organizationのrepogitoryでprivateなものに対して
// オブジェクトを取得する場合に設定され、それらが管理されます.
// { "organization" : "token" } の形で管理します.
const organizationToken = {};

// organizationTokenを設定.
// organization 対象のorganization名を設定します.
// token 対象のTokenを設定します.
const putOrganizationToken = function(organization, token) {
    organizationToken[organization] = token;
}

// organizationTokeを取得.
// organization 対象のorganization名を設定します.
// 戻り値: 存在する場合Tokenが返却されます.
const getOrganizationToken = function(organization) {
    return organizationToken[organization];
}

// 利用可能なorganizationTokenに対するJson設定を行う.
// json 以下のjsonフォーマットを設定します.
// {
//   organization: token
// }
// これによって複数のorganizationに対するToken設定を行います.
const setOrganizationTokenJson = function(json) {
    if(!Array.isArray(json)) {
        throw new Error("Target JSON is not Array type.");
    }
    for(let k in json) {
        putOrganizationToken(k, json[k]);
    }
}

// grequireでloadした内容をCacheする.
const _GBL_GIT_VALUE_CACHE = {};

// cache情報を取得.
const getCacheObject = function() {
    return _GBL_GIT_VALUE_CACHE;
}

// キャッシュタイムアウト値.
// 初期値 30000msec.
let _CACHE_TIMEOUT = 30000;

// キャッシュOFF条件.
let _NONE_CACHE = false;

// オプション設定.
// option {timeout: number} キャッシュタイムアウトを設定します.
//        {noneCache: boolean} 未キャッシュ条件を設定します.
// 戻り値 exports と同等の内容が戻されます.
const set = function(option) {
    // キャッシュタイムアウト.
    let timeout = option.timeout;
    if(typeof(timeout) == "number" && timeout > 0) {
        _CACHE_TIMEOUT = timeout;
    }
    // noneCache条件.
    let noneCache = option.noneCache;
    if(typeof(noneCache) == "boolean") {
        _NONE_CACHE = noneCache;
    }
    // exportsを返却.
    return exports;
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
// name load対象のs3Nameを設定します.
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
        console.error("## [ERROR] originRequire name: " + name);
        throw e;
    }
}

// githubリポジトリ情報を指定してrequire的実行.
// organization [必須]githubのorganization を設定します.
// repo [必須]githubのrepogitory を設定します.
// branch [必須]対象のbranch を設定します.
// path [必須]対象のpath を設定します.
// noneCache [任意]キャッシュしない場合は trueを設定します.
// 戻り値: promiseが返却されます.
//         利用方法として以下の感じで行います.
//           ・・・・・・
//           exports.handler = function(event, context) {
//              const conv = await grequire(....);
//             ・・・・・・
//           }
//         
//         面倒なのは、grequireを利用する毎に毎回(async function() {})()
//         定義が必要なことと、通常のrequireのように、function外の呼び出し
//         定義ができない点(必ずFunction内で定義が必須)です.
const grequire = async function(organization, repo, branch, path, noneCache) {
    // noneCacheモードを取得.
    if(typeof(noneCache) != "boolean") {
        // 取得できない場合は、デフォルトのnoneCacheモードをセット.
        noneCache = _NONE_CACHE;
    }
    // githubObject用のURLを取得.
    const url = getGithubObjectToURL(organization, repo, branch, path);
    // キャッシュオブジェクトを取得.
    const cache = getCacheObject();
    // キャッシュありで処理する場合.
    if(!noneCache) {
        // 既にロードされた内容がキャッシュされているか.
        // ただしタイムアウトを経過していない場合.
        const ret = cache[url];
        if(ret != undefined && ret[1] > Date.now()) {
            // キャッシュされている場合は返却(promise).
            return new Promise((resolve) => {
                resolve(ret[0]);
            });
        }
    }
    // gitのrepogitoryからデータを取得して実行してキャッシュ化する.
    const js = await getGithubObject(url, getOrganizationToken(organization));
    // jsを実行.
    const result = originRequire(url, js);

    // キャッシュありで処理する場合.
    if(!noneCache) {
        // キャッシュにセット.
        // [0] キャッシュデータ.
        // [1] キャッシュタイムアウト時間.
        cache[url] = [result, Date.now() + _CACHE_TIMEOUT];
    }

    // 実行結果を返却.
    return result;
}

// 初期設定.
const init = function() {
    // s3requireをglobalに登録、global設定に対して書き込み不可設定を行う.
    Object.defineProperty(_g, "grequire",
        {writable: false, value: grequire});
}

/////////////////////////////////////////////////////
// 外部定義.
/////////////////////////////////////////////////////
exports.set = set;
exports.putOrganizationToken = putOrganizationToken;
exports.setOrganizationTokenJson = setOrganizationTokenJson;

// 初期化設定を行って `s3require` をgrobalに登録.
init();

})(global);
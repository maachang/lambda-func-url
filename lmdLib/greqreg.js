///////////////////////////////////////////////////////////////////////////////
// githubのリポジトリに格納されているjsファイルをrequire的に使えるようにする.
// そのための登録用呼び出し.
//
// githubのソースコード取得方法のURL.
// https://raw.githubusercontent.com/{organization}/{repogitory}/{branch}/{path}
// privateリポジトリの場合は、HttpHeaderに対して{Authorization: token {personal access token}
// を設定する必要がある.
// これによりgithubからjsのソースコードを取得することができるので、AWS Lambdaからの
// 呼び出しに対して、共通ライブラリの管理がgithub管理で利用する事ができる。
// ただ、AWS Lambdaから外部参照するので、多分通信コストが発生する.
///////////////////////////////////////////////////////////////////////////////
(function(_g) {
'use strict'

// nodejs library.
const vm = require('vm');
const https = require('https');

// 文字列が存在するかチェック.
// s 文字列を設定します.
// 戻り値: trueの場合、文字列が存在します.
const useString = function(s) {
    return typeof(s) == "string" && s.length > 0;
}

// Github接続条件をチェック.
// organization githubのorganization を設定します.
// repo githubのrepogitory を設定します.
// branch 対象のbranch を設定します.
const _checkConnectGithub = function(organization, repo, branch) {
    if(!useString(organization)) {
        throw new Error("organization does not exist");
    } else if(!useString(repo)) {
        throw new Error("repo does not exist");
    } else if(!useString(branch)) {
        throw new Error("branch does not exist");
    }
}

// githubリポジトリ内のオブジェクトを取得するためのURLを生成.
// https://raw.githubusercontent.com/{organization}/{repo}/{branch}/{path}
// organization githubのorganization を設定します.
// repo githubのrepogitory を設定します.
// branch 対象のbranch を設定します.
// currentPath 対象のカレントパスを設定します.
// path 対象のpath を設定します.
// 戻り値: URLが返却されます.
const getGithubObjectToURL = function(organization, repo, branch, currentPath, path) {
    _checkConnectGithub(organization, repo, branch);
    // パスの先頭に / がある場合は除去する.
    if((path = path.trim()).startsWith("/")) {
        path = path.substring(1);
    }
    // カレントパスが設定されている場合.
    if(useString(currentPath)) {
        path = currentPath + "/" + path;
    }
    // パス情報が設定されていない場合.
    if(!useString(path)) {
        throw new Error("path does not exist");
    }
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
                    // バイナリ受信.
                    const body = [];
                    res.on("data", (chunk)=>{
                        body.push(chunk);
                    });
                    res.on("end", ()=>{
                        resolve(Buffer.concat(body));
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

// 文字エンコード.
const _TEXT_ENCODE = new TextEncoder();

// 対象Githubリポジトリ内のJavascriptをロード..
// url 対象のURLLを設定します.
// token privateリポジトリにアクセスする場合は、githubのtokenをセットします.
// 戻り値: HTTPレスポンスBodyが返却されます.
const getGithubObjectToJs = function(url, token) {
    return getGithubObject(url, token)
    .then((body) => {
        return _TEXT_ENCODE.encode(body);
    });
}

// デフォルトの接続先organization.
let _DEFAULT_ORGANIZATION = null;

// デフォルトの接続先repogitory.
let _DEFAULT_REPO = null;

// デフォルトの接続先branch.
let _DEFAULT_BRANCH = null;

// 標準のgithubリポジトリ接続情報を設定します.
// organization githubのorganization を設定します.
// repo githubのrepogitory を設定します.
// branch 対象のbranch を設定します.
// path 対象のpath を設定します.
const setDefault = function(organization, repo, branch) {
    _checkConnectGithub(organization, repo, branch);
    _DEFAULT_ORGANIZATION = organization;
    _DEFAULT_REPO = repo;
    _DEFAULT_BRANCH = branch;
    return exports;
}

// organizationTokeを管理.
// 対象organizationのrepogitoryでprivateなものに対して
// オブジェクトを取得する場合に設定され、それらが管理されます.
// { "organization" : "token" } の形で管理します.
const _ORGANIZATION_TOKENS = {};

// organizationTokenを設定.
// organization 対象のorganization名を設定します.
// token 対象のTokenを設定します.
// 戻り値 exports と同等の内容が戻されます.
const setOrganizationToken = function(organization, token) {
    _ORGANIZATION_TOKENS[organization] = token;
    // exportsを返却.
    return exports;
}

// 利用可能なorganizationTokenに対するJson設定を行う.
// json 以下のjsonフォーマットを設定します.
// {
//   organization: token
// }
// これによって複数のorganizationに対するToken設定を行います.
// 戻り値 exports と同等の内容が戻されます.
const setOrganizationTokenToJson = function(json) {
    if(!Array.isArray(json)) {
        throw new Error("Target JSON is not Array type.");
    }
    for(let k in json) {
        setOrganizationToken(k, json[k]);
    }
    // exportsを返却.
    return exports;
}

// organizationTokeを取得.
// organization 対象のorganization名を設定します.
// 戻り値: 存在する場合Tokenが返却されます.
const getOrganizationToken = function(organization) {
    return _ORGANIZATION_TOKENS[organization];
}

// grequireでloadした内容をCacheする.
const _GBL_GIT_VALUE_CACHE = {};

// cache情報を取得.
const getCacheObject = function() {
    return _GBL_GIT_VALUE_CACHE;
}

// カレントパス.
let _CURRENT_PATH = undefined;

// キャッシュタイムアウト値.
// 初期値 30000msec.
let _CACHE_TIMEOUT = 30000;

// キャッシュOFF条件.
let _NONE_CACHE = false;

// オプション設定.
// option {timeout: number} キャッシュタイムアウトを設定します.
//        {noneCache: boolean} 未キャッシュ条件を設定します.
// 戻り値 exports と同等の内容が戻されます.
const setOptions = function(option) {
    // カレントパスを設定.
    let path = option.currentPath;
    if(typeof(path) == "string") {
        // 前後の / を取り除く.
        // "/a/b/c/" => "a/b/c"
        path = path.trim();
        if(path.startsWith("/")) {
            path = path.substring(1).trim();
        }
        if(path.endsWith("/")) {
            path = path.substring(0, path.length - 1).trim();
        }
        _CURRENT_PATH = path;
    }
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
        console.error("## [ERROR] originRequire name: " + name);
        throw e;
    }
}

// githubリポジトリ情報を指定してrequire的実行.
// path [必須]対象のpath を設定します.
// organization [任意]githubのorganization を設定します.
// repo [任意]githubのrepogitory を設定します.
// branch [任意]対象のbranch を設定します.
// currentPath [任意]カレントパスを設定します.
// noneCache [任意]キャッシュしない場合は trueを設定します.
// 戻り値: promiseが返却されます.
//  利用方法として以下の感じで行います.
//  ・・・・・・
//  exports.handler = function(event, context) {
//    const conv = await grequire(....);
//    ・・・・・・
//  }
//         
// 面倒なのは、grequireを利用する毎に毎回(async function() {})()
// 定義が必要なことと、通常のrequireのように、function外の呼び出し
// 定義ができない点(必ずFunction内で定義が必須)です.
const grequire = async function(
    path, organization, repo, branch, currentPath, noneCache) {
    // 省略パラメータのデフォルト設定.
    if(!useString(organization)) {
        organization = _DEFAULT_ORGANIZATION;
    }
    if(!useString(repo)) {
        repo = _DEFAULT_REPO;
    }
    if(!useString(branch)) {
        branch = _DEFAULT_BRANCH;
    }
    if(!useString(currentPath)) {
        currentPath = _CURRENT_PATH
    }
    // githubObject用のURLを取得.
    const url = getGithubObjectToURL(
        organization, repo, branch, currentPath, path);
    // noneCacheモードを取得.
    if(typeof(noneCache) != "boolean") {
        // 取得できない場合は、デフォルトのnoneCacheモードをセット.
        noneCache = _NONE_CACHE;
    }
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
    // gitのrepogitoryからデータを取得して実行.
    const js = await getGithubObjectToJs(url, 
        getOrganizationToken(organization));
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

// github情報を設定してコンテンツ(binary)を取得.
// path [必須]対象のpath を設定します.
// organization [任意]githubのorganization を設定します.
// repo [任意]githubのrepogitory を設定します.
// branch [任意]対象のbranch を設定します.
// currentPath [任意]カレントパスを設定します.
// 戻り値: promiseが返却されます.
const gcontents = function(
    path, organization, repo, branch, currentPath) {
    // 省略パラメータのデフォルト設定.
    if(!useString(organization)) {
        organization = _DEFAULT_ORGANIZATION;
    }
    if(!useString(repo)) {
        repo = _DEFAULT_REPO;
    }
    if(!useString(branch)) {
        branch = _DEFAULT_BRANCH;
    }
    if(!useString(currentPath)) {
        currentPath = _CURRENT_PATH
    }
    // githubObject用のURLを取得.
    const url = getGithubObjectToURL(
        organization, repo, branch, currentPath, path);
    // githubからコンテンツ(binary)を返却.
    return getGithubObject(url, 
        getOrganizationToken(organization));
}

// 初期設定.
const init = function() {
    // grequireをglobalに登録、global設定に対して書き込み不可設定を行う.
    Object.defineProperty(_g, "grequire",
        {writable: false, value: grequire});
    // gcontentsをglobalに登録、global設定に対して書き込み不可設定を行う.
    Object.defineProperty(_g, "gcontents",
        {writable: false, value: gcontents});
}

/////////////////////////////////////////////////////
// 外部定義.
/////////////////////////////////////////////////////
exports.setOptions = setOptions;
exports.setDefault = setDefault;
exports.setOrganizationToken = setOrganizationToken;
exports.setOrganizationTokenToJson = setOrganizationTokenToJson;

// 初期化設定を行って `grequire` をgrobalに登録.
init();

})(global);
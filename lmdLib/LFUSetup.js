//////////////////////////////////////////////////////////
// lambda-func-url の環境設定用セットアップ.
// 形としては、以下のような形で行います.
//
// index.js
// ------------------------------------------------------
// exports.handler async => {
//   return await require("./LFUSetup.js").start();
// }
// ------------------------------------------------------
// と言う感じで定義することで、lambda-func-url のセットアップ
// を行い、正しく起動することができます.
// 
// また `require("./LFUSetup.js").start();` では以下の引数を
// 設定する事が可能です.
// 
// 
//
//////////////////////////////////////////////////////////
(function(_g) {
'use strict'

// Lambdaに適した最低限のMimeType.
const mime = require("./mimeType");

// HTTPステータス.
const httpStatus = require("./httpStatus.js");

// HTTPヘッダ.
const httpHeader = require("./httpHeader.js");

// エラー例外処理.
// message　エラーメッセージを設定します.
const error = function(message) {
    throw new Error("ERROR [LFUSetup] " + message);
}

// Lambdaで定義された環境変数を取得.
// name 対象の環境変数名を設定します.
// 戻り値: 環境変数が存在する場合返却されます.
const getEnv = function(name) {
    return process.env[name];
}

// カンマ[,]単位で区切る.
// value 文字列を設定します.
// 戻り値: カンマで区切られた内容がArrayで返却されます.
const parseComma = function(value) {
    const list = value.split(",");
    const len = list.length;
    for(let i = 0; i < len; i ++) {
        list[i] = list[i].trim();
    }
    return list;
}

// ArrayをMap変換.
// keys MapのKey群を設定します.
// array Arrayを設定します.
// 戻り値: Mapが返却されます.
const arrayToMap = function(keys, array) {
    const len = keys.length;
    const ret = {};
    for(let i = 0; i < len; i ++) {
        ret[keys[i]] = array.length >= (i + 1) ?
            array[i] : undefined;
    }
    return ret;
}

//--------------------------------------------------------
// [環境変数]基本設定.
//--------------------------------------------------------

// [環境変数]メインで利用するrequire.
// この条件は[必須]です.
// "MAIN_REQUIRE"="s3": S3をメインで利用する.
// "MAIN_REQUIRE"="git": github repogitoryをメインで利用する.
const _ENV_MAIN_REQUIRE = "MAIN_REQUIRE";

// [環境変数]request時のカレントパス設定.
// この条件は[必須]です.
// 設定方法は REQUEST_PATH="requestPath"
// と設定します.
const _ENV_REQUEST_PATH = "REQUEST_PATH";

// [環境変数]s3require, s3request時の接続設定.
// "MAIN_REQUIRE"="s3" の場合は、この条件は[必須]です.
// 設定方法は S3_CONNECT="requirePath, region"
// とカンマ[,]単位で区切って設定します.
// 最後の "region" は、省略された場合、東京リージョン
//「ap-northeast-1」になります.
const _ENV_S3_CONNECT = "S3_CONNECT";

// [環境変数]grequire, grequest時の接続設定.
// "MAIN_REQUIRE"="git" の場合は、この条件は[必須]です.
// 設定方法は GIT_CONNECT="organization, repo, branch, requirePath, token"
// とカンマ[,]単位で区切って設定します.
// 最後の "token" は対象github repogitoryがprivateの場合
// 必要です.
const _ENV_GIT_CONNECT = "GIT_CONNECT";

// [環境変数]grequire, grequestのキャッシュタイムアウト値.
// キャッシュタイムアウト値をミリ秒単位で設定します.
// この値は[任意]で、デフォルト値は30000ミリ秒です.
const _ENV_TIMEOUT = "TIMEOUT";

// [環境変数]grequire, grequestのキャッシュの有無を設定します.
// キャッシュをしない場合は REQUIRE_NONE_CACHE=true と設定します.
// この値は[任意]で、デフォルト値はキャッシュONです.
const _ENV_NONE_CACHE = "NONE_CACHE";

// [mainRequest]S3の場合.
const _MAIN_REQUEST_S3 = 0;

// [mainRequest]Gitの場合.
const _MAIN_REQUEST_GIT = 1;

// 環境変数を取得解析して返却. 
const analysisEnv = function() {
    let mainRequest = getEnv(_ENV_MAIN_REQUIRE);
    let requestPath = getEnv(_ENV_REQUEST_PATH);
    let s3Connect = getEnv(_ENV_S3_CONNECT);
    let gitConnect = getEnv(_ENV_GIT_CONNECT);
    let timeout = getEnv(_ENV_TIMEOUT);
    let noneCache = getEnv(_ENV_NONE_CACHE);

    // mainRequest.
    if(mainRequest == undefined) {
        error(_ENV_MAIN_REQUIRE + " is a required setting.");
    }
    // 小文字変換.
    mainRequest = mainRequest.trim().toLowerCase();
    if(mainRequest == "s3") {
        // s3.
        mainRequest = _MAIN_REQUEST_S3;
    } else if(mainRequest == "git") {
        // git.
        mainRequest = _MAIN_REQUEST_GIT;
    } else {
        error("Setting " + _ENV_MAIN_REQUIRE +
            ": " + mainRequest + " is out of scope.");
    }

    // requestPath.
    if(requestPath == undefined) {
        error(_ENV_REQUEST_PATH + " is a required setting.");
    }
    requestPath = requestPath.trim();

    // s3Connect.
    if(s3Connect == undefined) {
        // mainRequest が S3の場合.
        if(mainRequest == _MAIN_REQUEST_S3) {
            error(_ENV_S3_CONNECT + " is a required setting.");
        }
    } else {
        // s3Connectをカンマ区切りでパースする.
        s3Connect = arrayToMap(
            ["requirePath", "region"],
            parseComma(s3Connect));
        if(s3Connect.requirePath == undefined) {
            error(_ENV_S3_CONNECT + ".requirePath is a required setting.");
        }
    }

    // gitConnect.
    if(gitConnect == undefined) {
        // mainRequest が GITの場合.
        if(mainRequest == _MAIN_REQUEST_GIT) {
            error(_ENV_GIT_CONNECT + " is a required setting.");
        }
    } else {
        // gitConnectをカンマ区切りでパースする.
        gitConnect = arrayToMap(
            ["organization", "repo", "branch", "requirePath", "token"],
            parseComma(gitConnect));
        if(gitConnect.organization == undefined) {
            error(_ENV_GIT_CONNECT + ".organization is a required setting.");
        } else if(gitConnect.repo == undefined) {
            error(_ENV_GIT_CONNECT + ".repo is a required setting.");
        } else if(gitConnect.branch == undefined) {
            error(_ENV_GIT_CONNECT + ".branch is a required setting.");
        } else if(gitConnect.requirePath == undefined) {
            error(_ENV_GIT_CONNECT + ".requirePath is a required setting.");
        }
    }
    
    // timeout.
    if(timeout != undefined) {
        timeout = parseInt(timeout);
        if(isNaN(timeout)) {
            error(_ENV_TIMEOUT + " must be numeric.");
        }
    }

    // noneCache.
    if(noneCache != undefined) {
        noneCache = noneCache == true;
    }

    // 解析結果を返却.
    return {
        mainRequest: mainRequest,
        requestPath: requestPath,
        s3Connect: s3Connect,
        gitConnect: gitConnect,
        timeout: timeout,
        noneCache: noneCache
    };
}

// lambda-func-url初期処理.
// filterFunc コンテンツ実行の前処理を行う場合は設定します.
// originMime 拡張MimeTypeを設定します.
//            function(extends)が必要で、拡張子の結果に対して
//            戻り値が {type: mimeType, gz: boolean}を返却する
//            必要があります(非対応の場合は undefined).
const start = function(filterFunc, originMime) {
    // 環境変数を取得.
    const env = analysisEnv();

    // s3reqreg.
    const s3reqreg = require("./s3reqreg");
    // s3接続定義が存在する場合.
    if(env.s3Connect != undefined) {
        // 基本設定.
        s3reqreg.set({
            currentPath: env.s3Connect.requirePath,
            region: env.s3Connect.region,
            timeout: env.timeout,
            nonCache: env.noneCache
        });
    }

    // greqreg.
    const greqreg = require("./greqreg");
    // git接続定義が存在する場合.
    if(env.gitConnect != undefined) {
        // github repogitory設定.
        greqreg.setDefault(
            env.gitConnect.organization,
            env.gitConnect.repo,
            env.gitConnect.branch
        );
        // オプション設定.
        greqreg.setOptions({
            currentPath: env.gitConnect.requirePath,
            timeout: env.timeout,
            nonCache: env.noneCache
        });
        // トークンが存在する場合.
        if(env.gitConnect.token != undefined) {
            greqreg.setOrganizationToken(
                env.gitConnect.organization,
                env.gitConnect.token
            )
        }
    }

    // requestFunction呼び出し処理のFunction生成.
    createRequestFunc(env);

    // filterFuncをセット.
    _filterFunction = (filterFunc == null || filterFunc == undefined) ?
        undefined : filterFunc;

    // 拡張mimeFuncをセット.
    _originMimeFunc = (originMime == null || originMime == undefined) ?
        undefined : originMime;
    
    // main_handlerを返却.
    return _main_handler;
}

// requestFunction呼び出し処理のFunction生成.
// env analysisEnvで取得した環境変数の内容が設定されます.
const createRequestFunc = function(env) {
    if(env.mainRequest == _MAIN_REQUEST_S3) {
        // s3用のrequest処理.
        _requestFunction = function(jsFlag, path) {
            // javascript実行呼び出し.
            if(jsFlag) {
                // キャッシュしないs3require実行.
                return s3require(path, env.requestPath, true);
            }
            // s3contentsを実行してコンテンツを取得.
            return s3contents(path, env.requestPath);
        };
    } else {
        // github用のrequest処理.
        _requestFunction = function(jsFlag, path) {
            // javascript実行呼び出し.
            if(jsFlag) {
                // キャッシュしないgrequire実行.
                return grequire(path,
                    env.gitConnect.organization,
                    env.gitConnect.repo,
                    env.gitConnect.branch,
                    env.requestPath, true);
            }
            // gcontentsを実行してコンテンツを取得.
            return gcontents(path,
                env.gitConnect.organization,
                env.gitConnect.repo,
                env.gitConnect.branch,
                env.requestPath);
        };
    }
}

// requestFunction呼び出し処理.
// 環境変数に従って専用のfunction(jsFlag, path)の
// Functionが作成される.
// jsFlag 実行するJavascriptを取得する場合は true.
// path 対象のパスを設定.
var _requestFunction = undefined;

// filterFunction呼び出し処理.
// コンテンツ呼び出しの前処理を行い、コンテンツ利用に対して
// 制御することができます.
//
// この値がundefinedの場合、処理されません.
var _filterFunction = undefined;

// 拡張MimeType判別処理.
// function(extends)が必要で、拡張子の結果に対して
// 戻り値が {type: mimeType, gz: boolean}を返却する
// 必要があります(非対応の場合は undefined).
//
// この値がundefinedの場合、処理されません.
var _originMimeFunc = undefined;

// mimeType情報を取得.
// AWS Lambdaで最低限のMimeTypeと、ユーザ指定の
// MimeType定義の評価結果が返却されます.
// extenion 拡張子を設定します.
// 戻り値: 一致した条件が存在する場合
//        {type: string, gz: boolean}
//        が返却されます.
const getMimeType = function(extention) {
    let ret = undefined;
    // originMimeFuncが存在する場合.
    if(_originMimeFunc != undefined) {
        // その条件で返却.
        ret = _originMimeFunc(extention);
        // 条件が見合わない場合.
        if(typeof(ret) != "object" ||
            ret.type == undefined ||
            ret.gz == undefined) {
            // 空設定.
            ret = undefined;
        }
    }
    // 存在しない場合.
    if(ret == undefined) {
        // Lambdaに最適なMimeTypeを取得.
        ret = mime.get(extention);
    }
    // 最終的にundefinedの場合は、octet_streamをセット.
    return ret == undefined ?
        mime.OCTET_STREAM: ret;
}

// requestQuery(URL: xxx?a=1&b=2...).
// event aws Lambda[index.js]exports.handler(event)条件が設定されます.
// 戻り値: {key: value .... } のパラメータ条件が返却されます.
//        存在しない場合は {}が返却されます.
const getRequestQueryString = function(event) {
    const ret = event.queryStringParameters;
    if(ret == undefined || ret == null) {
        return {};
    }
    return ret;
}

// パスの拡張子を取得.
// path 対象のパスを設定します.
// 戻り値: 拡張子が無い場合は undefined.
//        拡張子が存在する場合は拡張子返却(toLowerCase対応)
const getPathToExtends = function(path) {
    let p = path.lastIndex("/");
    if(p == -1) {
        p = 0;
    }
    let obj = path.substrinng(p);
    p = obj.lastIndexOf(".");
    if(p == -1) {
        return undefined;
    }
    return obj.substring(p + 1).trim().toLowerCase();
}

// 文字エンコード.
const _TEXT_ENCODE = new TextEncoder();

// 文字列をバイナリに変換.
// s 文字列を設定します.
// 戻り値: バイナリが返却されます.
const stringToBinary = function(s) {
    return _TEXT_ENCODE.encode(s);
}

// HTTPヘッダに対してBody条件を設定します.
// header 対象のHTTPヘッダを設定します.
// body 対象のBodyを設定します.
// 戻り値: 変換されたBody情報が返却されます.
const setHeaderToBody = function(header, body) {
    // コンテンツタイプやコンテンツ長が設定されていない場合.
    if(header.get("content-type") == undefined ||
        header.get("content-length") == undefined) {
        const t = typeof(body);
        // 返却結果が文字列の場合.
        if(t == "string") {
            body = stringToBinary(body);
            // レスポンス返却のHTTPヘッダに対象拡張子MimeTypeをセット.
            header.put("content-type", getMimeType("html"));
            // レスポンス返却のBody長をセット.
            header.put("content-length", body.length);
        // 返却結果がobject型の場合.
        } else if(t == "object") {
            body = stringToBinary(JSON.stringify(body));
            // レスポンス返却のHTTPヘッダに対象拡張子MimeTypeをセット.
            header.put("content-type", mime.JSON);
            // レスポンス返却のBody長をセット.
            header.put("content-length", body.length);
        // その他の場合、文字列変換.
        } else {
            body = stringToBinary("" + body);
            // レスポンス返却のHTTPヘッダに対象拡張子MimeTypeをセット.
            header.put("content-type", getMimeType("text"));
            // レスポンス返却のBody長をセット.
            header.put("content-length", body.length);
        }
    }
    return body;
}

// [Main]ハンドラー実行.
// lambda-func-url に対する実行処理(HTTP or HTTPS)が行われるので、
// ここでハンドラー実行処理を行う必要がある.
// event aws lambdaの index.jsでの exports.handler(event)の
//       条件が設定されます.
const _main_handler = async function(event) {

    // レスポンスステータス.
    const resState = httpStatus.create();
    // レスポンスヘッダ.
    let resHeaders = httpHeader.create();
    try {

        // AWSLambdaの関数URLパラメータから必要な内容を取得して設定.
        const params = {
            // httpメソッド.
            method: event.requestContext.http.method,
            // EndPoint(string)パス.
            path: event.rawPath,
            // リクエストヘッダ(httpHeaderオブジェクト(put, get, getKeys, toMap)).
            reqHeader: httpHeader.create(event.headers),
            // リクエストパラメータ(map).
            requestParams: getRequestQueryString(event),
            // リクエストBody.
            requestBody: event.body == undefined || event.body == null ?
                undefined : event.body,
            // リクエストBodyはBase64変換が必要.
            isBase64Encoded: body.isBase64Encoded,
            // EndPoint(string)パスに対するファイルの拡張子.
            // undefinedの場合、js実行結果を返却させる.
            extension: getPathToExtends(event.rawPath)
        };

        // filterFunctionが設定されてる場合呼び出す.
        if(_filterFunction != undefined) {
            // filterFunctionを実行.
            // 返却値がある場合は、この処理で終わらせる.
            //  string: HTML形式で返却.
            //  object: json形式で返却.
            // これ以外は 強制的に文字列変換して text形式で返却.
            let resBody = _filterFunction(resState, resHeaders, params);
            // 実行に対する戻り値が存在する場合は、コンテンツ実行は行わない.
            if(resBody != undefined && resBody != null) {
                // ヘッダに対してBody条件をセット.
                resBody = setHeaderToBody(resHeaders, resBody);
                // レスポンス返却.
                return {
                    statusCode: resState.getStatus(),
                    headers: resHeaders.toMap(),
                    body: resBody == undefined || resBody == null ? "" : resBody
                };
            }
        }

        // 呼び出し対象がコンテンツ実行(拡張子が存在)の場合.
        // 逆に言えばjs実行ではない場合.
        if(params.extension != undefined) {
            // 配置されているコンテンツのバイナリを返却する.
            try {
                // 対象パスのコンテンツ情報を取得.
                const resBody = await _requestFunction(false, params.path);
                // レスポンス返却のHTTPヘッダに対象拡張子MimeTypeをセット.
                resHeaders.put("content-type", getMimeType(params.extension));
                // レスポンス返却のBody長をセット.
                resHeaders.put("content-length", resBody.length);
                return {
                    statusCode: 200,
                    headers: resHeaders.toMap(),
                    body: resBody
                };
            // エラーが発生した場合.
            } catch(e) {
                // 404エラー返却.
                const resBody = stringToBinary(
                    "[error]404 " + httpStatus.statusToMessage(404));
                // 新しいレスポンスヘッダを作成.
                resHeaders = httpHeader.create();
                // テキストのレスポンスMimeTypeをセット.
                resHeaders.put("content-type", getMimeType("text"));
                // レスポンス返却のBody長をセット.
                resHeaders.put("content-length", resBody.length);
                // ファイルが存在しない(404).
                return {
                    statusCode: 404,
                    headers: resHeaders.toMap(),
                    body: resBody
                };
            }
        }

        // externalなfunctionを実行.
        const func = await _requestFunction(true, params.path + ".js");
        // 実行メソッド(handler)を取得.
        if(typeof(func["handler"]) == "function") {
            func = func["handler"];
        // handler実行メソッドが存在しない場合別の実行メソッド名(execute)で取得.
        } else if(typeof(func["execute"]) == "function") {
            func = func["execute"];
        // それ以外の場合エラー.
        } else {
            throw new Error(
                "The execution method does not exist in the specified path: \"" +
                params.path + ".js\" condition.")
        }

        // js実行.
        let resBody = await func(resState, resHeaders, params);

        // 実行結果リダイレクト条件が設定されている場合.
        if(resState.isRedirect()) {
            // 新しいレスポンスヘッダを作成.
            resHeaders = httpHeader.create();
            // リダイレクト条件をヘッダにセットしてリダイレクト.
            resHeaders.put("location", resState.getRedirectURL());
            resHeaders.put("content-length", 0);
            // 処理返却.
            return {
                statusCode: resState.getStatus(),
                headers: resHeaders.toMap()
            };
        // レスポンスBodyが存在しない場合.
        } else if(resBody == undefined || resBody == null) {
            // mimeType=textでレスポンス0で返却.
            resHeaders.put("content-type", getMimeType("text"));
            resHeaders.put("content-length", 0);
            // 処理返却.
            return {
                statusCode: resState.getStatus(),
                headers: resHeaders.toMap()
            };
        }
        // 処理結果が存在する場合.
        // ヘッダに対してBody条件をセット.
        resBody = setHeaderToBody(resHeaders, resBody);
        // 処理返却.
        return {
            statusCode: resState.getStatus(),
            headers: resHeaders.toMap(),
            body: resBody
        };

    } catch(err) {
        // ※ 「externalなfunctionを実行」では、以下の条件において、
        //    明確なエラーハンドリングが難しい(面倒)なので、全て
        //    httpStatus = 500 で処理している.
        //    1. ファイルが存在しない 404.
        //    2. アクセス権限がない 401.
        //    3. 取得したJavascriptにエラーがある 500.

        // エラーログ出力.
        console.error("[LFU] error: " + err);
        // エラーの場合.
        const resBody = stringToBinary(
            "error 500: " + httpStatus.statusToMessage(500));
        // 新しいレスポンスヘッダを作成.
        resHeaders = httpHeader.create();
        // レスポンス返却のHTTPヘッダに対象拡張子MimeTypeをセット.
        resHeaders.put("content-type", getMimeType("text"));
        // レスポンス返却のBody長をセット.
        resHeaders.put("content-length", resBody.length);
        return {
            statusCode: 500,
            headers: resHeaders.toMap(),
            body: resBody
        };
    }    
};

/////////////////////////////////////////////////////
// 外部定義.
/////////////////////////////////////////////////////
exports.start = start;

})(global);

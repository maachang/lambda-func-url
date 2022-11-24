////////////////////////////////////////////////
// lambdaFunctionUrlsのシミュレーション用Web実装.
////////////////////////////////////////////////
(function(_g) {
'use strict';

// サーバータイムアウト(30秒).
const TIMEOUT = 30 * 1000;

// keep-alive タイムアウト(2.5秒).
const KEEP_ALIVE_TIMEOUT = 2500;

// lambda呼び出しファイル名.
let lfuFile = null;

// bindPort.
let bindPort = null;

// lfuライブラリ.
let cons;
let util;

// lfuライブラリをロード.
const loadLfuLibrary = function() {
    // lffwebで利用するライブラリを再読み込み.
    cons = require("./constants.js");
    util = require("./modules/util/util.js");            
}

// lfuライブラリをロード.
loadLfuLibrary();

// LFUのrequire系キャッシュを削除.
const clearRequireCache = function() {
    // git requireキャッシュ削除.
    if(_g["grequire"] != undefined) {
        try {
            // エラー無視.
            _g["grequire"].clearCache();
        } catch(e) {}
    }
    // s3 requireキャッシュ削除.
    if(_g["s3require"] != undefined) {
        try {
            // エラー無視.
            _g["s3require"].clearCache();
        } catch(e) {}
    }
    // lambda requireキャッシュ削除.
    if(_g["frequire"] != undefined) {
        try {
            _g["frequire"].clearCache();
        } catch(e) {}
    }
    // 通常requireキャッシュ削除.
    const cache = require.cache;
    for(let k in cache) {
        delete cache[k];
    }

    // lfuライブラリをロード.
    loadLfuLibrary();
}

// queryパラメータを取得.
// req HTTPリクエストを設定します.
// 戻り値: queryパラメータが返却されます.
const getQueryParams = function(req) {
    const u = req.url;
    const p = u.indexOf("?");
    if (p == -1) {
        return "";
    }
    return u.substring(p + 1);
}

// パラメータ解析.
const analysisParams = function(n) {
    let list = n.split("&");
    const len = list.length;
    const ret = {};
    for (let i = 0; i < len; i++) {
        n = list[i].split("=");
        if (n.length == 1) {
            ret[n[0]] = '';
        } else {
            ret[n[0]] = decodeURIComponent(n[1]);
        }
    }
    return ret;
}

// 接続先ipアドレスを取得.
// request HTTPリクエストを設定します.
// 戻り値: 接続先IPアドレスが返却されます.
const getIp = function(request) {
    return request.headers['x-forwarded-for']
        ? request.headers['x-forwarded-for']
        : (request.connection && request.connection.remoteAddress)
        ? request.connection.remoteAddress
        : (request.connection.socket && request.connection.socket.remoteAddress)
        ? request.connection.socket.remoteAddress
        : (request.socket && request.socket.remoteAddress)
        ? request.socket.remoteAddress
        : '0.0.0.0';
}

// URLパスを取得.
// req 対象のrequestを設定します.
// 戻り値: URLパスが返却されます.
var getUrlPath = function (req) {
    var u = req.url;
    var p = u.indexOf("?");
    if (p == -1) {
        return u;
    }
    return u.substring(0, p);
}

// HTTPヘッダにNoCacheをセット.
// headers 対象のHTTPヘッダ(Object型)を設定します.
// 戻り値: Objectが返却されます.
const setNoneCacheHeader = function(headers) {
    // キャッシュ条件が設定されている場合.
    if(headers["last-modified"] != undefined ||
        headers["etag"] != undefined) {
        return;
    }
    // HTTPレスポンスキャッシュ系のコントロールが設定されていない
    // 場合にキャッシュなしを設定する.
    if(headers["cache-control"] == undefined) {
        headers["cache-control"] = "no-cache";
    }
    if(headers["pragma"] == undefined) {
        headers["pragma"] = "no-cache";
    }
    if(headers["expires"] == undefined) {
        headers["expires"] = "-1";
    }
}

// クロスヘッダをセット.
// headers 対象のHTTPヘッダ(Object型)を設定します.
// 戻り値: Objectが返却されます.
const setCrosHeader = function(headers) {
    headers['access-control-allow-origin'] = '*';
    headers['access-control-allow-headers'] = '*';
    headers['access-control-allow-methods'] = 'GET, POST';
}

// デフォルト設定ヘッダをセット.
// headers 対象のHTTPヘッダ(Object型)を設定します.
// 戻り値: Objectが返却されます.
const setDefaultHeader = function(headers) {
    // キャッシュなし返却.
    setNoneCacheHeader(headers);

    // cros許可条件を取得.
    let cros = util.getEnv(cons.ENV_HTTP_CROS_MODE);
    if(cros == undefined || cros == null) {
        cros = "false";
    } else {
        cros = cros.trim().toLowerCase();
    }
    // cros許可.
    if(cros == "true") {
        // cros返却.
        setCrosHeader(headers);
    }
    return headers;
}

// レスポンス返却.
// res 対象のHTTPレスポンスオブジェクトが設定されます.
// status Httpステータスが設定されます.
// message Httpステータスメッセージが設定されます.
//         undefined or null の場合は設定されていません.
// headers Httpヘッダが設定されます.
// cookies HttpCookieが設定されます.
// body 対象のBodyが設定されます.
const sendResponse = function(
    res, status, message, headers, cookies, body) {
    // content-lengthが存在しない場合.
    // chunkeed送信でない場合.
    if(headers["content-length"] == undefined &&
        headers["transfer-encoding"] != "chunked") {
        headers["content-length"] = Buffer.byteLength(body);
    }
    // 必要な内容をセット.
    headers["server"] = cons.SERVER_NAME;
    headers["date"] = new Date().toISOString();
    // cookieが存在する場合.
    if(Array.isArray(cookies) && cookies.length > 0) {
        // set-cookieをセット.
        const len = cookies.length;
        for(let i = 0; i < len; i ++) {
            headers["set-cookie"] = cookies[i];
        }
    }
    // 書き込み処理.
    if(typeof(message) == "string") {
        res.writeHead(status, message,
            setDefaultHeader(headers));
    } else {
        res.writeHead(status,
            setDefaultHeader(headers));
    }
    res.end(body);
}

// 正常送信.
// res 対象のHTTPレスポンスオブジェクトが設定されます.
// status Httpステータスが設定されます.
// headers Httpヘッダが設定されます.
// body 対象のBodyが設定されます.
const sendSuccess = function(res, status, headers, body) {
    sendResponse(
        res, status, undefined, headers, undefined, body);
}

// エラー送信.
// res 対象のHTTPレスポンスオブジェクトが設定されます.
// status Httpステータスが設定されます.
// headers Httpヘッダが設定されます.
// err 例外オブジェクトを設定します.
const sendError = function(res, status, headers, err) {
    try {
        if(status >= 500) {
            console.error("sendError: ", err);
        }
        // text返却.
        headers["content-type"] = "text/plain";
        // 送信処理.
        sendResponse(res, status, undefined,
            headers, undefined, "error " + status +
                " Internal Server Error");
    } catch(e) {
        // エラーをデバッグ出力.
        console.debug(
            "error send internal error:", e);
        // レスポンスソケットクローズ.
        try {
            res.socket.destroy();
        } catch (ee) {}
    }
}

// lambdaコンテキスト用success.
// exitFlag Array(false)が設定されます.
//          この値がArray(false)以外の場合、処理は実行されません.
// res 対象のHTTPレスポンスオブジェクトが設定されます.
// success success結果の送信内容を設定します.
//         この条件はJSON.stringify変換されたものが返却対象です.
const lfuSucceed = function(exitFlag, res, success) {
    // 処理済み.
    if(exitFlag[0] != false) {
        return;
    }
    try {
        // ヘッダを作成.
        const headers = {
            // json返却.
            "content-type": "application/json"
        };
        // json変換.
        success = JSON.stringify(success);
        // 空文字の場合.
        if(success == undefined || success == null) {
            success = "";
        }
        // 正常送信.
        sendSuccess(res, 200, headers, success);
    } catch(e) {
        // エラー送信.
        sendError(res, 500, {}, e);
    } finally {
        // 処理済みにセット.
        exitFlag[0] = true;
    }
}

// lambdaコンテキスト用fail.
// exitFlag Array(false)が設定されます.
//          この値がArray(false)以外の場合、処理は実行されません.
// res 対象のHTTPレスポンスオブジェクトが設定されます.

const lfuFail = function(exitFlag, res, error) {
    // 処理済み.
    if(exitFlag[0] != false) {
        return;
    }
    try {
        // エラー送信.
        sendError(res, 500, {}, error);
    } finally {
        // 処理済みにセット.
        exitFlag[0] = true;
    }
}

// lambdaコンテキスト用done.
const lufDone = function(exitFlag, res, fail, success) {
    // 処理済み.
    if(exitFlag[0] != false) {
        return;
    }
    if(fail == undefined || fail == null) {
        lfuSucceed(exitFlag, res, success);
    } else {
        lfuFail(exitFlag, res, fail);
    }
}

// cookie情報を設定.
const setEventCookie = function(event, cookies) {
    if(cookies == undefined) {
        return;
    }
    const list = cookies.split(";");
    const len = list.length;
    for(let i = 0; i < len; i ++) {
        event.cookies[i] = list[i].trim();
    }
}
// LFUのイベントを作成.
// req Httpリクエストオブジェクトを設定します.
// 戻り値: Lfuイベントが返却されます.
const getEvent = function(req, body) {
    const path = getUrlPath(req);
    const ip = getIp(req);
    const now = new Date();
    // LambdaFunctionUrlsに渡す
    // 基本イベントをセット(version 2.0).
    const event = {
        "version": "2.0",
        "routeKey": "$default",
        "rawPath": path,
        "rawQueryString": "",
        "isBase64Encoded": false,
        "headers": {
            "x-amzn-trace-id": "$id",
            "x-forwarded-proto": "http",
            "x-forwarded-port": "" + bindPort,
            "x-forwarded-for": ip,
            "accept": "*/*"
        },
        "cookies": [
        ],
        "queryStringParameters": {},
        "requestContext": {
            "accountId": "anonymous",
            "apiId": "$id",
            "domainName": "$domainName",
            "domainPrefix": "$domainPrefix",
            "http": {
                "method": req.method.toUpperCase(),
                "path": path,
                "protocol": req.protocol,
                "sourceIp": ip,
                "userAgent": req.headers["user-agent"]
            },
            "requestId": "" + now.getTime(),
            "routeKey": "$default",
            "stage": "$default",
            "time": now.toISOString(),
            "timeEpoch": now.getTime()
        }
    };
    // httpヘッダをセット.
    let headers = req.headers;
    // cookieヘッダを取得.
    let cookie = headers.cookie;
    // cookieヘッダを削除.
    delete headers.cookie;
    for(let k in headers) {
        event.headers[k] = headers[k];
    }
    // cookieヘッダをEventにセット.
    setEventCookie(event, cookie);
    cookie = null;
    // getパラメータを取得.
    event.rawQueryString = getQueryParams(req);
    if(event.rawQueryString.length > 0) {
        // getパラメータを解析.
        event.queryStringParameters =
            analysisParams(event.rawQueryString);
    }
    // bodyが存在する場合.
    if(body != undefined && body != null) {
        // bodyをセット(base64).
        event.body = body.toString("base64");
        event.isBase64Encoded = true;
    }
    //console.log("event: " + JSON.stringify(event, null, "  "));
    return event;
}

// lfuで返却されたresult内容を送信.
// res Httpレスポンスを設定します.
// result lfuで返却されたresultを設定します.
const resultLft = function(res, result) {
    // result = {
    //   statusCode: number,
    //   statusMessage: string,
    //   headers: Object,
    //   cookies: List,
    //   isBase64Encoded: boolean,
    //   body: buffer or string
    // }

    // base64で格納されている場合.
    if(result.isBase64Encoded == true) {
        // base64をデコードする.
        result.body = Buffer.from(
            result.body, "base64");
        result.isBase64Encoded = false;
    }
    // 送信処理.
    sendResponse(res, result.statusCode,
        result.statusMessage, result.headers,
        result.cookies, result.body);
}

// lfu呼び出し.
// req Httpリクエストを設定します.
// res Httpレスポンスを設定します.
// body HttpリクエストBodyが存在する場合設定します.
const callLfu = async function(req, res, body) {
    // レスポンス送信フラグ.
    const resFlag = [false];
    // lfuのmain処理呼び出し.
    try {
        // 基本イベントをセット.
        const event = getEvent(req, body);
        // require呼び出し.
        const index = require(lfuFile);
        // 存在しない場合はエラー.
        if(index == undefined) {
            throw new Error(
                "Environment variable LFU path name is not set: " +
                lfuFile);
        }
        // contextを作成.
        const ctx = {
            success: function(value) {
                lfuSucceed(resFlag, res, value);
            },
            fail: function(error) {
                lfuFail(resFlag, res, error);
            },
            done: function(fail, success) {
                lufDone(resFlag, res, fail, success);
            }
        };
        // lfu実行処理.
        const result = await index.handler(event, ctx);
        // 処理済み.
        if(resFlag[0] != false) {
            return;
        }
        // Lfuから返却された内容をresponse.
        resultLft(res, result);
        // 処理済みにセット.
        resFlag[0] = true;
    } catch(err) {
        // 処理済み.
        if(resFlag[0] != false) {
            return;
        }
        try {
            // エラー送信.
            sendError(res, 500, {}, err);
        } finally {
            // 処理済みにセット.
            resFlag[0] = true;
        }
    }
}

// httpRequest.
// req 対象のリクエストオブジェクトが設定されます.
// res 対象のレスポンスオブジェクトが設定されます.
const httpRequest = function(req, res) {
    const method = req.method.toUpperCase()
    // postデータのダウンロード.
    if(method == "POST") {
        // コンテンツ長が設定されている場合.
        if(req.headers["content-length"]) {
            let off = 0;
            let body = Buffer.allocUnsafe(
                req.headers["content-length"]|0);
            req.on('data', function(bin) {
                bin.copy(body, off);
                off += bin.length;
            });
            req.on('end', function() {
                callLfu(req, res, body);
            });
        // コンテンツ長が設定されていない場合.
        } else {
            let list = [];
            let binLen = 0;
            // あるだけ取得.
            req.on('data', function(bin) {
                list.push(bin);
                binLen += bin.length;
            });
            // 処理終了.
            req.on('end', function() {
                let n = null;
                let off = 0;
                let body = Buffer.allocUnsafe(binLen);
                binLen = null;
                const len = buf.length;
                // 取得内容を統合.
                for(let i = 0; i < len; i ++) {
                    n = list[i];
                    n.copy(body, off);
                    list[i] = null;
                    off += n.length;
                }
                list = null;
                callLfu(req, res, body);
            });
        }
    // GET処理.
    } else {
        callLfu(req, res, null);
    }
}

// サーバー起動.
const startupServer = function() {
    // サーバー生成.
    var server = require("http")
        .createServer(
            function (req, res) {
                // 全requireキャッシュのクリア
                //  （simulatorなので毎回削除).
                clearRequireCache();
                // httpRequestを受信処理.
                httpRequest(req, res);
            }
        );

    // タイムアウトセット.
    server.setTimeout(TIMEOUT);

    // [HTTP]キープアライブタイムアウトをセット.
    server.keepAliveTimeout = KEEP_ALIVE_TIMEOUT;

    // maxHeadersCountはゼロにセット.
    server.maxHeadersCount = 0;

    // http.socketオプションを設定.
    server.on("connection", function(socket) {
        // Nagle アルゴリズムを使用する.
        socket.setNoDelay(true);
        // tcp keepAliveを不許可.
        socket.setKeepAlive(false, 0);
    });

    // 指定ポートで待つ.
    // ※ "0.0.0.0" を入れないと `tcp6` となり
    //    http://localhost:{bindPort}/ で
    //    アクセスできないので注意.
    server.listen(bindPort, "0.0.0.0");

    // 起動結果をログ出力.
    console.debug("## listen: " + bindPort +
        " pid:" + process.pid);
}

// スタートアップ処理.
// path lfuPathを設定します..
// port bindPortを設定します.
exports.startup = function(path, port) {
    lfuFile = path + "/index.js";
    bindPort = port;

    // サーバー実行.
    startupServer();
}

})(global);

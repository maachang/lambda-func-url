///////////////////////////////////////////////////////////
// HTTP ステータス ユーティリティ.
///////////////////////////////////////////////////////////
(function() {
'use strict'

// frequireが設定されていない場合.
let frequire = global.frequire;
if(frequire == undefined) {
    // frequire利用可能に設定.
    require("../../freqreg.js");
    frequire = global.frequire;
}

// 基本HTTPステータス情報.
const HTTP_STATUS_TO_MESSAGE = {
    100: "Continue",
    101: "Switching Protocols",
    200: "Ok",
    201: "Created",
    202: "Accepted",
    203: "Non-Authoritative Information",
    204: "No Content",
    205: "Reset Content",
    206: "Partial Content",
    300: "Multiple Choices",
    301: "Moved Permanently",
    302: "Moved Temporarily",
    303: "See Other",
    304: "Not Modified",
    305: "Use Proxy",
    307: "Temporary Redirect",
    308: "Permanent Redirect",
    400: "Bad Request",
    401: "Authorization Required",
    402: "Payment Required",
    403: "Forbidden",
    404: "Not Found",
    405: "Method Not Allowed",
    406: "Not Acceptable",
    407: "Proxy Authentication Required",
    408: "Request Time-out",
    409: "Conflict",
    410: "Gone",
    411: "Length Required",
    412: "Precondition Failed",
    413: "Request Entity Too Large",
    414: "Request-URI Too Large",
    415: "Unsupported Media Type",
    416: "Requested range not satisfiable",
    417: "Expectation Faile",
    500: "Internal Server Error",
    501: "Not Implemented",
    502: "Bad Gateway",
    503: "Service Unavailable",
    504: "Gateway Time-out",
    505: "HTTP Version not supported"
};

// HTTPエラーを生成.
// status HTTPステータスを設定します.
// message HTTPメッセージを設定します.
//         設定しない場合は HTTPステータスメッセージが返却されます.
// 戻り値 Errorオブジェクトが返却されます.
//        Error.status: HTTPステータスが設定されます.
//        Error.message: メッセージが設定されます.
const httpError = function(status, message) {
    // メッセージが設定されていない場合.
    if(message == undefined || message == null) {
        message = toMessage(status);
    } else {
        message = "" + message;
    }
    const err = new Error(message);
    err.status = status;
    err.message = message;
    return err;
}

// HTTPステータスのメッセージを取得.
// status 対象のHTTPステータスを設定します.
// 戻り値: HTTPステータスメッセージが返却されます.
const toMessage = function(status) {
    const ret = HTTP_STATUS_TO_MESSAGE[status|0];
    if(ret == undefined) {
        return "unknown http status message: " + status;
    }
    return ret;
}
    
// HTTPステータスを生成.
// status 初期ステータスを設定します.
// 戻り値: HTTPステータスが返却されます.
const create = function(status) {
    // ステータス.
    let hstate = typeof(status) != "number" ?
        200 : status|0;
    // リダイレクトURL.
    let httpRedirectURL = undefined;

    // オブジェクト返却.
    const ret = {};

    // HTTPステータスをセット.
    // status HTTPステータスを設定します.
    // redirectURL リダイレクト先のURLを設定します.
    // 戻り値: このオブジェクトが返却されます.
    const _setStatus = function(status, redirectURL) {
        if(status != undefined && status != null) {
            const srcStatus = status;
            status = parseInt(status);
            if(isNaN(status)) {
                throw new Error("The set HTTP status " +
                    srcStatus + " is not a number.");
            }
        } else {
            status = 200;
        }
        hstate = status;
        httpRedirectURL =
            (redirectURL == undefined || redirectURL == null) ?
            undefined: redirectURL;
        return ret;
    }

    // HTTPステータスをセット.
    // status HTTPステータスを設定します.
    // 戻り値: このオブジェクトが返却されます.
    ret.setStatus = function(status) {
        return _setStatus(status);
    }

    // リダイレクト先の情報をセット.
    // url リダイレクト先のURLを設定します.
    // status HTTPステータスを設定します.
    // 戻り値: このオブジェクトが返却されます.
    ret.redirect = function(url, status) {
        // ステータスが設定されていない場合.
        if((status|0) == 0) {
            // 301(getでリダイレクト)をセット.
            status = 301;
        }
        return _setStatus(status, url);
    }

    // HTTPステータスを取得.
    // 戻り値: HTTPステータスが返却されます.
    ret.getStatus = function() {
        return hstate;
    }

    // リダイレクト先URLが設定されているか確認.
    // 戻り値: trueの場合、リダイレクトURLが設定されています.
    ret.isRedirect = function() {
        return httpRedirectURL != undefined;
    }

    // リダイレクトURLを取得.
    // 戻り値: リダイレクトURLが返却されます.
    //         undefinedの場合は無効です.
    ret.getRedirectURL = function() {
        return httpRedirectURL;
    }

    // オブジェクト返却.
    return ret;
}

/////////////////////////////////////////////////////
// 外部定義.
/////////////////////////////////////////////////////
exports.create = create;
exports.toMessage = toMessage;
exports.httpError = httpError;

})();

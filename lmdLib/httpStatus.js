///////////////////////////////////////////////////////////
// HTTP ステータス ユーティリティ.
///////////////////////////////////////////////////////////
(function() {
'use strict'

// 基本HTTPステータス情報.
const HTTP_STATUS_TO_MESSAGE = {
    "100": "Continue",
    "101": "Switching Protocols",
    "200": "Ok",
    "201": "Created",
    "202": "Accepted",
    "203": "Non-Authoritative Information",
    "204": "No Content",
    "205": "Reset Content",
    "206": "Partial Content",
    "300": "Multiple Choices",
    "301": "Moved Permanently",
    "302": "Moved Temporarily",
    "303": "See Other",
    "304": "Not Modified",
    "305": "Use Proxy",
    "307": "Temporary Redirect",
    "308": "Permanent Redirect",
    "400": "Bad Request",
    "401": "Authorization Required",
    "402": "Payment Required",
    "403": "Forbidden",
    "404": "Not Found",
    "405": "Method Not Allowed",
    "406": "Not Acceptable",
    "407": "Proxy Authentication Required",
    "408": "Request Time-out",
    "409": "Conflict",
    "410": "Gone",
    "411": "Length Required",
    "412": "Precondition Failed",
    "413": "Request Entity Too Large",
    "414": "Request-URI Too Large",
    "415": "Unsupported Media Type",
    "416": "Requested range not satisfiable",
    "417": "Expectation Faile",
    "500": "Internal Server Error",
    "500": "Not Support Status",
    "501": "Not Implemented",
    "502": "Bad Gateway",
    "503": "Service Unavailable",
    "504": "Gateway Time-out",
    "505": "HTTP Version not supported"
};

// HTTPステータスのメッセージを取得.
// status 対象のHTTPステータスを設定します.
// 戻り値: HTTPステータスメッセージが返却されます.
const statusToMessage = function(status) {
    const ret = HTTP_STATUS_TO_MESSAGE["" + status];
    if(ret == undefined) {
        return "unknown http status message: " + status;
    }
    return ret;
}
    
// HTTPステータスを生成.
// status 初期ステータスを設定します.
// 戻り値: HTTPステータスが返却されます.
const create = function(status) {
    let httpStatus = typeof(status) != "number" ?
        200 : status|0;
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
        httpStatus = status;
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
    // status HTTPステータスを設定します.
    // url リダイレクト先のURLを設定します.
    // 戻り値: このオブジェクトが返却されます.
    ret.redirect = function(status, url) {
        return _setStatus(status, url);
    }

    // HTTPステータスを取得.
    // 戻り値: HTTPステータスが返却されます.
    ret.getStatus = function() {
        return httpStatus;
    }

    // リダイレクト先URLが設定されているか確認.
    // 戻り値: trueの場合、リダイレクトURLが設定されています.
    ret.isRedirect = function() {
        httpRedirectURL != undefined;
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
exports.statusToMessage = statusToMessage;

})();

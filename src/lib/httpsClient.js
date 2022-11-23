///////////////////////////////////////////////////////////
// httpsClient.
///////////////////////////////////////////////////////////
(function() {
'use strict'

// frequireが設定されていない場合.
let frequire = global.frequire;
if(frequire == undefined) {
    // frequire利用可能に設定.
    require("../freqreg.js");
    frequire = global.frequire;
}

// プロトコル.
const PROTOCOL = "https";

// httpsライブラリ.
const https = frequire(PROTOCOL);

// urlParamsを文字列に変換する.
// urlParams 解析されたURLパラメータを設定します.
// 戻り値: 変換された文字列が返却されます.
const convertUrlParams = function(urlParams) {
    if(urlParams == undefined || urlParams == null) {
        return "";
    } else if(typeof(urlParams) == "string") {
        return urlParams;
    }
    const list = [];
    for(let k in urlParams) {
        list[list.length] =
            encodeURIComponent(k) + "=" +
            encodeURIComponent(urlParams[k]);
    }
    list.sort();
    const len = list.length;
    let ret = "";
    for(let i = 0; i < len; i ++) {
        if(i != 0) {
            ret += "&";
        }
        ret += list[i];
    }
    return ret;
}

// path内容をencodeURIComponentする.
// path 対象のパスを設定します.
// 戻り値: encodeURIComponent変換されたパスが返却されます.
const encodeURIToPath = function(path) {
    path = path.trim();
    // パスが空かパス内に "%" すでにURLEncodeしている場合.
    if(path.length == 0 || path.indexOf("%") != -1) {
        // 処理しない.
        return path;
    }
    let n, ret;
    const list = path.split("/");
    const len = list.length;
    ret = "";
    // パスの区切り文字[/]を除外して、
    // パス名だけをURLEncodeする.
    for(let i = 0; i < len; i ++) {
        n = list[i].trim();
        if(n.length == 0) {
            continue;
        }
        n = encodeURIComponent(n);
        if(ret.length == 0) {
            ret = n;
        } else {
            ret = ret + "/" + n;
        }
    }
    return ret;
}

// httpsのURLを生成.
// host [必須]対象のホスト名を設定します.
// path [任意]対象のパス名を設定します.
// port [任意]対象のポート番号を設定します.
// urlParams [任意]urlパラメータを設定します.
const getUrl = function(host, path, port, urlParams) {
    if(path == undefined || path == null) {
        path = "";
    } else if((path = path.trim()).startsWith("/")) {
        path = path.substring(1).trim();
    }
    if(urlParams != undefined && urlParams != null) {
        urlParams = "?" + convertUrlParams(urlParams);
    } else {
        urlParams = "";
    }
    // URLを作成.
    return ((port|0) > 0) ?
        PROTOCOL + "://" + host + ":" + (port|0) + "/" + path + urlParams:
        PROTOCOL + "://" + host + "/" + path + urlParams;
}

// ヘッダ情報のキー文字を小文字変換.
// header 対象のヘッダを設定します.
// 戻り値: 変換されたヘッダ内容が返却されます.
const convertHeaderToLowerKey = function(header) {
    const ret = {}
    for(let k in header) {
        ret[k.trim().toLowerCase()] = header[k];
    }
    return ret;
}

// httpsリクエスト.
// host 対象のホスト名を設定します.
// path 対象のパス名を設定します.
// options その他オプションを設定します.
//  - method(string)
//    HTTPメソッドを設定します.
//    設定しない場合は GET.
//  - header({})
//    HTTPリクエストヘッダ(Object)を設定します.
//  - body(Buffer or String)
//    HTTPリクエストBodyを設定します.
//  - port(number)
//    HTTPS接続先ポート番号を設定します.
//  - urlParams(string or object)
//    urlパラメータを設定します.
//  - response({})
//    レスポンスステータスやレスポンスヘッダが返却されます.
//    response = {
//      status: number,
//      header: object
//    }
// 戻り値: Promise(Buffer)が返却されます.
const request = function(host, path, options) {
    // optionsが存在しない場合.
    if(options == undefined || options == null) {
        options = {};
    }
    // requestメソッドを取得.
    const method = options.method == undefined ?
        "GET" : options.method.toUpperCase();
    // requestヘッダを取得.
    const header = options.header == undefined ?
        [] : convertHeaderToLowerKey(options.header);
    // requestBodyを取得.
    const body = options.body == undefined ?
        undefined : options.body;
    // httpsPortを取得.
    const port = options.port == undefined ?
        "" : options.port;
    // urlパラメータを取得.
    const urlParams = options.urlParams == undefined ?
        undefined : options.urlParams;
    // responseを取得.
    const response = options.response == undefined ?
        undefined : options.response;
    // bodyが存在して、header.content-lengthが存在しない.
    if(body != undefined && header["content-length"] == undefined &&
        header["transfer-encoding"] != "chunked") {
        header["content-length"] = Buffer.byteLength(body);
    }
    // 非同期処理.
    return new Promise((resolve, reject) => {
        // 接続パラメータを作成.
        const params = {
            "method": method,
            "headers": header
        };
        try {
            // request作成.
            const req = https.request(
                getUrl(host, path, port, urlParams), params, (res) => 
            {
                // response処理.
                try {
                    // バイナリ受信.
                    const body = [];
                    res.on("data", (chunk)=>{
                        body.push(chunk);
                    });
                    res.on("end", ()=>{
                        // レスポンス情報を受け付ける.
                        if(response != undefined) {
                            response.status =
                                res.statusCode;
                            response.header =
                                convertHeaderToLowerKey(
                                    res.headers);
                        }
                        resolve(Buffer.concat(body));
                    });
                    res.on("error", reject);
                } catch (err) {
                    reject(err)
                }
            });
            // request処理.
            req.on('error', reject);
            // bodyが存在する場合.
            if(body != undefined) {
                // body送信.
                req.write(body);
            }
            req.end();
        } catch (err) {
            reject(err)
        }
    });
}

/////////////////////////////////////////////////////
// 外部定義.
/////////////////////////////////////////////////////
exports.convertUrlParams = convertUrlParams;
exports.encodeURIToPath = encodeURIToPath;
exports.request = request;

})();
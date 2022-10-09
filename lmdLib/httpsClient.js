///////////////////////////////////////////////////////////
// httpsClient.
///////////////////////////////////////////////////////////
(function() {
'use strict'

// httpsライブラリ.
const https = frequire('https');

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
        [] : options.header;
    // requestBodyを取得.
    const body = options.body == undefined ?
        undefined : options.body;
    // httpsPortを取得.
    const port = options.port == undefined ?
        "" : options.port;
    // responseを取得.
    const response = options.response == undefined ?
        undefined : options.response;
    // bodyが存在して、header.content-lengthが存在しない.
    if(body != undefined && header["content-length"] == undefined) {
        header["content-length"] = Buffer.byteLength(body);
    }
    // 非同期処理.
    return new Promise((resolve, reject) => {
        // 接続パラメータを作成.
        const params = {
            "host": host,
            "path": path,
            "method": method,
            "headers": header
        };
        // ポートが指定されている場合.
        if(typeof(port) == "number") {
            params["port"] = port|0;
        }
        try {
            // request作成.
            const req = https.request(params, (res) => {
                // httpステータスエラーの場合(400以上).
                if(res.statusCode >= 400) {
                    reject(new Error("httpState: " + res.statusCode +
                        " host: " + host +
                        " path: " + path +
                        " port: " + port +
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
                        // レスポンス情報を受け付ける.
                        if(response != undefined) {
                            response.status = res.statusCode;
                            response.header = res.headers;
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
exports.request = request;

})();
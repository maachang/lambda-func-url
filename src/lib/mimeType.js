///////////////////////////////////////////////////////////
// mimeType ユーティリティ.
// AWS Lambdaに対する、最低限の mimeTypeが定義されています.
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

// zlib.
var zlib = frequire('zlib');

// [mimeType]octet-stream.
const OCTET_STREAM = "application/octet-stream";

// [mimeType]form-data.
const FORM_DATA = "application/x-www-form-urlencoded";

// [mimeType]json.
const JSON = "application/json";

// [mimeType]gz.
const GZ = "application/gzip";

// 圧縮対象バイナリ(文字列)長.
const ZCOMP_LENGTH = 1024;

// 最低限のMimeType(拡張子別).
// 性質上あまり大きなコンテンツのMimeType対応は行わない.
// 一方で、普通にWebアプリを扱う上での最低限のものは対応している.
const MIN_MIMETYPE = {
	/** プレーンテキスト. **/
    txt: {type: "text/plain", gz: true}
	/** プレーンテキスト. **/
    ,text: {type: "text/plain", gz: true}
	/** HTML. **/
    ,htm: {type: "text/html", gz: true}
	/** HTML. **/
    ,html: {type: "text/html", gz: true}
	/** XHTML. **/
    ,xhtml: {type: "application/xhtml+xml", gz: true}
	/** XML. **/
    ,xml: {type: "text/xml", gz: true}
    /** JSON. */
    ,json: {type: "application/json", gz: true}
    /** RSS. */
    ,rss: {type: "application/rss+xm", gz: true}
    /** stylesheet. */
    ,css: {type: "text/css", gz: true}
    /** javascript. */
    ,js: {type: "text/javascript", gz: true}
    /** csv. */
    ,csv: {type: "text/csv", gz: true}
    /** gif. */
    ,gif: {type: "image/gif", gz: false}
    /** jpeg. */
    ,jpg: {type: "image/jpeg", gz: false}
    /** jpeg. */
    ,jpeg: {type: "image/jpeg", gz: false}
    /** png. */
    ,png: {type: "image/png", gz: false}
    /** ico. */
    ,ico: {type: "image/vnd.microsoft.icon", gz: false}
}

// 拡張子からMimeTypeを取得.
// extention 拡張子を設定します.
// 戻り値: MimeTypeが返却されます.
//        返却形式は以下の通り.
//        {type: string, gz: boolean}
//          type には mimeTypeが設定されます.
//          gz が trueの場合はgzip圧縮が可能なコンテンツです.
const get = function(extention) {
    return MIN_MIMETYPE[extention];
}

// 対象コンテンツを圧縮する.
// reqHeader httpRequestのhttpHeaderを設定します.
// resHeader httpResponseのhttpHeaderを設定します.
// body 圧縮対象のBodyを設定します.
// 戻り値: promise(body)が返却されます.
const compressToContents = function(reqHeader, resHeader, body) {
    // 情報が存在しない、もしくは一定サイズ以下の場合.
    if(body == null || body == undefined || body.length <= ZCOMP_LENGTH) {
        // 未圧縮.
        return new Promise((resolve) => {
            resolve(body);
        });
    }
    // requestヘッダで、対応圧縮条件を取得.
    let acceptEncoding = reqHeader.get("accept-encoding");
    // accept-encodingが存在する場合.
    if(acceptEncoding != undefined) {
        acceptEncoding = acceptEncoding.toLowerCase();
        // gzip圧縮がサポートされている場合.
        if(acceptEncoding.indexOf("gzip") != -1) {
            return new Promise((resolve, reject) => {
                zlib.gzip(body, function(err, result) {
                    if(err != undefined) {
                        reject(err);
                        return;
                    }
                    resHeader.put("content-encoding", "gzip");
                    resolve(result);
                });
            });
        // deflate圧縮がサポートされている場合.
        } else if(acceptEncoding.indexOf("deflate") != -1) {
            return new Promise((resolve, reject) => {
                zlib.deflate(body, function(err, result) {
                    if(err != undefined) {
                        reject(err);
                        return;
                    }
                    resHeader.put("content-encoding", "deflate");
                    resolve(result);
                });
            });
        }
    } else 
    // 未圧縮.
    return new Promise((resolve) => {
        resolve(body);
    });
}

/////////////////////////////////////////////////////
// 外部定義.
/////////////////////////////////////////////////////
exports.get = get;
exports.compressToContents = compressToContents;
exports.OCTET_STREAM = OCTET_STREAM;
exports.FORM_DATA = FORM_DATA;
exports.JSON = JSON;
exports.GZ = GZ;

})();
//////////////////////////////////////////////////////////
// lambda main.
// 対象のLambdaのindex.jsを置き換えてください.
//////////////////////////////////////////////////////////
(function() {
'use strict'

// lambda main.
exports.handler = async (event, context) => {
    return await (require("./LFUSetup.js").start(
        event, filterFunc, originMime))
        (event, context);
};

// filterFunc.
// function(out, resState, resHeader, request);
//  out [0]にレスポンスBodyが設定されます.
//  resState: レスポンスステータス(httpStatus.js).
//  resHeader レスポンスヘッダ(httpHeader.js)
//  request Httpリクエスト情報.
//  戻り値: true / false.
//         trueの場合filter処理で処理終了となります.
const filterFunc = undefined;

// originMime.
// function(extention);
//  extention ファイルの拡張子を設定します.
//  戻り値: {type:string, gz: boolean}
//    - type: mimeTypeが設定されます.
//    - gz: gzip圧縮可能な場合は true.
const originMime = undefined;

})();

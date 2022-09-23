//////////////////////////////////////////////////////////
// JSON-BinaryI/O用オブジェクト.
// 通常のJSONと違って、文字列ではなく「バイナリ化」できる
// ものを、バイナリ変換して本来のJSONのファイルサイズを
// 減らします.
//////////////////////////////////////////////////////////
(function() {
'use strict'

// エンコード処理.
// value 変換対象のvalueを設定します.
const encode = function(value) {
    // バイナリを格納するArrayオブジェクトを生成.
    const bin = [];
    // エンコード処理.
    return exrequire("storage/convb.js")
    .then((result) => {
        // 変換結果をUint8Arrayに変換.
        return Uint8Array.from(
            result.encodeValue(bin, value)
        );
    });
}

// デコード処理.
// bin バイナリを設定します.
// 戻り値: 変換結果が返却されます.
const decode = function(bin) {
    // ポジションを取得.
    const pos = [0];
    // デコード処理.
    return exrequire("storage/convb.js")
    .then((result) => {
        return result.decodeValue(pos, bin);
    });
}

/////////////////////////////////////////////////////
// 外部定義.
/////////////////////////////////////////////////////
exports.encode = encode;
exports.decode = decode;

})();
    
//////////////////////////////////////////////////////////
// JSON-BinaryI/O用オブジェクト.
// 通常のJSONと違って、文字列ではなく「バイナリ化」できる
// ものを、バイナリ変換して本来のJSONのファイルサイズを
// 減らします.
//////////////////////////////////////////////////////////
(function() {
'use strict'

// frequireが設定されていない場合.
let frequire = global.frequire;
if(frequire == undefined) {
    // frequire利用可能に設定.
    require("../../freqreg.js");
    frequire = global.frequire;
}

// convert-binary.
const convb = frequire("./lib/storage/convb.js");

// エンコード処理.
// value 変換対象のvalueを設定します.
// 戻り値 Buffer情報が返却されます.
const encode = function(value) {
    // バイナリを格納するArrayオブジェクトを生成.
    const bin = [];
    convb.encodeValue(bin, value);
    return Buffer.from(bin);
}

// デコード処理.
// bin バイナリを設定します.
// 戻り値: 変換結果が返却されます.
const decode = function(bin) {
    // ポジションを取得.
    const pos = [0];
    return convb.decodeValue(pos, bin);
}

/////////////////////////////////////////////////////
// 外部定義.
/////////////////////////////////////////////////////
exports.encode = encode;
exports.decode = decode;

})();
    
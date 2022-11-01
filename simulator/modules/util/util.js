////////////////////////////////////////////////
// ユーティリティ.
////////////////////////////////////////////////
(function(_g) {
'use strict';

// 指定文字内に環境変数がある場合は変換.
// value 対象の文字列を設定します.
//       環境変数の解釈をする場合は以下のように行います.
//       "${環境変数名}"
//       また対象の`環境変数名`が存在しない場合は変換されません.
// 戻り値: 変換された結果が返却されます.
const changeEnv = function(value) {
    if(value.indexOf("${") == -1) {
        return value;
    }
    let p;
    const list = process.env;
    for(let k in list) {
        p = value.indexOf("${" + k + "}");
        if(p != -1) {
            value = value.substring(0, p) +
                list[k] + value.substring(p + k.length + 3);
        }
    }
    return value;
}
exports.changeEnv = changeEnv;

// getEnv処理.
// name ENV名を設定します.
// 戻り値: Env要素が返却されます.
const getEnv = function(name) {
    const value = process.env[name];
    if(typeof(value) == "string") {
        return changeEnv(value);
    }
    return undefined;
}
exports.getEnv = getEnv;

})(global);
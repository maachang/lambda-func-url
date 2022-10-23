////////////////////////////////////////////////
// nodejs 起動パラメータ解釈.
////////////////////////////////////////////////
(function(_g) {
'use strict';

const nums = require("./util/nums.js");

// 初期処理.
const init = function() {
    const list = process.argv;
    const pms = [];
    const len = list.length;
    for(var i = 1; i < len; i++) {
        pms[i] = list[i];
    }
    return pms;
}

// 今回のパラメータと元パラメータのConcat処理.
// paramsAndSrcParamsConcat(
//     params0, params1, ... srcParams(array))
// - params0, params1, ... 追加パラメータを設定します.
// - srcParams(array) 呼び出し元パラメータを設定します.
const paramsAndSrcParamsConcat = function() {
    let i;
    let len = arguments.length - 1;
    const ret = [];
    // params0, params1, ...
    for(i = 0; i < len; i ++) {
        ret[ret.length] = arguments[i];
    }
    // srcParams(last).
    const array = arguments[len];
    len = array.length;
    for(i = 0; i < len; i ++) {
        ret[ret.length] = array[i];
    }
}

// 起動パラメータ情報をセット.
const args = init();

// 戻り値.
const o = {};

// 指定ヘッダ名を設定して、要素を取得します.
// names 対象のヘッダ名を設定します.
// 戻り値: 文字列が返却されます.
o.get = function() {
    if(arguments == null) {
        return null;
    }
    return o.next.apply(null,
        paramsAndSrcParamsConcat(0, arguments));
}

// 番号指定での指定ヘッダ名を指定した要素取得処理.
//
// たとえば
// > -i abc -i def -i xyz
//
// このような情報が定義されてる場合にたとえば
// next(0, "-i") なら "abc" が返却され
// next(1, "-i") なら "def" が返却されます.
//
// no 取得番目番号を設定します.
// names 対象のヘッダ名を設定します.
// 戻り値: 文字列が返却されます.
o.next = function() {
    if(arguments == null) {
        return null;
    }
    const no = arguments[0];
    const len = arguments.length - 1;
    if(len == 1 && nums.isNumeric(arguments[1])) {
        const pos = arguments[1]|0;
        if(pos >= 0 && pos < args.length) {
            return args[pos];
        }
        return null;
    }
    let i, j;
    let cnt = 0;
    const lenJ = args.length - 1;
    for(i = 0; i < len; i ++) {
        for (j = 0; j < lenJ; j++) {
            if (arguments[i + 1] == args[j]) {
                if(no <= cnt) {
                    return args[j + 1];
                }
                cnt ++;
            }
        }
    }
    return null;
}

// 指定起動パラメータ名を指定して、存在するかチェックします.
// names 対象のヘッダ名を設定します.
// 戻り値: 存在する場合 true.
o.isValue = function() {
    if(arguments == null) {
        return false;
    }
    let i, j, no;
    const len = arguments.length;
    const lenJ = args.length;
    for(i = 0; i < len; i ++) {
        if(nums.isNumeric(arguments[i])) {
            no = arguments[i]|0;
            if(no >= 0 && no < args.length) {
                return true;
            }
        } else {
            for (j = 0; j < lenJ; j++) {
                if (arguments[i] == args[j]) {
                    return true;
                }
            }
        }
    }
    return false;
}

// 最初の起動パラメータを取得.
// 戻り値 最初の起動パラメータが返却されます.
o.getFirst = function() {
    if(args.length == 0) {
        return "";
    }
    return args[0];
}

// 最後の起動パラメータを取得.
// 戻り値 最後の起動パラメータが返却されます.
o.getLast = function() {
    if(args.length == 0) {
        return "";
    }
    return args[args.length - 1];
}

// 起動パラメータ数を取得.
// 戻り値: 起動パラメータ数が返却されます.
o.length = function() {
    return args.length;
}

/////////////////////////////////////////////////////
// 外部定義.
/////////////////////////////////////////////////////
for(let k in o) {
    exports[k] = o[k];
}

})(global);
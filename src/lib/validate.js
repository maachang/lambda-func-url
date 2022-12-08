///////////////////////////////////////////////////////////
// validate処理.
// HTTPのGETやPOSTのパラメータのvalidate処理を行う.
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

// タイプコード.
const TYPE = {
    "none": 0,
    "string": 1,
    "number": 2,
    "float": 3,
    "boolean": 4,
    "date": 5
};

// 数値のみの場合.
// value 対象の条件を設定します.
// 戻り値: 数字の場合はtrue返却.
const isNumber = function(value) {
    return !isNaN(parseInt(value));
}

// 整数変換を行う.
// value 対象の条件を設定します.
// 戻り値: 変換された整数が返却されます.
const convertInt = function(value) {
    const ret = parseInt(value);
    if(isNaN(ret)) {
        throw new Error(
            "Integer conversion failed: " + value);
    }
    return ret;
}

// 浮動小数点変換を行う.
// value 対象の条件を設定します.
// 戻り値: 変換された浮動小数点が返却されます.
const convertFloat = function(value) {
    const ret = parseFloat(value);
    if(isNaN(ret)) {
        throw new Error(
            "Float conversion failed: " + value);
    }
    return ret;
}

// valueをtype条件に従って変換.
// type 対象のtype条件を設定します.
// value 変換対象のvalueを設定します.
// 戻り値: 変換結果が返却されます.
const conertValue = function(type, value) {
    // valueを文字列変換.
    value = (value == null || value == undefined) ?
        "" : "" + value;
    // 指定タイプを取得.
    const typeNum = TYPE[type.toLowerCase()];
    if(typeNum == undefined || typeNum == 0) {
        // タイプが対象外 or none の場合.
        return value;
    }
    // それぞれのタイプ変換.
    switch(typeNum) {
        case 1: return value;
        case 2: return convertInt(value);
        case 3: return convertFloat(value);
        case 4: return value.toLowerCase() == "true";
        case 5: if(isNumber(value)) {
            return new Date(parseInt(value));
        } else {
            return new Date(value);
        }
    }
    // それ以外の該当しない条件の場合はエラー.
    throw new Error(
        "Specified conversion type (" +
        type + ") does not match.");
}

// クォーテーションカット.
// 対象の文字列を設定します.
// クォーテーションがカットされた内容が返却されます.
const cutQuotation = function(n) {
    return ((n[0] == "\"" && n[n.length - 1] == "\"") ||
        (n[0] == "\'" && n[n.length-1] == "\'")) ?
        n.substring(1 ,n.length - 1).trim() : n;
}

// 正規表現: URLチェック.
const r_url =
    new RegExp("https?://[\\w/:%#\\$&\\?\\(\\)~\\.=\\+\\-]+");
// 正規表現: emailチェック.
const r_email =
    new RegExp("\\w{1,}[@][\\w\\-]{1,}([.]([\\w\\-]{1,})){1,3}$");
// 正規表現: date(yyyy/MM/dd)チェック.
const r_date =
    new RegExp("^\\d{2,4}\\/([1][0-2]|[0][1-9]|[1-9])\\/([3][0-1]|[1-2][0-9]|[0][1-9]|[1-9])$");
// 正規表現: Time(HH:mm)チェック.
const r_time =
    new RegExp("^([0-1][0-9]|[2][0-3]|[0-9])\\:([0-5][0-9]|[0-9])$");

// [validate]デフォルト定義.
const v_default = function(value, type) {
    if(value == null || value == undefined) {
        let ret = null;
        // 空のデフォルト値.
        switch(type) {
        case 1: ret = ""; break;
        case 2: ret = 0; break;
        case 3: ret = 0.0; break;
        case 4: ret = false; break;
        case 5: ret = new Date(0); break;
        }
        return ret;
    }
    return value;
}

// [validate]存在確認.
const v_required = function(value) {
    return value != null && value != undefined || value == "";
}

// [validate]min.
const v_min = function(value, type, len) {
    len = len|0;
    switch(type) {
        case 1: return v_required(value) && (""+value).length >= len;
        case 2: case 3: return v_required(value) && value >= len;
    }
    return false;
}

// [validate]max.
const v_max = function(value, type, len) {
    len = len|0;
    switch(type) {
        case 1: return v_required(value) && (""+value).length <= len;
        case 2: case 3: return v_required(value) && value <= len;
    }
    return false;
}

// [validate]range.
const v_range = function(value, type, start, end) {
    start = start|0;
    end = end|0;
    if(v_required(value)) {
        if(type == 1) {
            value = (""+value).length;
        } else if(typt != 2 && type != 3) {
            return false;
        }
        return value >= start && value <= end;
    }
    return false;
}

// [validate]正規表現.
const v_regex = function(value, type, reg) {
    if(!(reg instanceof RegExp)) {
      reg = new RegExp(""+reg);
    }
    if(type == 1) {
      return v_required(value) && (reg.test(""+value));
    }
    return false;
}

// [validate]url正規表現.
const v_url = function(value, type) {
    return v_regex(value, type, r_url);
}

// [validate]email正規表現.
const v_email = function(value, type) {
    return v_regex(value, type, r_email);
}

// [validate]date正規表現.
const v_date = function(value, type) {
    return v_regex(value, type, r_date);
}

// [validate]time正規表現.
const v_time = function(value, type) {
    return v_regex(value, type, r_time);
}


  
  


// validate定義.
// 以下のような感じで定義します.
//
// const validate = frequire("./lib/validate.js");
// validate.define(
//     "name",          "string", "req",        // name文字パラメータで、必須情報.
//     "age",           "number", "default 18", // age数値パラメータ.
//     "lat",           "float",  "default 0.0",// 経度浮動小数点パラメータ.
//     "comment",       "string", "max 128"    // comment文字パラメータで、最大文字が128文字.
// );
//
// arguemnts 設定条件が設定されます.
// 戻り値: validate定義内容が返却されます.
//        ${戻り値}.check(request.params);
//        このような形で定義する事で、validateチェックが行なえます.
const define = function() {


}



})();
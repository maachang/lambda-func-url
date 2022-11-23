////////////////////////////////////////////////
// タイプ変換.
////////////////////////////////////////////////
(function(_g) {
'use strict';

const nums = require("./nums.js");

// 数字変換.
const toInt = function(n) {
    if(n) {
        try {
            n = parseInt(n);
        } catch(e) {
            n = null;
        }
    } else {
        n = null;
    }
    return n;
}

// 小数点変換.
const toFloat = function(n) {
    if(n) {
        try {
            n = parseFloat(n);
        } catch(e) {
            n = null;
        }
    } else {
        n = null;
    }
    return n;
}

// boolean変換.
const toBool = function(n) {
    if(n) {
        try {
            if(n == "true" || n == "t" || n == "on") n = true;
            else if(n == "false" || n == "f" || n == "off") n = false;
        } catch(e) {
            n = null;
        }
    } else {
        n = null;
    }
    return n;
}

// Date変換.
const toDate = function(n) {
    if(n) {
        try {
            if(nums.isNumeric(n)) {
                n = new Date(parseInt(n));
            } else {
                n = new Date(n);
            }
        } catch(e) {
            n = null;
        }
    } else {
        n = null;
    }
    return n;
}

/////////////////////////////////////////////////////
// 外部定義.
/////////////////////////////////////////////////////
exports.toInt = toInt;
exports.toFloat = toFloat;
exports.toBool = toBool;
exports.toDate = toDate;

// type変換.
//    [string, str] 文字列で返却します.
//    [number, num, float, double] 浮動小数点で返却します.
//    [int, integer, long] 整数で返却します.
//    [boolean, bool] boolean型で返却します.
//    [date, datetime, timestamp] Dateオブジェクトで返却します.
//    何も設定しない、該当しない場合は[string]で返却されます.
exports.convert = function(type, value) {
    // 何もしない.
    if(type == null || type == undefined) {
        return value;
    }
    type = ("" + type).toLowerCase();
    if(type == "num" || type == "number" || type == "float" || type == "double") {
        return toFloat(value);
    } else if(type == "int" || type == "integer" || type == "long") {
        return toInt(value);
    } else if(type == "boolean" || type == "bool") {
        return toBool(value);
    } else if(type == "date" || type == "datetime" || type == "timestamp") {
        return toDate(value);
    } else if(type == "string") {
        return value + "";
    }
    return value;
}

})(global);
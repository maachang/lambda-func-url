///////////////////////////////////////////////////////////
// HTTP ヘッダ ユーティリティ.
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

// cookie内容 "key=value" をパース.
// out {"key": "value"} がセットされます.
// value "key=value" のような条件を設定します.
const parseCookie = function(out, value) {
    const p = value.indexOf("=");
    if(p == -1) {
        out[value] = true;
    } else {
        out[value.substring(0, p)] = value.substring(p + 1);
    }
}

// HTTPヘッダを生成.
// headers 元のHTTPヘッダを設定します.
// cookies cookiesを設定します.
//         ["key=value", "key=value"]がセットされます.
// 戻り値: HttpHeaderオブジェクトが返却されます.
const create = function(headers, cookies) {
    // ヘッダリストを設定.
    const headList = {};
    if(headers != undefined && headers != null) {
        for(let k in headers) {
            // key小文字変換.
            headList[k.trim().toLowerCase()] = headers[k];
        }
    }

    // クッキーリストを設定.
    const cookieList = {};
    if(cookies != undefined && cookies != null) {
        const len = cookies.length;
        for(let i = 0; i < len; i ++) {
            parseCookie(cookieList,
                decodeURIComponent(cookies[i]));
        }
    }

    // 返却条件.
    const ret = {};

    // ヘッダ情報を取得.
    // key key名を設定します.
    // 戻り値: valueが返却されます.
    ret.get = function(key) {
        return headList[key.trim().toLowerCase()];
    }

    // ヘッダ情報をセット.
    // key key名を設定します.
    // value value条件を設定します.
    // 戻り値: このオブジェクトが返却されます.
    ret.put = function(key, value) {
        headList[key.trim().toLowerCase()] = value;
        return ret;
    }

    // コンテンツタイプを取得.
    // 戻り値: コンテンツタイプ(mimeType)が返却されます.
    ret.getContentType = function() {
        return headList["content-type"];
    }

    // コンテンツタイプを設定.
    // mime mimeTypeを設定します.
    // 戻り値: このオブジェクトが返却されます.
    ret.setContentType = function(mime) {
        headList["content-type"] = mime;
        return ret;
    }

    // ヘッダ情報を削除.
    // key key名を設定します.
    ret.remove = function(key) {
        delete headList[key];
    }

    // キー一覧を取得.
    // 戻り値: キー一覧が返却されます.
    ret.getKeys = function() {
        let cnt = 0;
        const ret = [];
        for(var k in headList) {
            ret[cnt ++] = k;
        }
        return ret;
    }

    // cookie情報を取得.
    // key 対象のキー名を設定します.
    // 戻り値: cookie情報が返却されます.
    //          {value: value, "Max-Age": 2592000, Secure: true}
    //        のような感じで返却されます.
    ret.getCookie = function(key) {
        return cookieList[
            ("" + key).trim().toLowerCase()];
    }

    // cookie情報を設定.
    // key 対象のキー名を設定します.
    // value 対象のvalueを設定します.
    //         value="value; Max-Age=2592000; Secure;"
    //         ※必ず先頭文字は "value;" 必須.
    //         や
    //         value={value: value, "Max-Age": 2592000, Secure: true}
    //       のような感じで設定します.
    // 戻り値: trueの場合正常に追加されました.
    ret.putCookie = function(key, value) {
        key = ("" + key).trim().toLowerCase();
        const v = {};
        // 文字の場合.
        if(typeof(value) == "string") {
            // 文字列から {} に変換.
            let n;
            const list = value.split(";");
            const len = list.length;
            for(let i = 0; i < len; i ++) {
                n = list[i].trim();
                if(i == 0) {
                    v.value = n;
                } else {
                    parseCookie(v, n);
                }
            }
        // objectの場合.
        } else {
            // objectの変換.
            for(let k in value) {
                // Date => String変換.
                if(value[k] instanceof Date) {
                    v[k] = value[k].toUTCString();
                } else {
                    v[k] = value[k];
                }
            }
        }
        cookieList[key] = v;
        return true;
    }

    // cookie情報を削除.
    // key 対象のキー名を設定します.
    ret.removeCookie = function(key) {
        delete cookieList[("" + key).trim().toLowerCase()];
    }

    // cookie一覧を取得.
    // 戻り値: cookie一覧が返却されます.
    ret.getCookieKeys = function() {
        let cnt = 0;
        const ret = [];
        for(var k in cookieList) {
            ret[cnt ++] = k;
        }
        return ret;
    }

    // 登録されたCookie情報をレスポンス用headerに設定.
    // 戻り値: cookieリストが返却されます.
    ret.toCookies = function() {
        // "cookies": [....];
        const cookies = [];
        let em, value, len, sameSite;
        len = 0; sameSite = false;
        for(let k in cookieList) {
            em = cookieList[k];
            // 最初の条件は key=value条件.
            value = encodeURIComponent(k) +
                "=" + encodeURIComponent(em.value);
            for(let n in em) {
                // valueのkey名は設定済みなので飛ばす.
                if(n == "value") {
                    continue;
                } else if(n == "samesite") {
                    sameSite = true;
                // 単一設定[Secureなど].
                } else if(em[n] == true) {
                    value += "; " + encodeURIComponent(n);
                // key=value.
                } else {
                    value += "; " + encodeURIComponent(n) +
                        "=" +  encodeURIComponent(em[n]);
                }
            }
            // samesiteが設定されていない場合.
            // samesite=laxを設定.
            if(!sameSite) {
                value += "; samesite=lax";
            }
            cookies[cookies.length] = value;
            len ++;
        }
        return cookies;
    }

    // Header群情報(Object)を取得.
    // 戻り値: Header群情報(Object)が返却されます.
    ret.toHeaders = function() {
        // ヘッダ内容を作成.
        const ret = {};
        for(let k in headList) {
            ret[k] = headList[k];
        }
        return ret;
    }

    return ret;
}

/////////////////////////////////////////////////////
// 外部定義.
/////////////////////////////////////////////////////
exports.create = create;

})();
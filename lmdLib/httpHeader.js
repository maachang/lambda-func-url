///////////////////////////////////////////////////////////
// HTTP ステータス ユーティリティ.
///////////////////////////////////////////////////////////
(function() {
'use strict'

// HTTPヘッダを生成.
// headers 元のHTTPヘッダを設定します.
// 戻り値: HttpHeaderオブジェクトが返却されます.
const create = function(headers) {
    const head = {};
    if(headers != undefined || headers != null) {
        for(let k in headers) {
            head[k.trim().toLowerCase()] = headers[k];
        }
    }
    // 返却条件.
    const ret = {};

    // ヘッダ情報を取得.
    // key key名を設定します.
    // 戻り値: valueが返却されます.
    ret.get = function(key) {
        return head[key.trim().toLowerCase()];
    }

    // ヘッダ情報にセット.
    // key key名を設定します.
    // value value条件を設定します.
    // 戻り値: このオブジェクトが返却されます.
    ret.put = function(key, value) {
        head[key.trim().toLowerCase()] = value;
        return ret;
    }

    // キー一覧を取得.
    // 戻り値: キー一覧が返却されます.
    ret.getKeys = function() {
        let cnt = 0;
        const ret = [];
        for(var k in head) {
            ret[cnt ++] = k;
        }
        return ret;
    }

    // Header群情報(Object)を取得.
    // 戻り値: Header群情報(Object)が返却されます.
    ret.toHeaders = function() {
        return head;
    }
    
    return ret;
}

/////////////////////////////////////////////////////
// 外部定義.
/////////////////////////////////////////////////////
exports.create = create;

})();
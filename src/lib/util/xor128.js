//////////////////////////////////////////
// xor128.
//////////////////////////////////////////
(function() {
'use strict'

// xor128演算乱数装置.
exports.create = function(seet) {
    const v = {
        a:123456789,b:362436069,c:521288629,d:88675123
    };
    // シートセット.
    const setSeet = function(s) {
        if (typeof(s) == "number") {
            s = s|0;
            v.a=s=1812433253*(s^(s>>30))+1;
            v.b=s=1812433253*(s^(s>>30))+2;
            v.c=s=1812433253*(s^(s>>30))+3;
            v.d=s=1812433253*(s^(s>>30))+4;
        }
    }
    // 乱数取得.
    const next = function() {
        let t = v.a;
        let r = t;
        t = (t << 11);
        t = (t ^ r);
        r = t;
        r = (r >> 8);
        t = (t ^ r);
        r = v.b;
        v.a = r;
        r = v.c;
        v.b = r;
        r = v.d;
        v.c = r;
        t = (t ^ r);
        r = (r >> 19);
        r = (r ^ t);
        v.d = r;
        return r;
    }
    // Byteリストの乱数を生成.
    const outByteList = function(out, cnt, len) {
        let n, i;
        const len4 = len >> 2;
        const lenEtc = len & 0x03;
        for(i = 0; i < len4; i ++) {
            n = next();
            out[cnt ++] = n & 0x0ff;
            out[cnt ++] = (n & 0x0ff00) >> 8;
            out[cnt ++] = (n & 0x0ff0000) >> 16;
            out[cnt ++] = ((n & 0xff000000) >> 24) & 0x0ff;
        }
        for(i = 0; i < lenEtc; i ++) {
            out[cnt ++] = next() & 0x0ff;
        }
    }
    // ランダムバイナリを指定数取得.
    const getBytes = function(len) {
        const ret = Buffer.alloc(len);
        outByteList(ret, 0, len);
        return ret;
    }
    // ランダムバイナリをout(Array)に格納.
    const getArray = function(out, len) {
        outByteList(out, out.length, len);
    }
    setSeet(seet);
    return {
        setSeet: setSeet,
        next: next,
        getBytes: getBytes,
        getArray: getArray
    }
};

})();
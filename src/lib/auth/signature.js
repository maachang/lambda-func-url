//////////////////////////////////////////
// ログイン用のシグニチャーを作成.
//////////////////////////////////////////
(function(_g) {
'use strict'

// convb.
const convb = require("../storage/convb.js");

// xor128演算乱数装置.
const xor128 = function(seet) {
    const v = {a:123456789,b:362436069,c:521288629,d:88675123};
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
        let t=v.a;
        let r=t;
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
    // ランダムバイナリを指定数取得.
    const getBytes = function(len) {
        const ret = Buffer.alloc(len);
        for(let i = 0; i < len; i ++) {
            ret[i] = next() & 0x0ff;
        }
        return ret;
    }
    setSeet(seet);
    return {
        setSeet: setSeet,
        next: next,
        getBytes: getBytes
    }
};

// 初期乱数.
const _RAND = xor128(
    Date.now() + process.hrtime()[0] + process.hrtime()[1]);

// 乱数キー数.
const _RAND_LENGTH = 16;

// フリップ.
// 主にencode系で利用します.
// code 1byte情報を設定.
// step stepCode(1byte)を設定.
// 戻り値: 1byte情報が返却されます.
const _flip = function(code, step) {
    switch (step & 0x00000007) {
    case 1:
        return ((((code & 0x00000003) << 6) & 0x000000c0) | (((code & 0x000000fc) >> 2) & 0x0000003f)) & 0x000000ff;
    case 2:
        return ((((code & 0x0000003f) << 2) & 0x000000fc) | (((code & 0x000000c0) >> 6) & 0x00000003)) & 0x000000ff;
    case 3:
        return ((((code & 0x00000001) << 7) & 0x00000080) | (((code & 0x000000fe) >> 1) & 0x0000007f)) & 0x000000ff;
    case 4:
        return ((((code & 0x0000000f) << 4) & 0x000000f0) | (((code & 0x000000f0) >> 4) & 0x0000000f)) & 0x000000ff;
    case 5:
        return ((((code & 0x0000007f) << 1) & 0x000000fe) | (((code & 0x00000080) >> 7) & 0x00000001)) & 0x000000ff;
    case 6:
        return ((((code & 0x00000007) << 5) & 0x000000e0) | (((code & 0x000000f8) >> 3) & 0x0000001f)) & 0x000000ff;
    case 7:
        return ((((code & 0x0000001f) << 3) & 0x000000f8) | (((code & 0x000000e0) >> 5) & 0x00000007)) & 0x000000ff;
    }
    return code & 0x000000ff;
}

// notフリップ.
// 主にdecode系で利用します.
// code 1byte情報を設定.
// step stepCode(1byte)を設定.
// 戻り値: 1byte情報が返却されます.
const _nflip = function(code, step) {
    switch (step & 0x00000007) {
    case 1:
        return ((((code & 0x0000003f) << 2) & 0x000000fc) | (((code & 0x000000c0) >> 6) & 0x00000003)) & 0x000000ff;
    case 2:
        return ((((code & 0x00000003) << 6) & 0x000000c0) | (((code & 0x000000fc) >> 2) & 0x0000003f)) & 0x000000ff;
    case 3:
        return ((((code & 0x0000007f) << 1) & 0x000000fe) | (((code & 0x00000080) >> 7) & 0x00000001)) & 0x000000ff;
    case 4:
        return ((((code & 0x0000000f) << 4) & 0x000000f0) | (((code & 0x000000f0) >> 4) & 0x0000000f)) & 0x000000ff;
    case 5:
        return ((((code & 0x00000001) << 7) & 0x00000080) | (((code & 0x000000fe) >> 1) & 0x0000007f)) & 0x000000ff;
    case 6:
        return ((((code & 0x0000001f) << 3) & 0x000000f8) | (((code & 0x000000e0) >> 5) & 0x00000007)) & 0x000000ff;
    case 7:
        return ((((code & 0x00000007) << 5) & 0x000000e0) | (((code & 0x000000f8) >> 3) & 0x0000001f)) & 0x000000ff;
    }
    return code & 0x000000ff;
}

// ハッシュ計算.
// code 対象条件(文字列 or バイナリ)を設定します.
// 戻り値: 16byteのバイナリが返却されます.
const hash = function(code) {
    let o = null;
    const n = [0x8F1BBCDC, 0x5A827999, 0xCA62C1D6, 0x6ED9EBA];
    if(typeof(code) == "string") {
        code = Buffer.from(code);
    }
    const len = code.length;
    for(let i = 0; i < len; i ++) {
        o = (code[i] & 0x000000ff);
        if((o & 1) == 1) {
            o = _flip(o, o);
        } else {
            o = _nflip(o, o);
        }
        if((i & 1) == 1) {
            n[0] = n[0] + o;
            n[1] = n[1] - (o << 8);
            n[2] = n[2] + (o << 16);
            n[3] = n[3] - (o << 24);
            n[3] = n[3] ^ (o);
            n[2] = n[2] ^ (o << 8);
            n[1] = n[1] ^ (o << 16);
            n[0] = n[0] ^ (o << 24);
            n[0] = (n[3]+1) + (n[0]);
            n[1] = (n[2]-1) + (n[1]);
            n[2] = (n[1]+1) + (n[2]);
            n[3] = (n[0]-1) + (n[3]);
        } else {
            n[3] = n[3] + o;
            n[2] = n[2] - (o << 8);
            n[1] = n[1] + (o << 16);
            n[0] = n[0] - (o << 24);
            n[0] = n[0] ^ (o);
            n[1] = n[1] ^ (o << 8);
            n[2] = n[2] ^ (o << 16);
            n[3] = n[3] ^ (o << 24);
            n[0] = (n[3]+1) - (n[0]);
            n[1] = (n[2]-1) - (n[1]);
            n[2] = (n[1]+1) - (n[2]);
            n[3] = (n[0]-1) - (n[3]);
        }
        n[3] = (n[0]+1) ^ (~n[3]);
        n[2] = (n[1]-1) ^ (~n[2]);
        n[1] = (n[2]+1) ^ (~n[1]);
        n[0] = (n[3]-1) ^ (~n[0]);
    }
    // バイナリで返却.
    return [
        (n[0] & 0x000000ff),
        ((n[0] & 0x0000ff00) >> 8),
        ((n[0] & 0x00ff0000) >> 16),
        (((n[0] & 0xff000000) >> 24) & 0x00ff),
        (n[1] & 0x000000ff),
        ((n[1] & 0x0000ff00) >> 8),
        ((n[1] & 0x00ff0000) >> 16),
        (((n[1] & 0xff000000) >> 24) & 0x00ff),  
        (n[2] & 0x000000ff),
        ((n[2] & 0x0000ff00) >> 8),
        ((n[2] & 0x00ff0000) >> 16),
        (((n[2] & 0xff000000) >> 24) & 0x00ff),  
        (n[3] & 0x000000ff),
        ((n[3] & 0x0000ff00) >> 8),
        ((n[3] & 0x00ff0000) >> 16),
        (((n[3] & 0xff000000) >> 24) & 0x00ff)
    ]
}
exports.hash = hash;

// 配列コピー.
// s 元の配列を設定します.
// sp 元の配列オフセット値を設定します.
// d 先の配列を設定します.
// dp 先の配列オフセット値を設定します.
// len コピー長を設定します.
const arraycopy = function(s, sp, d, dp, len) {
    len = len|0;
    sp = sp|0;
    dp = dp|0;
    for(let i = 0 ; i < len ; i ++) {
        d[(dp+i)] = s[(sp+i)];
    }
}

// base64の最後の=を削除.
// code 対象のbase64文字列を設定.
// 戻り値 最後の=を除いた値が返却.
const cutEndBase64Eq = function(code) {
    const len = code.length;
    for(let i = len - 1; i >= 0; i --) {
        if(code[i] != "=") {
            return code.substring(0, i + 1);
        }
    }
    return "";
}

// パスワードをHash変換(base64).
// password 対象のパスワードを設定します.
// hash化されたBase64変換されます.
const toPasswordHash = function(password) {
    return cutEndBase64Eq(Buffer.from(hash(password)).toString("base64"));
}
exports.toPasswordHash = toPasswordHash;

// outのバイナリ情報にvalue内容を追加.
// out 格納先のバイナリを設定します.
// value 追加対象のバイナリを設定します.
const addValue = function(out, value) {
    let p = out.length;
    const len = value.length;
    for(let i = 0; i < len; i ++) {
        out[p + i] = value[i];
    }
}

// 指定キーの項番を指定して、条件に応じたバイナリを返却.
// key 対象のキーを設定します.
// len 対象のキー長を設定します.
// no 対象の項番を設定します.
//    この値がlenを超えた場合は折り返します.
// 戻り値: 指定位置のバイナリを設定します.
const getKey = function(key, len, no) {
    return key[no % len];
}

// 対象のoutに対してkeyをエンコード.
// out エンコード元の情報を設定します.
// off エンコード元のオフセット値を設定します.
// key エンコード対象のキーを設定します.
const encodeValue = function(out, off, key) {
    const keyLen = key.length;
    const len = out.length;
    for(let i = off; i < len; i ++) {
        if(i & 1 == 0) {
            out[i] = (out[i] ^ _nflip(getKey(key, keyLen, i))) & 0x0ff;
        } else {
            out[i] = (out[i] ^ _flip(getKey(key, keyLen, i))) & 0x0ff;
        }
    }
}

// 対象のbinaryに対してkeyでデコード.
// binary デコード元の情報を設定します.
// off デコード元のオフセット値を設定します.
// len デコード元の長さを設定します.
// key デコード対象のキーを設定します.
const decodeValue = function(binary, off, len, key) {
    const keyLen = key.length;
    for(let i = off; i < len; i ++) {
        if(i & 1 == 0) {
            binary[i] = (binary[i] ^ _flip(getKey(key, keyLen, i))) & 0x0ff;
        } else {
            binary[i] = (binary[i] ^ _nflip(getKey(key, keyLen, i))) & 0x0ff;
        }
    }
}

// ステップコードを取得.
// list 対象のバイナリリストを設定しました.
// off 対象のオフセット値を設定します.
// len 対象の長さを設定します.
// 戻り値: ステップコードが返却されます.
const getStepCode = function(list, off, len) {
    let ret = 0x007f;
    // 先頭はstepCode格納なのでそれ以降で計算.
    for(let i = off; i < len; i ++) {
        if((i & 0x02) == 0) {
            ret += i ^ _flip(list[i], (i * 1.5)|0);
        } else {
            ret -= i ^ _nflip(list[i], (i * 2.5)|0);
        }
    }
    return ret & 0x00ff;
}

// yyyyMMdd-Expoire時間(date)を取得.
// plusDate 対象の加算するDateを設定します.
// 戻り値: 8byteの範囲内条件が返却されます.
const ymdDatePlus = function(plusDate) {
    return Date.now() + (plusDate * 86400000);
}

// エンコード処理.
// keyCode 対象のキー情報を設定します.
// user 対象のユーザ名を設定します.
// password 対象のパスワード(hash化済み+base64)を設定します.
// expire expire値(日付)を設定します.
//        この設定条件が日付の理由はs3の最低削除時間が日付のため、
//        この値に合わせたものになります.
// 戻り値: Buffer情報が返却されます.
const encodeToken = function(keyCode, user, passwordCode, expire) {
    // keyをハッシュ計算する.
    const hashKeyCode = hash(keyCode);
    const list = [0, 0]; // [0]stepCode, [1]keyCodeStepCode.
    // パスワードコード(hash化済み+base64)を設定します.
    convb.encodeString(list, passwordCode);
    // ユーザー名を設定します.
    convb.encodeString(list, user);
    // パスワードとユーザ名をkey変換.
    encodeValue(list, 2, hashKeyCode);
    // expire条件(日時)をセット.
    convb.encodeLong(list, ymdDatePlus(expire|0));
    // ランダムなバイナリを取得.
    const randBin = _RAND.getBytes(_RAND_LENGTH);
    // パスワードとユーザ名と日付をランダム変換.
    encodeValue(list, 2, randBin);
    // 乱数情報をセット.
    addValue(list, randBin);
    // stepCode変換.
    list[1] = getStepCode(hashKeyCode, 0, hashKeyCode.length);
    list[0] = getStepCode(list, 1, list.length);
    // 返却.
    return cutEndBase64Eq(Buffer.from(list).toString("base64"));
}
exports.encodeToken = encodeToken;

// 対象のトークンをデコード処理.
// keyCode 対象のキー情報を設定します.
// token デコード対象のトークンを設定します.
const decodeToken = function(keyCode, token) {
    // base64からBuffer変換.
    token = Buffer.from(token, "base64");

    // トークン長を取得.
    const tokenLen = token.length;

    // キーコードハッシュを取得.
    const keyCodeHash = hash(keyCode);

    // stepコードチェック.
    if(token[0] != getStepCode(token, 1, tokenLen) ||
        token[1] != getStepCode(keyCodeHash, 0, keyCodeHash.length)) {
        // 不一致の場合.
        throw new Error("The contents of the token are invalid.");
    }

    // 乱数を取得.
    let key = Buffer.alloc(_RAND_LENGTH);
    let pos = _RAND_LENGTH;
    arraycopy(token, tokenLen - pos,
        key, 0, _RAND_LENGTH);
    
    // 乱数でデコード.
    decodeValue(token, 2,
        tokenLen - pos, key);
    key = null;
    
    // expire日付を取得
    pos += 8;
    const oPos = [tokenLen - pos];
    const expire = convb.decodeLong(oPos, token);

    // hashKeyCodeでデコード.
    decodeValue(token, 2,
        tokenLen - pos, keyCodeHash);
    
    // パスワードコードを取得.
    oPos[0] = 2;
    let len = convb.decodeStringLength(oPos,token);
    if(len > 128 || len <= 0) {
        throw new Error("The contents of the token are invalid.");
    }
    const passwordCode = convb.decodeString(oPos, token);
    // ユーザー名を取得.
    len = convb.decodeStringLength(oPos,token);
    if(len > 128 || len <= 0) {
        throw new Error("The contents of the token are invalid.");
    }
    const user = convb.decodeString(oPos, token);

    // 戻り値.
    return {
        expire: expire,
        passwordCode: passwordCode,
        user: user
    };
}
exports.decodeToken = decodeToken;

})(global);
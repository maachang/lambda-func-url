// 携帯２段階認証用.
// 携帯電話番号のSMSを使って認証コードを送付して、
// この値を２段階認証として利用します.
//
// この内容を利用する流れの想定として以下の感じです.
//  1. user / passwordでログインを行う.
//  2. 対象ユーザが２段階認証ありの場合は、mfa.jsでコード生成し
//     対象userに紐づく携帯電話番号にSMS送信する.
/// 2.1. ２段階認証画面を表示.
//  2.2. SMSで送った内容が2.1画面で入力される.
//  2.3. ２段階認証確認を行う(mfa.jsで認証コードを作成).
//       戻り値のどれかが一致したら２段階認証を完了とする.
//  3. ログイン完了.
//
// ただ、SMSの場合(AWSだと)物理的に送信毎に従量課金でコストが発生
// (1回$0.07451=10円ぐらい)するので、コストのかからない別の方法
// として、以下の方法を考えます.
// 
// mfa設定前にログイン設定画面で、mfa設定するとqrコードを表示し、
// これを携帯が読み取ると自動登録を行うようにする.
// また二段階認証 `2.1` の画面でQRコードを出して、これを先程登録
// した携帯電話で読み取ると認証コードが表示され、これを入力することで
// 二段階認証できる形を取る.
//
// また、携帯変更などで二段階認証登録を再度やり直したい場合は管理者に
// リセットしてもらう口を作り `2.1` で再登録できる仕組みを提供する
// などで、安全な二段階認証を提供できるようにする.
//
(function() {
'use strict'

// frequireが設定されていない場合.
let frequire = global.frequire;
if(frequire == undefined) {
    // frequire利用可能に設定.
    require("../../freqreg.js");
    frequire = global.frequire;
}

// xor128ランダム.
const xor128 = frequire("./lib/util/xor128.js");

// updateTimeに対する現在時間の値を取得.
// updateTime 認証コードの更新タイミングを秒で指定します.
// 戻り値: 現在時間に対して、一定条件で区切られた現在時間(ミリ秒)が
//        返却されます.
const nowTiming = function(updateTime) {
    updateTime = parseInt(updateTime);
    const ret = parseInt((Date.now() / 1000) / updateTime);
    return ret * updateTime;
}

// user, key1, key2 を計算して64bit数字変換.
// user ユーザー名を設定します.
// key1 固有のkey1条件(たとえばドメイン名)を設定します.
// key2 固有のkey2条件(たとえばMFA先携帯電話番号)を設定します.
// 戻り値: 64bit数字が返却されます.
const userAndKey1AndKey2ToLong = function(user, key1, key2) {
    // user名を元にdomain名の文字コードを
    // xorで処理する(codeに格納).
    let i, len, userLen, cnt;
    userLen = user.length;
    const code = Buffer.alloc(userLen);
    for(i = 0; i < userLen; i++) {
        code[i] += user.charAt(i) & 0x0000ffff;
    }
    // codeにxorで処理するkey1条件を設定.
    cnt = 0;
    len = key1.length;
    for(i = 0; i < len; i++) {
        code[cnt] = (i & 0x01) != 0
            ? (code[cnt] ^ key1.charAt(i)) &
                0x0000ffff
            : (code[cnt] ^ (~key1.charAt(i))) &
            0x0000ffff
        cnt ++;
        if(cnt >= userLen) {
            cnt = 0;
        }
    }
    // 生成識別となるkey2コード(スマホ登録した等の固有コード)
    // (たとえば携帯電話番号)を設定
    cnt = 0;
    len = key2.length;
    for(i = 0; i < len; i++) {
        code[cnt] = (i & 0x01) != 0
            ? (code[cnt] ^ (~key1.charAt(i))) &
            0x0000ffff
            : (code[cnt] ^ key1.charAt(i)) &
            0x0000ffff
        cnt ++;
        if(cnt >= userLen) {
            cnt = 0;
        }
    }
    // codeを合算する.
    // その場のループ数のプラスする形で.
    cnt = 1;
    let ret = userLen;
    for(i = 0; i < userLen; i++) {
        ret += parseInt(code[i]) + (cnt * 3.5);
        cnt ++;
        if(cnt >= 32) {
            cnt = 1;
        }
    }
    return parseInt(ret);
}

// 1つの認証コードを生成.
// mfaLen 認証コード長を設定します.
// time 認証コードのタイミング値を設定します.
// code 認証コード主コードを設定します.
// 戻り値: 認証コードが数字の文字列でmfaLenの長さの内容が返却されます.
const createCode = function(mfaLen, time, code) {
    // 奇数の場合は反転.
    if((time & 0x01) == 1) {
        time = ~time;
    }
    // 奇数の場合は反転.
    if((code & 0x01) == 1) {
        code = ~code;
    }
    // xor128乱数発生装置を利用.
    const r = xor128.create(time);
    // 最大16回乱数生成をループ.
    let i, n, nn, len;
    len = (code - time) & 0x0f;
    for(i = 0; i < len; i ++) {
        r.next();
    }
    // 指定数の数字文字列を生成.
    let ret = "";
    mfaLen = mfaLen & 0x7fffffff;
    if((mfaLen & 0x01) != 0) {
        len = mfaLen - 1;
    } else {
        len = mfaLen;
    }
    // 認証コードを生成(2文字)
    for(i = 0; i < len; i +=2) {
        nn = r.next();
        n = (i & 0x01) == 1 ?
            code - nn : (~code) - nn;
        code = (i & 0x01) == 1 ?
            code + (~nn) : code - nn;
        n = (n & 0x7fffffff);
        ret += "" + ((n % 10)|0);
        ret += "" + (((n / 100) % 10)|0);
    }
    // 残りの認証コード生成が必要な場合.
    if((mfaLen & 0x01) != 0) {
        // 認証コードを生成(1文字)
        ret += "" + (((r.next() & 0x7fffffff) % 10)|0);
    }
    return ret;
}

// ２段階認証コードを生成.
// outNextTime 次の更新時間(ミリ秒)がArray(2)に返却されます.
//             [0] 次の更新時間.
//             [1] 最大更新時間.
// user ユーザー名を設定します.
// key1 固有のkey1条件(たとえばドメイン名)を設定します.
// key2 固有のkey2条件(たとえばMFA先携帯電話番号)を設定します.
// mfaLen 生成するキーコード長を設定します.
// updateTime 生成更新されるタイミング(秒)を設定します.
// 戻り値: 二段階認証コードがArray(3)で返却されます.
//        [0]は、生成更新タイミングより１つ前のコードです.
//        [1]は、生成更新タイミングのコードです.
//        [2]は、生成更新タイミングより１つ後のコードです.
//        通常２段階認証をする場合は[1]を返却します.
const create = function(
    outNextTime, user, key1, key2, mfaLen, updateTime) {
    user = "" + user;
    key1 = "" + key1;
    key2 = "" + key2;
    mfaLen = parseInt(mfaLen)
    updateTime = parseInt(updateTime);
    // 引数チェック.
    if(isNaN(mfaLen) || mfaLen <= 0) {
        throw new Error(
            "The number of number frames is 0 or less.");
    } else if(isNaN(updateTime) || updateTime <= 0) {
        throw new Error(
            "The generation update timing second is 0 or less.");
    } else if(user == "") {
        throw new Error("The user name has not been set.");
    } else if(key1 == "") {
        throw new Error(
            "The target key1 has not been set.");
    } else if(key2 == "") {
        throw new Error(
            "The target key2 has not been set.");
    }
    // updateTimeに対する現在時間の値を取得.
    const now = nowTiming(updateTime);
    // 更新残り時間を取得.
    if(Array.isArray(outNextTime)) {
        outNextTime[0] = 
            (updateTime * 1000) - (Date.now() - (now * 1000));
        outNextTime[1] = updateTime * 1000;
    }
    // user, key1, key2を数値化.
    const code = userAndKey1AndKey2ToLong(user, key1, key2);
    // ２段階認証コードを取得.
    return [
        createCode(mfaLen, now - updateTime, code)
        ,createCode(mfaLen, now, code)
        ,createCode(mfaLen, now + updateTime, code)
    ];
}

////////////////////////////////////////////////////////////////
// 外部定義.
////////////////////////////////////////////////////////////////
exports.create = create;

})();

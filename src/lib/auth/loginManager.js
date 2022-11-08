//////////////////////////////////////////
// ログインマネージャー.
//////////////////////////////////////////
(function(_g) {
'use strict'

// frequireが設定されていない場合.
let frequire = global.frequire;
if(frequire == undefined) {
    // frequire利用可能に設定.
    require("../../freqreg.js");
    frequire = global.frequire;
}

// crypto.
const crypto = frequire('crypto');

// S3KevValueStorage.
const s3kvs = frequire("./lib/storage/s3kvs.js");

// login用signature.
const sig = frequire("./lib/auth/signature.js");

// デフォルトのS3Kvs.
const defS3Kvs = s3kvs.create();

// ログインユーザテーブル.
const userTable = defS3Kvs.currentTable("loginUser");

// セッションログイン管理テーブル.
const sessionTable = defS3Kvs.currentTable("loginSession");

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

// sha256変換.
// code 変換元の内容を返却します.
// 戻り値 変換結果(base64)が返却されます.
const sha256 = function(code) {
    return cutEndBase64Eq(crypto.createHash('sha256')
        .update(code).digest("base64"));
}

// 文字列が存在するかチェック.
// s 文字列を設定します.
// 戻り値: trueの場合、文字列が存在します.
const useString = function(s) {
    return typeof(s) == "string" && s.length > 0;
}

// ユーザ名に対する情報を取得.
// user 対象のユーザ名を設定します.
// 戻り値: {password: string, .... }
//         password: パスワード(sha256)が返却されます.
const getUser = async function(user) {
    if(!useString(user)) {
        throw new Error("User has not been set.");
    }
    return await userTable.get(undefined, {user: user});
}

// ユーザー情報が存在するかチェック.
// user 対象のユーザ名を設定します.
// 戻り値: trueの場合存在します.
const isUser = async function(user) {
    try {
        return await getUser(user) != null;
    } catch(e) {
        return false;
    }
}

// ユーザ登録.
// user 対象のユーザ名を設定します.
// password 対象のパスワードを設定します.
// options ユーザオプションを設定します.
// 戻り値: trueの場合登録できました.
const createUser = async function(user, password, options) {
    if(!useString(password)) {
        throw new Error("Password has not been set.");
    }
    // 既にユーザ情報が存在する場合.
    if(await getUser(user) != null) {
        throw new Error(
            "User (" + user + ") already exists.")
    }
    // パスワードをsha256変換.
    password = sha256(password);
    const userInfo = {};
    // オプションをセット.
    if(options != undefined && options != null) {
        for(let k in options) {
            userInfo[k] = options[k];
        }
    }
    // パスワードをセット.
    userInfo["password"] = password;
    return await userTable.put(undefined,
        {user: user}, userInfo);
}

// ユーザ削除.
// user 対象のユーザ名を設定します.
// 戻り値: trueの場合ユーザ情報が削除できました.
const removeUser = async function(user) {
    // ユーザ情報が存在しない場合.
    const userInfo = await getUser(user);
    if(userInfo == null) {
        return false;
    }
    return await userTable.remove(
        undefined, {user: user});
}

// パスワード変更.
// user 対象のユーザ名を設定します.
// srcPassword 元のパスワードを設定します.
// newPassword 新しいパスワードを設定します.
// 戻り値: trueの場合パスワードの変更ができました.
const changePassword = async function(
    user, srcPassword, newPassword) {
    if(!useString(srcPassword)) {
        throw new Error("srcPassword has not been set.");
    } else if(!useString(newPassword)) {
        throw new Error("newPassword has not been set.");
    }
    // ユーザ情報が存在しない場合.
    const userInfo = await getUser(user);
    if(userInfo == null) {
        throw new Error(
            "User (" + user + ") no longer exists.")
    }
    // 元のパスワードをsha256変換.
    srcPassword = sha256(srcPassword);
    // パスワードが不一致.
    if(userInfo.password != srcPassword) {
        throw new Error("Original password does not match.");
    }
    // 新しいパスワードをsha256変換.
    newPassword = sha256(newPassword);
    userInfo["password"] = newPassword;
    return await userTable.put(undefined,
        {user: user}, userInfo)
}

// オプションを設定/削除.
// putFlag 設定の場合はtrue.
// user 対象のユーザー名を設定します.
// options ユーザオプションを設定します.
// 戻り値: trueの場合正常に処理できました.
const settingOption = async function(putFlag, user, options) {
    // ユーザ情報が存在しない場合.
    const userInfo = await getUser(user);
    if(userInfo == null) {
        throw new Error(
            "User (" + user + ") no longer exists.")
    }
    // オプションをセット.
    if(options != undefined && options != null) {
        for(let k in options) {
            // オプションにパスワードがセットされている
            // 場合は読み飛ばす.
            if(k == "password") {
                continue;
            }
            // 設定.
            if(putFlag) {
                userInfo[k] = options[k];
            // 削除.
            } else {
                delete userInfo[k];
            }
        }
    }
    return await userTable.put(undefined,
        {user: user}, userInfo);
}

// ユーザーログイン.
// user 対象のユーザ名を設定します.
// password パスワードを設定します.
// 戻り値: trueの場合、ログイン成功です.
const userLogin = async function(user, password) {
    if(!useString(password)) {
        return false;
    }
    // ユーザ情報が存在しない場合.
    const userInfo = await getUser(user);
    if(userInfo == null) {
        return false;
    }
    // パスワードをsha256変換.
    password = sha256(password);
    // パスワードが不一致.
    if(userInfo.password != password) {
        return false;
    }
    // ログイン成功.
    return true;
}

// 最大表示件数.
let MAX_ONE_PAGE_LIST = process.env["LOGIN_USER_ONE_LIST"]|0;
if(MAX_ONE_PAGE_LIST >= 100) {
    MAX_ONE_PAGE_LIST = 100;
} else if(MAX_ONE_PAGE_LIST <= 0) {
    MAX_ONE_PAGE_LIST = 25;
}

// ユーザ名一覧を取得.
// page ページ番号を設定します.
//      ページ番号は１から設定します.
// max １ページで表示する数を設定します.
//     最大は100で、設定しない場合は 環境変数 `LOGIN_USER_ONE_LIST` の
//     値が設定され、存在しない場合は25が設定されます.
const userList = async function(page, max) {
    if(max == undefined || max == null) {
        max = MAX_ONE_PAGE_LIST;
    }
    // １ページの情報を取得.
    const list = await userTable.list(undefined, max, page);
    // 情報が存在しない場合.
    if(list == null) {
        return [];
    }
    const ret = [];
    const len = list.length;
    for(let i = 0; i < len; i ++) {
        // ユーザー情報をセット(passwordを除く).
        const userInfo = await getUser(list[i]["value"]);
        delete userInfo["password"];
        ret[i] = userInfo;
    }
    return ret;
}

// ユーザーセッションを作成.
// user 対象のユーザ名を設定します.
// 戻り値: nullでない場合正常に処理されました.
//        {passCode: string, sessionId: stringm lastModified: number}
//        passCode パスコードが返却されます.
//        sessionId セッションIDが返却されます.
//        lastModified セッション生成時間(ミリ秒)が設定されます.
const createSession = async function(user) {
    // ユーザ情報が存在しない場合.
    const userInfo = await getUser(user);
    if(userInfo == null) {
        throw new Error(
            "User (" + user + ") no longer exists.")
    }
    // パスコードを設定.
    userInfo.passCode = sig.getPassCode(user, userInfo.password);
    // セッションIDを設定.
    userInfo.sessionId = sig.createSessionId();
    // 更新時間.
    userInfo.lastModified = Date.now();
    // パスワードを削除.
    delete userInfo["password"];
    // セッション登録.
    if(await sessionTable.put(
        undefined, {user: user}, userInfo) == true) {
        return userInfo;
    }
    return null;
}

// ユーザーセッションを取得.
// user 対象のユーザ名を設定します.
// 戻り値: nullでない場合、ユーザセッションが存在します.
//        {passCode: string, sessionId: stringm lastModified: number}
//        passCode パスコードが返却されます.
//        sessionId セッションIDが返却されます.
//        lastModified セッション生成時間(ミリ秒)が設定されます.
const getSession = async function(user) {
    return await sessionTable.get(undefined, {user: user});
}

// ユーザーセッションを更新.
// user 対象のユーザ名を設定します.
// 戻り値: nullでない場合、ユーザセッションが存在します.
//        {passCode: string, sessionId: stringm lastModified: number}
//        passCode パスコードが返却されます.
//        sessionId セッションIDが返却されます.
//        lastModified セッション生成時間(ミリ秒)が設定されます.
const updateSession = async function(user) {
    const sessionInfo = await sessionTable.get(undefined, {user: user});
    if(sessionInfo == null) {
        return false;
    }
    // 更新時間を更新する.
    sessionInfo.lastModified = Date.now();
    // セッション更新
    if(await sessionTable.put(
        undefined, {user: user}, sessionInfo) == true) {
        return sessionInfo;
    }
    return null;
}

////////////////////////////////////////////////////////////////
// 外部定義.
////////////////////////////////////////////////////////////////
exports.getUser = getUser;
exports.isUser = isUser;
exports.createUser = createUser;
exports.removeUser = removeUser;
exports.changePassword = changePassword;
exports.putOption = function(user, options) {
    return settingOption(true, user, options);
}
exports.removeOption = function(user, options) {
    return settingOption(false, user, options);
}
exports.userLogin = userLogin;
exports.userList = userList;
exports.createSession = createSession;
exports.getSession = getSession;
exports.updateSession = updateSession;

})(global);
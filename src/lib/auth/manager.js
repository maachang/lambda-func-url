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

// １日 = ミリ秒.
const ONE_DAY_MS = 86400000;

// Cookieに格納するセッションID名.
const COOKIE_SESSION_KEY = "lfu-session-id";

// [ENV]ログイントークン作成キーコード.
const ENV_LOGIN_TOKEN_KEYCODE = "LOGIN_TOKEN_KEYCODE";

// [ENV]最大ユーザー表示件数設定.
const ENV_LOGIN_USER_LIST_LIMIT = "LOGIN_USER_LIST_LIMIT";

// [ENV]ログイントークン寿命定義.
const ENV_LOGIN_TOKEN_EXPIRE = "LOGIN_TOKEN_EXPIRE";

// [ENV]ログイントークン作成キーコードを取得.
const LOGIN_TOKEN_KEYCODE = process.env[ENV_LOGIN_TOKEN_KEYCODE];

// [ENV]最大表示件数.
let LOGIN_USER_LIST_LIMIT = process.env[ENV_LOGIN_USER_LIST_LIMIT]|0;
if(LOGIN_USER_LIST_LIMIT >= 100) {
    LOGIN_USER_LIST_LIMIT = 100;
} else if(LOGIN_USER_LIST_LIMIT <= 0) {
    LOGIN_USER_LIST_LIMIT = 25;
}

// [ENV]ログイントークン寿命を取得.
let LOGIN_TOKEN_EXPIRE = process.env[ENV_LOGIN_TOKEN_EXPIRE];
if(LOGIN_TOKEN_EXPIRE == undefined) {
    LOGIN_TOKEN_EXPIRE = 1;
}

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
    return await userTable.get("user", user);
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
    return await userTable.put("user", user, userInfo);
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
    return await userTable.remove("user", user);
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
    return await userTable.put("user", user, userInfo)
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
    return await userTable.put("user", user, userInfo);
}

// ユーザ名一覧を取得.
// page ページ番号を設定します.
//      ページ番号は１から設定します.
// max １ページで表示する数を設定します.
//     最大は100で、設定しない場合は 環境変数 `LOGIN_USER_LIST_LIMIT` の
//     値が設定され、存在しない場合は25が設定されます.
const userList = async function(page, max) {
    if(max == undefined || max == null) {
        max = LOGIN_USER_LIST_LIMIT;
    }
    // １ページの情報を取得.
    const list = await userTable.list(max, page);
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
    if(await sessionTable.put("user", user, userInfo) == true) {
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
    return await sessionTable.get("user", user);
}

// ユーザーセッションを削除.
// user 対象のユーザ名を設定します.
// passCode 対象のパスコードを設定します.
// sessionId 対象のセッションIDを設定します.
// 戻り値: trueの場合ユーザーセッションは削除できました.
const removeSession = async function(
    user, passCode, sessionId) {
    const sessionInfo = await sessionTable.get("user", user);
    if(sessionInfo == null) {
        // 取得出来ない場合は削除失敗.
        return false;
    }
    // パスコードとセッションIDをチェック.
    if(passCode != sessionInfo.passCode ||
        sessionId != sessionInfo.sessionId) {
        // 一致しない場合は削除失敗.
        return false;
    }
    // セッション更新
    return await sessionTable.remove("user", user);
}

// ユーザーセッションが保持する最終更新時間がexpire時間を
// 超えていないかチェック.
// lastModified ユーザーセッションのlastModifiedを設定します.
// 戻り値: trueの場合、expire時間を超えています.
const isUserSessionToExpire = function(lastModified) {
    const expire = ONE_DAY_MS * LOGIN_TOKEN_EXPIRE;
    if(Date.now >= (lastModified + expire)) {
        return true;
    }
    return false;
}

// ユーザーセッションを更新.
// user 対象のユーザ名を設定します.
// passCode 対象のパスコードを設定します.
// sessionId 対象のセッションIDを設定します.
// 戻り値: trueの場合、ユーザーセッションの更新成功です.
const updateSession = async function(
    user, passCode, sessionId) {
    const sessionInfo = await sessionTable.get("user", user);
    if(sessionInfo == null) {
        // 取得出来ない場合は更新失敗.
        return false;
    }
    // パスコードとセッションIDをチェック.
    if(passCode != sessionInfo.passCode ||
        sessionId != sessionInfo.sessionId ||
        isUserSessionToExpire(
            sessionInfo.lastModified)) {
        // 一致しない場合は更新失敗.
        return false;
    }
    // 更新時間を更新する.
    sessionInfo.lastModified = Date.now();
    // セッション更新
    return await sessionTable.put("user", user, sessionInfo);
}

// ユーザーログイン確認.
// user 対象のユーザ名を設定します.
// password パスワードを設定します.
// 戻り値: trueの場合、ログイン成功です.
const confirmLogin = async function(user, password) {
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

// ログイントークンキーコードを取得.
// request Httpリクエスト情報.
// 戻り値: ログイントークンキーコードが返却されます.
const getLoginTokenKeyCode = function(request) {
    // ログイントークン作成用のキーコードを取得.
    let ret = LOGIN_TOKEN_KEYCODE;
    // ログイントークンキーコードを取得.
    if(ret == undefined) {
        // 取得できない場合はhost情報をhash化.
        ret = request.header.get("host");
    }
    return ret;
}

// ログイン処理.
// resHeader レスポンスヘッダ(./lib/httpHeader.js)
// request Httpリクエスト情報.
// user 対象のユーザー名を設定します.
// password 対象のパスワードを設定します.
// 戻り値: trueの場合、ログインに成功しました.
const login = async function(resHeader, request,
    user, password) {
    try {
        // ログイン処理.
        const result = await confirmLogin(user, password);
        // ログイン成功.
        if(result == true) {
            // 新しいセッションを作成.
            const sessions = await createSession(user);
            if(sessions == null) {
                // 新しいセッション取得に失敗.
                throw new Error("Failed to get a login session.");
            }

            // ログイントークン作成用のキーコードを取得.
            const keyCode = getLoginTokenKeyCode(request);

            // ログイントークンを作成.
            const token = sig.encodeToken(
                keyCode, user, sessions.passCode,
                sessions.sessionId, LOGIN_TOKEN_EXPIRE);

            // レスポンスにセッションキーを設定.
            resHeader.putCookie(COOKIE_SESSION_KEY, {value: token});
            return true;
        }
    } catch(e) {
        console.error("I failed to login", e);
    }
    // ログイン失敗.
    return false;
}

// ログアウト処理.
// resHeader レスポンスヘッダ(./lib/httpHeader.js)
// request Httpリクエスト情報.
// 戻り値: trueの場合、ログアウトに成功しました.
const logout = async function(resHeader, request) {
    try {
        // cookieからログイントークンを取得.
        const token = request.header.getCookie(COOKIE_SESSION_KEY);
        if(token == undefined) {
            // ログインされていない.
            return false;
        }
        // トークンの解析・内容を取得.
        const keyCode = getLoginTokenKeyCode(request);
        const dtoken = sig.decodeToken(keyCode, token);
        // ユーザーセッションを削除.
        const res = await removeSession(
            dtoken.user, dtoken.passCode, dtoken.sessionId);
        // ユーザセッション削除に成功した場合.
        if(res == true) {
            // cookieセッションを削除.
            resHeader.putCookie(COOKIE_SESSION_KEY,
                {value: token, expires: new Date(0).toUTCString()});
        }
        return res;
    } catch(e) {
        // ログイン確認エラー
        console.error("I failed to logout", e);
        // ログアウト失敗.
        return false;
    }
}

// ログイン確認.
// 対象のリクエストでログイン済みかチェックします.
// level チェックレベルを設定します.
//       0: トークンの存在確認を行います.
//       1: level = 0 + トークンのexpireチェックを行います.
//       2: level = 1 + トークンをs3kvsに問い合わせます.
// resHeader レスポンスヘッダ(./lib/httpHeader.js)
// request Httpリクエスト情報.
// 戻り値: trueの場合、ログインされています.
const isLogin = async function(level, resHeader, request) {
    // マイナス値の場合は処理しない.
    level = level|0;
    if(level < 0) {
        // ログイン済みとみなす.
        return true;
    }
    try {
        // cookieからログイントークンを取得.
        const token = request.header.getCookie(COOKIE_SESSION_KEY);
        if(token == undefined) {
            // ログインされていない.
            return false;
        }
        // level=0の場合、ログインされているとみなす.
        if(level == 0) {
            // level=0的にログイン担保.
            return true;
        }
        // トークンの解析.
        const keyCode = getLoginTokenKeyCode(request);
        const dtoken = sig.decodeToken(keyCode, token);

        // expire値を超えている場合.
        if(Date.now() >= dtoken.expire) {
            // ログインされていない.
            return false;
        }
        // level=1の場合、ログインされているとみなす.
        if(level == 1) {
            // level=1的にログイン担保.
            return true;
        }
        // ユーザーセッションをアップデート.
        const ret = await updateSession(
            dtoken.user, dtoken.passCode, dtoken.sessionId);
        // アップデート成功の場合.
        if(ret == true) {
            // セッションアップデートのタイミングで
            // cookie内容も更新する.

            // 更新するログイントークンを作成.
            const nextToken = sig.encodeToken(
                keyCode, dtoken.user, dtoken.passCode,
                dtoken.sessionId, LOGIN_TOKEN_EXPIRE);

            // レスポンスにセッションキーを再設定.
            resHeader.putCookie(COOKIE_SESSION_KEY, {value: nextToken});
        }
        return ret;
    } catch(e) {
        // ログイン確認エラー
        console.error("Login verification failed.", e);
        // ログインされていない.
        return false;
    }
}

// 現在のログイン中ユーザー情報を取得.
// request 対象のHTTPリクエストを設定します.
// 戻り値: 現在ログイン中のユーザー情報が返却されます.
//        ただし、パスワードは除外されます.
//        {user: string, ....}
//        user: ログイン中のユーザー名が返却されます.
//        それ以外は設定されているタグ名(たとえば admin など)が
//        設定されたりします.
const getLoginInfo = async function(request) {
    let user = null;
    try {
        // cookieからログイントークンを取得.
        const token = request.header.getCookie(COOKIE_SESSION_KEY);
        if(token == undefined) {
            // ログインされていないので空返却.
            return {};
        }
        // トークンの解析.
        const keyCode = getLoginTokenKeyCode(request);
        const dtoken = sig.decodeToken(keyCode, token);

        // expire値を超えている場合.
        if(Date.now() >= dtoken.expire) {
            // ログインされていないので空返却.
            return {};
        }
        // ユーザー名を取得.
        user = dtoken.user;
    } catch(e) {
        // 例外なので空返却.
        return {};
    }
    // ユーザ情報を取得.
    const userInfo = await getUser(user);
    if(userInfo == null) {
        // ユーザー情報が存在しない場合エラー返却.
        throw new Error(
            "The logged-in user information \"" + user +
            "\" has already been deleted and does not exist.");
    }
    // password以外のUserInfoを返却.
    const ret = {};
    for(let k in userInfo) {
        // パスワードは格納しない.
        if(k == "password") {
            continue;
        }
        ret[k] = userInfo[k];
    }
    ret["user"] = user;
    return ret;
}

// ログイン済みか確認をするfilter実行.
// _ Array[0]に返却対象の処理結果のレスポンスBodyを設定します.
// resState: レスポンスステータス(httpStatus.js).
// resHeader レスポンスヘッダ(httpHeader.js).
// request Httpリクエスト情報.
// noCheckPaths チェック対象外のパス郡を設定します.
//              {"/index.html", true} のような感じで.
// 戻り値: true / false(boolean).
//        trueの場合filter処理で処理終了となります.
const filter = async function(
    _, resState, resHeader, request, noCheckPaths) {
    // チェック対象外のパス.
    if(noCheckPaths != undefined && noCheckPaths != null &&
        noCheckPaths[request.path]) {
        return false;
    }
    // 拡張子を取得.
    const extension = request.extension;
    let level = 0;
    // 動的処理のリクエストの場合.
    if(extension == undefined || extension == "jhtml") {
        // トークンの完全チェック.
        level = 2;
    // htmlファイルの場合.
    } else if(extension == "htm" || extension == "html") {
        // トークンの存在チェック.
        level = 2;
    // メイン以外のコンテンツ情報.
    } else {
        // チェックしない.
        level = -1;
    }
    // ログインされていない事を確認.
    if(!(await isLogin(level, resHeader, request))) {
        // エラー403返却.
        resState.setStatus(403);
        return true;
    }
    // ログインされているかチェックしない場合.
    return false;
}

// 時限的セッションのトークンユーザ名.
const TIMED_SESSION_USER = "*#^#&8)|<!@";

// 時限的トークンのトークンパスコード.
const TIMED_SESSION_PASSCODE = "!)*^$#|\n" + TIMED_SESSION_USER;

// ログインアクセス時の時限的セッションを生成.
// この処理はたとえば `/login.lfu.js` のような、ログインの認証アクセスを
// する場合において、ユーザー・パスワードの量的アタックを防ぐためのトークンを発行します.
// request Httpリクエスト情報.
// expire 時限的トークンの寿命をミリ秒単位で指定します.
// 戻り値: トークンが返却されるので、この値をHTTPヘッダ等に設定して、
//         ログイン認証時に読み込んで、アタック回避をします.
const createTimedSession = function(request, expore) {
    // ログイントークンキーコードを取得.
    const tokenKeyCode = getLoginTokenKeyCode(request);
    // トークン発行.
    return sig.encodeToken(
        tokenKeyCode + "|\n" + request.header.get("host"),
        TIMED_SESSION_USER, TIMED_SESSION_PASSCODE,
        sig.createSessionId(34), null, expore);
}

// ログインアクセス時の時限的セッションを復元して正しく利用できるかチェック.
// request Httpリクエスト情報.
// timedSession 対象の時限的トークンを設定します.
// 戻り値: trueの場合、時限的セッションは正しいです.
const isTimedSession = function(request, timedSession) {
    // ログイントークンキーコードを取得.
    const tokenKeyCode = getLoginTokenKeyCode(request);
    // 対象のtimedSessionを解析.
    const sessions = sig.decodeToken(
        tokenKeyCode + "|\n" + request.header.get("host"),
        timedSession);
    // 固定のパスコードとユーザ名の凸合.
    if(sessions.passCode == TIMED_SESSION_PASSCODE &&
        sessions.user == TIMED_SESSION_USER && 
        sessions.expire > Date.now()) {
        return true;
    }
    return false;
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
exports.userList = userList;
exports.createSession = createSession;
exports.getSession = getSession;
exports.removeSession = removeSession;
exports.updateSession = updateSession;
exports.login = login;
exports.logout = logout;
exports.isLogin = isLogin;
exports.getLoginInfo = getLoginInfo;
exports.filter = filter;
exports.createTimedSession = createTimedSession;
exports.isTimedSession = isTimedSession;

})(global);
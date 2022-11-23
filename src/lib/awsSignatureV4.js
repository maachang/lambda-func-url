///////////////////////////////////////////////////////////
// AWS Signature(version4).
// AWS のサービスに rest Apiでアクセスするためのシグニチャーを
// 計算する.
///////////////////////////////////////////////////////////
(function(_g) {
'use strict'

// frequireが設定されていない場合.
let frequire = global.frequire;
if(frequire == undefined) {
    // frequire利用可能に設定.
    require("../freqreg.js");
    frequire = global.frequire;
}

// crypto.
const crypto = frequire('crypto');

// httpsClient.
const httpsClient = frequire("./lib/httpsClient.js");

// CredentialScope のアルゴリズム名.
const ALGORITHM = "AWS4-HMAC-SHA256";

// CredentialScope のエンドスコープ.
const END_SCOPE = "aws4_request";

// 空のPayloadSha256.
const EMPTY_PAYLOAD_SHA256 =
    "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

// デフォルトのクレデンシャル.
let DEFAULT_CREDENTIAL = null;

// 最終取得クレデンシャル.
let LAST_CREDENTIAL_TIME = 0;

// クレデンシャル取得タイムアウト.
let CREDENTIAL_TIMEOUT = 5000;

// [ENV]AWSクレデンシャル: アクセスキー.
const ENV_AWS_ACCESS_KEY_ID = "AWS_ACCESS_KEY_ID";

// [ENV]AWSクレデンシャル: アクセスシークレットキー.
const ENV_AWS_SECRET_ACCESS_KEY = "AWS_SECRET_ACCESS_KEY";

// [ENV]AWSクレデンシャル: セッショントークン.
const ENV_AWS_SESSION_TOKEN = "AWS_SESSION_TOKEN";

// デフォルトのクレデンシャルを取得.
// 戻り値: {accessKey: string, secretAccessKey: string,
//           sessionToken: string}
//         - accessKey アクセスキーが返却されます.
//         - secretAccessKey シークレットアクセスキーが返却されます.
//         - sessionToken セッショントークンが返却されます.
//                        状況によっては空の場合があります.
const getCredential = function() {
    const now = Date.now();
    // キャッシュ化されていない場合.
    // タイムアウトの場合.
    if(DEFAULT_CREDENTIAL == null ||
        LAST_CREDENTIAL_TIME < now) {
        DEFAULT_CREDENTIAL = {
            accessKey: process.env[ENV_AWS_ACCESS_KEY_ID]
            ,secretAccessKey: process.env[ENV_AWS_SECRET_ACCESS_KEY]
            ,sessionToken: process.env[ENV_AWS_SESSION_TOKEN]
        };
        // 最終取得時間+タイムアウト値.
        LAST_CREDENTIAL_TIME = CREDENTIAL_TIMEOUT + now;
    }
    return DEFAULT_CREDENTIAL;
}


// yyyyMMdd'T'HHmmss'Z'の文字列を作成.
// date 対象の日付オブジェクトを設定します.
// 戻り値: yyyyMMdd'T'HHmmss'Z'が返却されます.
const createDateTimeText = function(date) {
    if(typeof(date) == "string") {
        date = new Date(date);
    }
    // UTCで出力.
    const y = "" + date.getUTCFullYear();
    const M = "" + (date.getUTCMonth() + 1);
    const d = "" + date.getUTCDate();
    const h = "" + date.getUTCHours();
    const m = "" + date.getUTCMinutes();
    const s = "" + date.getUTCSeconds();
    // こんな感じ `20150830T123600Z` で生成.
    return y + "00".substring(M.length) + M +
        "00".substring(d.length) + d +
        "T" +
        "00".substring(h.length) + h +
        "00".substring(m.length) + m +
        "00".substring(s.length) + s +
        "Z";
}

// リージョンを取得.
// region 対象のリージョン名を設定します.
// 戻り値: リージョン名が返却されます.
const getRegion = function(region) {
    if(region == undefined || region == null) {
        region = "ap-northeast-1";
    }
    return region;
}

// sha256変換.
// key 対象のキー.
// returnMode digestにわたす引数(string).
// 戻り値 変換結果(returnModeに依存)
const sha256 = function(key, returnMode) {
    return crypto.createHash('sha256')
        .update(key).digest(returnMode);
}

// hmacSHA256で変換.
// data 対象のデータ
// key 対象のキー
// returnMode digestにわたす引数(string).
// 戻り値 変換結果(returnModeに依存)
const hmacSHA256 = function(key, message, returnMode) {
    return crypto.createHmac('sha256', key)
        .update(message).digest(returnMode);
}

// シグニチャーを作成.
// key シークレットアクセスキー(string).
// date yyyMMdd(string).
// region リージョン(string).
// service AWSサービス名(string).
// 戻り値: シグニチャーを返却.
const getSignatureKey = function(key, date, region, service) {
    let n = "AWS4" + key;
    n = hmacSHA256(n, date);
    n = hmacSHA256(n, region);
    n = hmacSHA256(n, service);
    return hmacSHA256(n, END_SCOPE);
}

// リクエストヘッダのキー小文字変換版を作成.
// header リクエストヘッダを設定します.
//        この中身が直接変更されます.
const convertRequestHeaderToLowerKeys = function(header) {
    let len = 0;
    const list = [];
    for(let k in header) {
        const v = header[k];
        const lk = k.toLowerCase();
        delete header[k];
        list[len ++] = lk;
        list[len ++] = v;

    }
    for(let i = 0; i < len; i += 2) {
        header[list[i]] = list[i + 1];
    }
}

// リクエストヘッダ名を取得.
// header リクエストヘッダを設定します.
const getRequestHeaderKeys = function(header) {
    const ret = [];
    for(let k in header) {
        ret[ret.length] = k;
    }
    ret.sort();
    return ret;
}

// step1.署名バージョン4の正規リクエストを作成する.
// https://docs.aws.amazon.com/ja_jp/general/latest/gr/sigv4-create-canonical-request.html
//  CanonicalRequest =
//      HTTPRequestMethod + '\n' +
//      CanonicalURI + '\n' +
//      CanonicalQueryString + '\n' +
//      CanonicalHeaders + '\n' +
//      SignedHeaders + '\n' +
//      HexEncode(Hash(RequestPayload)
// credential getCredential() で取得した値(Object).
// method HTTPメソッド(GET, POSTなど) = HTTPRequestMethod.
// path 対象のパス名(string) = CanonicalURI.
// urlParams urlパラメータ(object) = CanonicalQueryString.
// header 対象のヘッダ(Object) = CanonicalHeaders.
//        必ずhostを設定する必要があります.
// payload 対象のRequestPayload = RequestPayload.
//         この値はrequestBody値を設定.
//         method=GETなどの場合は空文字[""]を設定.
// 戻り値: {hashedCanonicalRequest: string, signedHeaders: string} 
//        hashedCanonicalRequestがセット.
//        signedHeadersがセット.
const signatureV4Step1 = function(
    credential, method, path, urlParams, header, payload
) {
    // クレデンシャル内容が不正な場合.
    if(credential["secretAccessKey"] == undefined ||
        credential["accessKey"] == undefined) {
        throw new Error("AWS credentials not set.");
    }
    // httpヘッダ小文字変換.
    convertRequestHeaderToLowerKeys(header);
    // 必須ヘッダ条件.
    if(header["host"] == undefined) {
        throw new Error(
            "\"host\" is required in the request header.");
    }
    // パスの先頭スラッシュをセット.
    if(!(path = path.trim()).startsWith("/")) {
        path = "/" + path;
    }
    // payloadが設定されていない場合、空文字をセット.
    if(payload == undefined || payload == null) {
        payload = "";
    }
    // urlParamsを取得.
    urlParams = httpsClient.convertUrlParams(urlParams);
    // x-amz-dateが存在しない場合.
    if(header["x-amz-date"] == undefined) {
        const date = new Date();
        header["x-amz-date"] = createDateTimeText(date);
    }
    // credentialのセッショントークンが存在する場合.
    if(credential["sessionToken"] != undefined) {
        header["x-amz-security-token"] = credential["sessionToken"];
    }
    // payload(requestBody)sha256で計算.
    if(payload == "") {
        // 空の場合.
        header["x-amz-content-sha256"] = EMPTY_PAYLOAD_SHA256;
    } else {
        // 空じゃない場合計算する.
        header["x-amz-content-sha256"] = sha256(payload, "hex");
    }
    
    // SignedHeadersとCanonicalHeadersを作成.
    // key1;key2 ...の感じ.
    let signedHeaders = "";
    // key1:value\nkey2:value ...の感じ.
    let canonicalHeaders = "";
    let scode = ""
    // ヘッダソートキー.
    let list = getRequestHeaderKeys(header);
    const len = list.length;
    for(let i = 0; i < len; i ++) {
        const key = list[i].trim();
        // SignedHeadersをセット.
        signedHeaders += scode + key; scode = ";";
        // CanonicalHeadersをセット.
        canonicalHeaders +=
            key.replace(/ +/g, " ") + ":" +
            header[key].trim().replace(/ +/g, " ") + "\n";
    }
    list = null; scode = null;
    // CanonicalRequestを作成.
    const canonicalRequest =
        method.toUpperCase() + '\n' +
        path + '\n' +
        urlParams + '\n' +
        canonicalHeaders + '\n' +
        signedHeaders + '\n' +
        header["x-amz-content-sha256"];
    // sha256 + hex変換.
    const hashedCanonicalRequest = sha256(canonicalRequest, "hex");
    // 処理結果を返却.
    return {hashedCanonicalRequest: hashedCanonicalRequest,
        signedHeaders: signedHeaders};
}

// step2.署名バージョン4の署名文字列を作成する.
// https://docs.aws.amazon.com/ja_jp/general/latest/gr/sigv4-create-string-to-sign.html
// StringToSign =
//      Algorithm + \n +
//      RequestDateTime + \n +
//      CredentialScope + \n +
//      HashedCanonicalRequest
// header 対象のヘッダ(Object).
// region 対象のリージョン(string).
// service AWSサービス名(string).
// step1Result signatureV4Step1で作成した値(Object).
// 戻り値: {credentialScope: string, stringToSign: string, dateText: "string"}
//         credentialScopeがセット.
//         stringToSignがセット.
//         dateText(yyyMMdd)がセット.
const signatureV4Step2 = function(
    header, region, service, step1Result
) {
    // リージョン取得.
    region = getRegion(region);
    const dateTimeText = header["x-amz-date"];
    // yyyyMMdd変換.
    const dateText = dateTimeText.substring(0, dateTimeText.indexOf("T"));
    // CredentialScopeを生成.
    const credentialScope = 
        dateText + "/" + region + "/" + service + "/" + END_SCOPE;
    // stringToSignを生成.
    const stringToSign = 
          ALGORITHM + "\n"
        + dateTimeText + "\n"
        + credentialScope + "\n"
        + step1Result["hashedCanonicalRequest"];

    // 処理結果を返却.
    return {
        credentialScope: credentialScope,
        stringToSign: stringToSign,
        dateText: dateText
    }
}

// final.署名バージョン4の署名を計算する.
// https://docs.aws.amazon.com/ja_jp/general/latest/gr/sigv4-calculate-signature.html
// header リクエストヘッダ(Object).
// credential getCredential() で取得した値(Object).
// region 対象のリージョン(string).
// service AWSサービス名(string).
// step1Result signatureV4Step1で作成した値(Object).
// step2Result signatureV4Step2で作成した値(Object).
// 戻り値: Authorization の値.
const signatureV4Final = function(
    header, credential, region, service, step1Result,
    step2Result
) {
    // クレデンシャル内容が不正な場合.
    if(credential["secretAccessKey"] == undefined ||
        credential["accessKey"] == undefined) {
        throw new Error("AWS credentials not set.");
    } 
    // シグニチャーキー生成.
    let signature = getSignatureKey(
        credential["secretAccessKey"],
        step2Result["dateText"],
        region,
        service
    );
    // 署名を計算する.
    signature = hmacSHA256(
        signature,
        step2Result["stringToSign"],
        "hex"
    );
    // Authorizationを生成.
    const sigV4 =
          ALGORITHM
        + " Credential=" + credential["accessKey"] + "/" + step2Result["credentialScope"]
        + ", SignedHeaders=" + step1Result["signedHeaders"]
        + ", Signature=" + signature;
    
    // header に シグニチャーV4を設定.
    header["Authorization"] = sigV4;
    return sigV4;
}

/////////////////////////////////////////////////////
// 外部定義.
/////////////////////////////////////////////////////
exports.getCredential = getCredential;
exports.signatureV4Step1 = signatureV4Step1;
exports.signatureV4Step2 = signatureV4Step2;
exports.signatureV4Final = signatureV4Final;

})();
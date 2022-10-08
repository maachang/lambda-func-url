///////////////////////////////////////////////////////////
// AWS Signature(version4).
// aws sdk(v2) for javascriptだと、Lambdaコールドスタート時に
// おいて、読み込みに5000ミリ秒以上かかる.
// 代替えとして、AWSでは REST APIが提供されているので、この
// 機能を利用してAWSサービスにI/Oする.
// 
// ここでは `署名バージョン4` 機能を提供する.
///////////////////////////////////////////////////////////
(function(_g) {
'use strict'

// crypto.
const crypto = frequire('crypto');

// クレデンシャルを取得.
// 戻り値: {accessKey: string, secretAccessKey: string, sessionToken}
//         accessKey アクセスキーが返却されます.
//         secretAccessKey シークレットアクセスキーが返却されます.
//         sessionToken セッショントークンが返却されます.
//                      状況によっては空の場合があります.
const getCredential = function() {
    return {
        accessKey: process.env["AWS_ACCESS_KEY_ID"]
        ,secretAccessKey: process.env["AWS_SECRET_ACCESS_KEY"]
        ,sessionToken: process.env["AWS_SESSION_TOKEN"]
    }
}

// x-amz-dateヘッダに渡す文字列を作成.
// date 対象の日付オブジェクトを設定します.
// 戻り値: yyyyMMdd'T'HHmmss'Z'が返却されます.
const createXAmzDate = function(date) {
    if(typeof(date) == "string") {
        date = new Date(date);
    }
    // UTC変換.
    date = new Date(Date.UTC(
        date.getFullYear(), date.getMonth(), date.getDate(),
        date.getHours(), date.getMinutes(), date.getSeconds()));
    // それぞれを文字列変換.
    const y = "" + date.getFullYear();
    const M = "" + (date.getMonth() + 1);
    const d = "" + date.getDate();
    const h = "" + date.getHours();
    const m = "" + date.getMinutes();
    const s = "" + date.getSeconds();
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

// hmacSHA256で変換.
// data 対象のデータ(string)
// key 対象のキー(binary)
// returnMode digestにわたす引数(string).
// 戻り値 変換結果(returnModeに依存)
const hmacSHA256 = function(data, key, returnMode) {
    return crypto.createHmac('sha256', key)
        .update(data).digest(returnMode);
}

// シグニチャーを作成.
// key シークレットアクセスキー(string).
// date yyyMMdd(string).
// region リージョン(string).
// service AWSサービス名(string).
// 戻り値: シグニチャーを返却.
const getSignatureKey = function(
    key, date, region, service) {
    let n = "AWS4" + key;
    n = hmacSHA256(date, n);
    n = hmacSHA256(region, n);
    n = hmacSHA256(service, n);
    return hmacSHA256("aws4_request", n);
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
// method HTTPメソッド(GET, POSTなど) = HTTPRequestMethod.
// path 対象のパス名(string) = CanonicalURI.
// queryString クエリー文字列(string) = CanonicalQueryString.
// header 対象のヘッダ(Object) = CanonicalHeaders.
// payload 対象のRequestPayload = RequestPayload.
//         この値はrequestBody値を設定.
//         method=GETなどの場合は空文字[""]を設定.
// 戻り値: {hashedCanonicalRequest: string, signedHeaders: string} 
//        hashedCanonicalRequestがセット.
//        signedHeadersがセット.
const signatureV4Step1 = function(
    method, path, queryString, header, payload
) {
    // SignedHeadersを作成.
    const signedHeaders = "content-type;host;x-amz-date";
    // canonicalHeadersを作成.
    // x-amz-date は予め createXAmzDate で処理したものを設定する.
    const canonicalHeaders = 
        "content-type:" + header["content-type"]
        + "\nhost:" + header["host"]
        + "\nx-amz-date:" + header["x-amz-date"];
    // CanonicalRequestを作成.
    const canonicalRequest =
        method + '\n' +
        path + '\n' +
        queryString + '\n' +
        canonicalHeaders + '\n' + '\n' +
        signedHeaders + '\n' +
        crypto.createHash('sha256').update(payload).
            digest('hex');
    // sha256 + hex変換.
    const hashedCanonicalRequest = crypto.createHash('sha256')
        .update(canonicalRequest).digest('hex');
    // 処理結果を返却.
    return {hashedCanonicalRequest: hashedCanonicalRequest,
        signedHeaders: signedHeaders};
}

// CredentialScope のアルゴリズム名.
const ALGORITHM = "AWS4-HMAC-SHA256";

// CredentialScope のエンドスコープ.
const END_SCOPE = "aws4_request";

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
// 戻り値: {credentialScope: string, stringToSign: string, date: "string"}
//         credentialScopeがセット.
//         stringToSignがセット.
//         date(yyyMMdd)がセット.
const signatureV4Step2 = function(
    header, region, service, step1Result
) {
    // リージョン取得.
    region = getRegion(region);
    const xAmzDate = header["x-amz-date"];
    // yyyyMMdd変換.
    const date = xAmzDate.substring(0, xAmzDate.indexOf("T"));
    // CredentialScopeを生成.
    const credentialScope = date + "/" + region + "/" + service + "/" + END_SCOPE;
    // stringToSignを生成.
    stringToSign =  ALGORITHM + "\n"
        + xAmzDate + "\n"
        + credentialScope + "\n"
        + step1Result["hashedCanonicalRequest"];
    // 処理結果を返却.
    return {
        credentialScope: credentialScope,
        stringToSign: stringToSign,
        date: date
    }
}

// final.署名バージョン4の署名を計算する.
// https://docs.aws.amazon.com/ja_jp/general/latest/gr/sigv4-calculate-signature.html
// credential getCredential() で取得した値(Object).
// region 対象のリージョン(string).
// service AWSサービス名(string).
// step1Result signatureV4Step1で作成した値(Object).
// step2Result signatureV4Step2で作成した値(Object).
// 戻り値: authorization の値.
const signatureV4Final = function(
    credential, region, service, step1Result, step2Result
) {
    // リージョン取得.
    region = getRegion(region);

    // シグニチャーキー生成.
    let signature = getSignatureKey(
        credential["secretAccessKey"], step2Result["date"],
        region, service);
    // 署名を計算する.
    signature = hmacSHA256(step2Result["stringToSign"],
        signature, "hex");

    // authorizationを返却.
    return ALGORITHM + " Credential=" + credential["accessKey"]
        + "/" + step2Result["credentialScope"]
        + ", SignedHeaders=" + step1Result["signedHeaders"]
        + ", Signature=" + signature;
}

/////////////////////////////////////////////////////
// 外部定義.
/////////////////////////////////////////////////////
exports.getCredential = getCredential;
exports.createXAmzDate = createXAmzDate;
exports.signatureV4Step1 = signatureV4Step1;
exports.signatureV4Step2 = signatureV4Step2;
exports.signatureV4Final = signatureV4Final;

})();
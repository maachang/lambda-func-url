///////////////////////////////////////////////////////////
// AWS S3 REST API実装.
//
// aws sdk(v2) for javascriptだと、Lambdaコールドスタート時に
// おいて、読み込みに5000ミリ秒以上かかる.
//
// 代替えとして、S3 向けの REST APIが提供されているので、この
// 機能を利用してS3バケットのI/Oを行う.
///////////////////////////////////////////////////////////
(function() {
'use strict'

// frequireが設定されていない場合.
let frequire = global.frequire;
if(frequire == undefined) {
    // frequire利用可能に設定.
    require("../freqreg.js");
    frequire = global.frequire;
}

// httpsClient.
const httpsClient = frequire("./lib/httpsClient.js");

// signatureVersion4.
const awsSigV4 = frequire("./lib/awsSignatureV4.js");

// サービス名.
const SERVICE = 's3';

// nextMarker有無情報を格納するHTTPヘッダ名.
const NEXT_MARKER_NAME = "x-next-marker";

// リージョンを取得.
// region 対象のregionを設定します.
// 戻り値: リージョンが返却されます.
const getRegion = function(region) {
    if(region == undefined || region == null) {
        // 存在しない場合は東京リージョン.
        region = "ap-northeast-1";
    }
    return region;
}

// [GET系]s3Host名を生成.
// 仕様: https://{bucket}.s3-{region}.amazonaws.com/{prefix + object}.
// region= "us-east-1"の場合は `https://{bucket}.s3.amazonaws.com`
// bucket 対象のバケット名を設定(string).
// region 対象のregionを設定(string).
// 戻り値: host名返却.
const createGetS3Host = function(bucket, region) {
    // us-east-1の場合は、リージョン名は不要.
    if("us-east-1" == region) {
        return bucket + "." + SERVICE + ".amazonaws.com";
    }
    // それ以外はリージョン名は必要.
    return bucket + "." + SERVICE + "-" + region +
        ".amazonaws.com";
}

// [PUT系]s3Host名を生成.
// 仕様: https://s3-{region}.amazonaws.com/{bucket}/{prefix + object}.
// region= "us-east-1"の場合は `https://s3.amazonaws.com`
// region 対象のregionを設定(string).
// 戻り値: host名返却.
const createPutS3Host = function(region) {
    // us-east-1の場合は、リージョン名は不要.
    if("us-east-1" == region) {
        return SERVICE + ".amazonaws.com";
    }
    // それ以外はリージョン名は必要.
    return SERVICE + "-" + region + ".amazonaws.com";
}

// リクエストヘッダを作成.
// host 接続先のホスト名を設定します.
// 戻り値: リクエストヘッダ(object)が返却されます.
const createRequestHeader = function(host) {
    // hostは必須.
    return {
        "Host": host
    };
}

// AWSシグニチャーをセット.
// credential AWSクレデンシャルを設定します.
//   {accessKey: string, secretAccessKey: string,
//     sessionToken: string}
//   - accessKey アクセスキーが返却されます.
//   - secretAccessKey シークレットアクセスキーが返却されます.
//   - sessionToken セッショントークンが返却されます.
//                  状況によっては空の場合があります.
// region 対象のリージョンを設定します.
// key 取得対象のS3キー名を設定します.
// method HTTPメソッドを設定します.
// header リクエストヘッダを設定します.
// queryParams クエリーパラメータを設定します.
// payload リクエストBodyを設定します.
const setSignature = function(
    credential, region, key, method, header, queryParams,
    payload) {
    // クレデンシャルが指定されてない場合は
    // 環境変数からクレデンシャルを取得.
    if(credential == undefined || credential == null) {
        credential = awsSigV4.getCredential();
    }

    // シグニチャーV4を作成.
    let s1 = awsSigV4.signatureV4Step1(
        credential, method, key, queryParams, header, payload);
    let s2 = awsSigV4.signatureV4Step2(
        header, region, SERVICE, s1);
    awsSigV4.signatureV4Final(
        header, credential, region, SERVICE, s1, s2);
}

// xmlの１つの要素内容を取得.
// name xmlの取得対象タグ名を設定します. 
// xml 対象のXML(string)を設定します.
// b [pos] のArray条件を設定します.
// 戻り値 name指定タグに対するstringが返却されます.
const getXmlElement = function(name, xml, b) {
    const len = name.length;
    // 開始条件を取得.
    let p = xml.indexOf("<" + name + ">", b[0]);
    if(p == -1) {
        // 開始が存在しない場合はnull.
        return null;
    }
    // 開始位置をセット.
    let s = p + len + 2;
    b[0] = s;
    // 終了条件を取得.
    p = xml.indexOf("</" + name + ">", b[0]);
    if(p == -1) {
        // 終端が見つからない場合はエラー.
        throw new Error("\"" + name +
            "\" terminator does not exist.")
    }
    // 次の検索位置をセット.
    b[0] = p + len + 3;
    // 開始位置と終了位置の文字列を取得.
    // 内容の変換にurlDecodeを利用する.
    return decodeURIComponent(
        xml.substring(s, p).trim());
}

// listObjectのXMLから必要な内容をJson変換.
// xml 対象のXML結果を取得.
// keyOnly trueの場合、Key名だけを取得します.
// 戻り値 json結果が返却されます.
const resultXmlToJson = function(xml, keyOnly) {
    let p, b, n, map;
    b = [0];
    const ret = [];
    // Key名だけ返却の場合.
    if(keyOnly == true) {
        while(true) {
            // コンテンツ条件を取得.
            p = xml.indexOf("<Contents>", b[0]);
            if(p == -1) {
                // 存在しない場合終了.
                break;
            }
            b[0] = p + 10;
            // Key条件を取得.
            n = getXmlElement("Key", xml, b);
            if(n == null) {
                // Key条件が存在しない場合.
                break;
            }
            // Key名だけ取得.
            ret[ret.length] = n;    
        }
        return ret;
    }
    while(true) {
        // コンテンツ条件を取得.
        p = xml.indexOf("<Contents>", b[0]);
        if(p == -1) {
            // 存在しない場合終了.
            break;
        }
        map = {};
        b[0] = p + 10;
        // Key条件を取得.
        n = getXmlElement("Key", xml, b);
        if(n == null) {
            // Key条件が存在しない場合.
            break;
        }
        map["key"] = n;
        // LastModified条件を取得.
        n = getXmlElement("LastModified", xml, b);
        if(n == null) {
            // LastModified条件が存在しない場合.
            break;
        }
        map["lastModified"] = n;
        // Size条件を取得.
        n = getXmlElement("Size", xml, b);
        if(n == null) {
            // Size条件が存在しない場合.
            break;
        }
        map["size"] = parseInt(n);
        ret[ret.length] = map;
        map = null;
    }
    return ret;
}

// nextMarkerが必要判断情報を返却.
// response 対象のresponseを設定します.
// xml 対象のxmlテキストを設定します.
const setNextMarker = function(response, xml) {
    // nextMarkerを取得
    const nextMarker = getXmlElement(
        "IsTruncated", xml, [0]);
    response.header[NEXT_MARKER_NAME] =
        nextMarker != null ?
            nextMarker.toLowerCase() : "false";
}

// bucket内容をencodeURIComponentする.
// bucket 対象のbucketを設定します.
// 戻り値: encodeURIComponent変換されたパスが返却されます.
const encodeURIToBucket = function(bucket) {
    bucket = bucket.trim();
    // bucket内に "%" すでにURLEncodeしている場合.
    if(bucket.indexOf("%") != -1) {
        // 処理しない.
        return bucket;
    }
    return encodeURIComponent(bucket);
}

// S3書き込みモード: スタンダード.
const PUT_S3_MODE_STANDARD = "STANDARD";

// S3書き込みモード: 低冗長化(RRS).
// ※standardの方が最近は安いので、使わない.
//const PUT_S3_MODE_REDUCED_REDUNDANCY = "REDUCED_REDUNDANCY";

// 指定S3オブジェクトをセット.
// response HTTPレスポンスヘッダ、ステータスが返却されます.
//          {status: number, header: {}}
//          - status レスポンスステータスが返却されます.
//          - header レスポンスヘッダが返却されます.
// region 対象のリージョンを設定します.
//        指定しない場合は 東京リージョン(ap-northeast-1)が
//        セットされます.
// bucket 対象のS3バケット名を設定します.
// key 対象のS3キー名を設定します.
// body 対象のBody情報を設定します.
// credential AWSクレデンシャルを設定します.
// 戻り値: 対象のS3オブジェクトが返却されます.
const putObject = async function(
    response, region, bucket, key, body, credential) {
    if(typeof(key) != "string" || key.length == 0) {
        throw new Error("key does not exist.");
    } else if(body == undefined || body == null) {
        throw new Error("body does not exist.");
    }
    // bucket, keyをencodeURL.
    bucket = encodeURIToBucket(bucket);
    key = httpsClient.encodeURIToPath(key);
    // リージョンを取得.
    region = getRegion(region);
    // ホスト名を取得.
    const host = createPutS3Host(region);
    // メソッド名.
    const method = "PUT";
    // ヘッダを取得.
    const header = createRequestHeader(host);
    // 文字列の場合、バイナリ変換.
    if(typeof(body) == "string") {
        body = Buffer.from(body);
    }
    // ヘッダ追加.
    header["content-length"] = "" + body.length;
    header["x-amz-storage-class"] = PUT_S3_MODE_STANDARD;

    // putの場合パスの先頭にbucket名をセットする.
    key = bucket + "/" + key;

    // シグニチャーを生成.
    setSignature(credential, region, key,
        method, header, null, body);

    // HTTPSクライアント問い合わせ.
    return await httpsClient.request(host, key, {
        method: method,
        header: header,
        body: body,
        response: response
    });    
}

// 指定S3オブジェクトを削除.
// response HTTPレスポンスヘッダ、ステータスが返却されます.
//          {status: number, header: {}}
//          - status レスポンスステータスが返却されます.
//          - header レスポンスヘッダが返却されます.
// region 対象のリージョンを設定します.
//        指定しない場合は 東京リージョン(ap-northeast-1)が
//        セットされます.
// bucket 対象のS3バケット名を設定します.
// key 対象のS3キー名を設定します.
// credential AWSクレデンシャルを設定します.
const deleteObject = async function(
    response, region, bucket, key, credential) {
    if(typeof(key) != "string" || key.length == 0) {
        throw new Error("key does not exist.");
    }
    // bucket, keyをencodeURL.
    bucket = encodeURIToBucket(bucket);
    key = httpsClient.encodeURIToPath(key);
    // リージョンを取得.
    region = getRegion(region);
    // ホスト名を取得.
    const host = createGetS3Host(bucket, region);
    // メソッド名.
    const method = "DELETE";
    // ヘッダを取得.
    const header = createRequestHeader(host);

    // keyの整理.
    key = key.trim();
    if(key.startsWith("/")) {
        key = key.substring(1).trim();
    }

    // シグニチャーを生成.
    setSignature(credential, region, key, method, header);

    // HTTPSクライアント問い合わせ.
    await httpsClient.request(host, key, {
        method: method,
        header: header,
        response: response
    });
}

// 指定S3オブジェクトを取得.
// response HTTPレスポンスヘッダ、ステータスが返却されます.
//          {status: number, header: {}}
//          - status レスポンスステータスが返却されます.
//          - header レスポンスヘッダが返却されます.
// region 対象のリージョンを設定します.
//        指定しない場合は 東京リージョン(ap-northeast-1)が
//        セットされます.
// bucket 対象のS3バケット名を設定します.
// key 対象のS3キー名を設定します.
// credential AWSクレデンシャルを設定します.
// 戻り値: 対象のS3オブジェクトが返却されます.
const getObject = async function(
    response, region, bucket, key, credential) {
    if(typeof(key) != "string" || key.length == 0) {
        throw new Error("key does not exist.");
    }
    // bucket, keyをencodeURL.
    bucket = encodeURIToBucket(bucket);
    key = httpsClient.encodeURIToPath(key);
    // リージョンを取得.
    region = getRegion(region);
    // ホスト名を取得.
    const host = createGetS3Host(bucket, region);
    // メソッド名.
    const method = "GET";
    // ヘッダを取得.
    const header = createRequestHeader(host);

    // keyの整理.
    key = key.trim();
    if(key.startsWith("/")) {
        key = key.substring(1).trim();
    }

    // シグニチャーを生成.
    setSignature(credential, region, key, method, header);

    // HTTPSクライアント問い合わせ.
    return await httpsClient.request(host, key, {
        method: method,
        header: header,
        response: response
    });
}

// 指定S3オブジェクトのメタデータを取得.
// response HTTPレスポンスヘッダ、ステータスが返却されます.
//          {status: number, header: {}}
//          - status レスポンスステータスが返却されます.
//          - header レスポンスヘッダが返却されます.
// region 対象のリージョンを設定します.
//        指定しない場合は 東京リージョン(ap-northeast-1)が
//        セットされます.
// bucket 対象のS3バケット名を設定します.
// key 対象のS3キー名を設定します.
// credential AWSクレデンシャルを設定します.
const headObject = async function(
    response, region, bucket, key, credential) {
    if(typeof(key) != "string" || key.length == 0) {
        throw new Error("key does not exist.");
    }
    // bucket, keyをencodeURL.
    bucket = encodeURIToBucket(bucket);
    key = httpsClient.encodeURIToPath(key);
    // リージョンを取得.
    region = getRegion(region);
    // ホスト名を取得.
    const host = createGetS3Host(bucket, region);
    // メソッド名.
    const method = "HEAD";
    // ヘッダを取得.
    const header = createRequestHeader(host);

    // keyの整理.
    key = key.trim();
    if(key.startsWith("/")) {
        key = key.substring(1).trim();
    }

    // シグニチャーを生成.
    setSignature(credential, region, key, method, header);

    // HTTPSクライアント問い合わせ.
    await httpsClient.request(host, key, {
        method: method,
        header: header,
        response: response
    });
}

// 指定S3バケット+プレフィックスのリストを取得.
// １度に取得できるサイズは最大1000件.
// response HTTPレスポンスヘッダ、ステータスが返却されます.
//          {status: number, header: {}}
//          - status レスポンスステータスが返却されます.
//          - header レスポンスヘッダが返却されます.
// region 対象のリージョンを設定します.
//        指定しない場合は 東京リージョン(ap-northeast-1)が
//        セットされます.
// bucket 対象のS3バケット名を設定します.
// prefix 対象のS3プレフィックス名を設定します.
// options {maxKeys: number, delimiter: string, marker: string}
//   - maxKeys 最大読み込み件数を設定します.
//       設定しない場合1000がセットされます.
//   - delimiter 取得階層の範囲を設定します.
//       "/" を設定した場合は指定prefixの階層のみを閲覧します.
//   - marker 前のlistObject処理で response.header["x-next-marker"]
//            情報がtrueの場合、一番最後の取得したKey名を設定します.
//   - keyOnly trueの場合Key名だけ取得します.
// credential AWSクレデンシャルを設定します.
// 戻り値: リスト情報が返却されます.
//         options.keyOnly == true以外の場合.
//         [{key: string, lastModified: string, size: number} ... ]
//         - key: オブジェクト名.
//         - lastModified: 最終更新時間(yyyy/MM/ddTHH:mm:ssZ).
//         - size: ファイルサイズ.
//         options.keyOnly == trueの場合.
//         [key, key, ...]
//         Arrayに取得Key一覧が返却されます.
const listObject = async function(
    response, region, bucket, prefix, options, credential) {
    if(typeof(prefix) != "string") {
        throw new Error("prefix does not exist.");
    }
    // optionsが未設定.
    if(options == undefined || options == null) {
        options = {};
    }
    // bucket, prefixをencodeURL.
    bucket = encodeURIToBucket(bucket);
    prefix = httpsClient.encodeURIToPath(prefix);
    // リージョンを取得.
    region = getRegion(region);
    // ホスト名を取得.
    const host = createGetS3Host(bucket, region);
    // メソッド名.
    const method = "GET";
    // ヘッダを取得.
    const header = createRequestHeader(host);

    // prefixの整理.
    prefix = prefix.trim();
    if(prefix.startsWith("/")) {
        prefix = prefix.substring(1).trim();
    }

    // 最大読み込み数を数字変換.
    options.maxKeys = options.maxKeys|0;
    if(options.maxKeys <= 0 || options.maxKeys >= 1000) {
        options.maxKeys = 1000;
    }

    // パラメータをセット.
    let urlParams = {
        "encoding-type": "url", // レスポンスオブジェクトのエンコードタイプ.
        "max-keys": options.maxKeys, // 最大読み込み件数(default 1000 max 1000).
        "prefix": prefix // 読み込みプレフィックス.
    }

    // delimiterが設定されている場合.
    if(typeof(options.delimiter) == "string") {
        urlParams["delimiter"] = options.delimiter;
    }
    
    // markerが設定されている場合.
    if(typeof(options.marker) == "string") {
        urlParams["marker"] = options.marker;
    }

    // パラメータをセット.
    urlParams = httpsClient.convertUrlParams(urlParams);

    // シグニチャーを生成.
    setSignature(credential, region, "", method, header,
        urlParams);

    // HTTPSクライアント問い合わせ.
    const xml = (await httpsClient.request(host, "", {
        method: method,
        header: header,
        urlParams: urlParams,
        response: response
    })).toString();

    // ステータスが400以上の場合.
    if(response.status >= 400) {
        // 空返却.
        return [];
    }

    // nextMarkerが必要判断情報を返却.
    setNextMarker(response, xml);

    // xmlのリスト情報をJSON変換.
    return resultXmlToJson(xml, options.keyOnly);
}

/////////////////////////////////////////////////////
// 外部定義.
/////////////////////////////////////////////////////
exports.NEXT_MARKER_NAME = NEXT_MARKER_NAME;
exports.putObject = putObject;
exports.deleteObject = deleteObject;
exports.getObject = getObject;
exports.headObject = headObject;
exports.listObject = listObject;

})();
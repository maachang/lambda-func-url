///////////////////////////////////////////////
// S3 client ユーティリティ.
///////////////////////////////////////////////
(function() {
'use strict'

// frequireが設定されていない場合.
let frequire = global.frequire;
if(frequire == undefined) {
    // frequire利用可能に設定.
    require("../../freqreg.js");
}

// s3restApi.
const s3 = frequire("./lib/s3restApi.js");

// バケット名が指定されない場合は、環境変数で定義された
// バケット情報を利用する.
// bucket 設定バケット名を設定します.
// 戻り値: バケット名が返却されます.
const getBucketName = function(bucket) {
    // 空セットの場合.
    if(bucket == null || bucket == undefined ||
        bucket.length == 0) {
        // 環境変数から取得.
        bucket = process.env["MAIN_S3_BUCKET"];
        if(bucket == null || bucket == undefined ||
            bucket.length == 0) {
            throw new Error("Bucket name is empty.");
        }
    }
    return bucket;
}

// S3Clientを取得.
// region 対象のリージョンを設定します.
// 戻り値: S3Clientが返却されます.
const create = function(region) {

    /////////////////////////////////////////////////////
    // オブジェクト群.
    /////////////////////////////////////////////////////
    const ret = {};

    // 条件を指定してS3Bucket+Prefixのリスト情報を取得.
    // bucket 対象のbucket名を設定します.
    // prefix 対象のprefix名を設定します.
    // 戻り値: リスト情報が返却されます.
    //         [{key: string, lastModified: string, size: number} ... ]
    //         - key: オブジェクト名.
    //         - lastModified: 最終更新時間(yyyy/MM/ddTHH:mm:ssZ).
    //         - size: ファイルサイズ.
    ret.getList = async function(bucket, prefix) {
        // バケット名を取得.
        bucket = getBucketName(bucket);
        // bucketとprefix名の分離.
        const response = {};
        // リスト取得.
        const ret = await s3.listObject(
            response, region, bucket, prefix);
        // レスポンスステータスが400以上の場合エラー.
        if(response.status >= 400) {
            console.error("## [ERROR: " + response.status +
                "]getList bucket: " + bucket +
                " prefix: " + prefix);
            throw e;
        }
        return ret;
    }


    // 条件を指定してS3Bucket+Prefixのメタ情報を取得.
    // bucket 対象のbucket名を設定します.
    // prefix 対象のprefix名を設定します.
    // key 対象のkey名を設定します.
    // 戻り値: 処理結果のpromiseが返却されます.
    ret.headObject = async function(bucket, prefix, key) {
        // バケット名を取得.
        bucket = getBucketName(bucket);
        // prefixとkeyを統合.
        const originKey = key;
        if(prefix != null && prefix != undefined) {
            key = prefix + "/" + key;
        }
        const response = {};
        // オブジェクト取得.
        const ret = await s3.headObject(
            response, region, bucket, key);
        // レスポンスステータスが400以上の場合エラー.
        if(response.status >= 400) {
            console.error("## [ERROR: " + response.status +
                "]headObject bucket: " + bucket + " prefix: " +
                prefix + " key: " + originKey);
            throw e;
        }
        return ret;
    };

    // 条件を指定してS3Bucket+PrefixのKey情報を取得.
    // bucket 対象のbucket名を設定します.
    // prefix 対象のprefix名を設定します.
    // key 対象のkey名を設定します.
    // 戻り値: 処理結果のpromiseが返却されます.
    ret.getObject = async function(bucket, prefix, key) {
        // バケット名を取得.
        bucket = getBucketName(bucket);
        // prefixとkeyを統合.
        const originKey = key;
        if(prefix != null && prefix != undefined) {
            key = prefix + "/" + key;
        }
        const response = {};
        // オブジェクト取得.
        const ret = await s3.getObject(
            response, region, bucket, key);
        // レスポンスステータスが400以上の場合エラー.
        if(response.status >= 400) {
            console.error("## [ERROR: " + response.status +
                "]getObject bucket: " + bucket + " prefix: " +
                prefix + " key: " + originKey);
            throw e;
        }
        return ret;
    };

    // 条件を指定してS3Bucket+PrefixのKey情報を文字列で取得.
    // bucket 対象のbucket名を設定します.
    // prefix 対象のprefix名を設定します.
    // key 対象のkey名を設定します.
    // 戻り値: 処理結果のpromiseが返却されます.
    ret.getString = async function(bucket, prefix, key) {
        return (await ret.getObject(bucket, prefix, key))
            .toString();
    }

    // 条件を指定してS3Bucket+Prefix+Key情報にBodyをセット.
    // bucket 対象のbucket名を設定します.
    // prefix 対象のprefix名を設定します.
    // key 対象のkey名を設定します.
    // body 対象のbody情報を設定します.
    ret.putObject = async function(bucket, prefix, key, body) {
        // バケット名を取得.
        bucket = getBucketName(bucket);
        // prefixとkeyを統合.
        const originKey = key;
        if(prefix != null && prefix != undefined) {
            key = prefix + "/" + key;
        }
        const response = {};
        // bodyをput.
        await s3.putObject(
            response, region, bucket, key, body);
        // レスポンスステータスが400以上の場合エラー.
        if(response.status >= 400) {
            console.error("## [ERROR: " + response.status +
                "]putObject bucket: " + bucket + " prefix: " +
                prefix + " key: " + originKey);
            throw e;
        }
    }

    // 条件を指定してS3Bucket+Prefix+Key情報を削除.
    // bucket 対象のbucket名を設定します.
    // prefix 対象のprefix名を設定します.
    // key 対象のkey名を設定します.
    ret.deleteObject = async function(bucket, prefix, key) {
        // バケット名を取得.
        bucket = getBucketName(bucket);
        // prefixとkeyを統合.
        const originKey = key;
        if(prefix != null && prefix != undefined) {
            key = prefix + "/" + key;
        }
        const response = {};
        // オブジェクト削除.
        await s3.deleteObject(
            response, region, bucket, key);
        // レスポンスステータスが400以上の場合エラー.
        if(response.status >= 400) {
            console.error("## [ERROR: " + response.status +
                "]deleteObject bucket: " + bucket + " prefix: " +
                prefix + " key: " + originKey);
            throw e;
        }
    }
    return ret;
}

/////////////////////////////////////////////////////
// 外部定義.
/////////////////////////////////////////////////////
exports.create = create;

})();
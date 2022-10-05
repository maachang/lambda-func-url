///////////////////////////////////////////////
// S3 client ユーティリティ.
///////////////////////////////////////////////
(function() {
'use strict'

// aws-sdk javascript V2.
const AWS = require('aws-sdk');

// 文字デコード.
const _TEXT_DECODE = new TextDecoder();

// S3Clientを取得.
// region 対象のリージョンを設定します.
// 戻り値: S3Clientが発行されたPromiseが返却されます.
const create = function(region) {
    return new Promise((resolve) => {
        // ローカルのS3Clientを取得.
        resolve(_s3OriginClientObject(new AWS.S3({
            region: _region(region)
        })));
    })
    .catch((e) => {
        console.error("## [ERROR]new AWS.S3 region: " +
            _region(region));
        throw e;
    });
}

// 設定リージョンが存在しない場合`東京`を設定するようにする.
const _region = function(region) {
    if(region == undefined || region == null) {
    // 指定が無い場合は東京をセット.
    region = "ap-northeast-1";
    }
    return region;
}

// S3パラメータを生成.
const _createS3Params = function(bucket, prefix, key, body) {
    let ret = {};
    if(bucket != undefined && bucket != null) {
        ret.Bucket = bucket;
    }
    if(prefix != undefined && prefix != null) {
        ret.Prefix = prefix;
    }
    if(key != undefined && key != null) {
        ret.Key = key;
    }
    if(body != undefined && body != null) {
        ret.Body = body;
    }
    return ret;
}

// S3Clientオブジェクトを取得.
const _s3OriginClientObject = function(s3cl) {

    /////////////////////////////////////////////////////
    // オブジェクト群.
    /////////////////////////////////////////////////////
    const ret = {};

    // 条件を指定してS3Bucket+Prefixのリスト情報を取得.
    // bucket 対象のbucket名を設定します.
    // prefix 対象のprefix名を設定します.
    // 戻り値: 処理結果のpromiseが返却されます.
    ret.getList = function(bucket, prefix) {
        return s3cl.listObjects(
            _createS3Params(bucket, prefix)
        ).promise()
        .then((data) => {
            // Contents[n].keyを取得し 今回指定したprefixを
            // 除いた条件で返却.
            const list = data.Contents;
            const len = list.length;
            const ret = [];
            for(let i = 0; i < len; i ++) {
                ret[i] = list[i].Key.substring(
                    prefix.length + 1);
            }
            return ret;
        })
        .catch((e) => {
            console.error("## [ERROR]getList bucket: " +
                bucket + " prefix: " + prefix);
            throw e;
        });    
    }

    // 条件を指定してS3Bucket+PrefixのKey情報を取得.
    // bucket 対象のbucket名を設定します.
    // prefix 対象のprefix名を設定します.
    // key 対象のkey名を設定します.
    // 戻り値: 処理結果のpromiseが返却されます.
    ret.getObject = function(bucket, prefix, key) {
        const originKey = key;
        if(prefix != null && prefix != undefined) {
            key = prefix + "/" + key;
        }
        return s3cl.getObject(
            _createS3Params(bucket, null, key)
        ).promise()
        .catch((e) => {
            console.error("## [ERROR]getObject bucket: " +
                bucket + " prefix: " + prefix + " key: " + originKey);
            throw e;
        });    
    };

    // 条件を指定してS3Bucket+PrefixのKey情報を文字列で取得.
    // bucket 対象のbucket名を設定します.
    // prefix 対象のprefix名を設定します.
    // key 対象のkey名を設定します.
    // 戻り値: 処理結果のpromiseが返却されます.
    ret.getString = function(bucket, prefix, key) {
        return ret.getObject(bucket, prefix, key)
        .then((data) => {
            return _TEXT_DECODE.decode(data.Body)
        });
    }

    // 条件を指定してS3Bucket+Prefix+Key情報にBodyをセット.
    // bucket 対象のbucket名を設定します.
    // prefix 対象のprefix名を設定します.
    // key 対象のkey名を設定します.
    // body 対象のbody情報を設定します.
    // 戻り値: 処理結果のpromiseが返却されます.
    ret.putObject = function(bucket, prefix, key, body) {
        const originKey = key;
        if(prefix != null && prefix != undefined) {
            key = prefix + "/" + key;
        }
        return s3cl.putObject(
            _createS3Params(bucket, null, key, body)
        ).promise()
        .catch((e) => {
            console.error("## [ERROR]putObject bucket: " +
                bucket + " prefix: " + prefix + " key: " + originKey);
            throw e;
        });
    }

    // 条件を指定してS3Bucket+Prefix+Key情報を削除.
    // bucket 対象のbucket名を設定します.
    // prefix 対象のprefix名を設定します.
    // key 対象のkey名を設定します.
    // 戻り値: 処理結果のpromiseが返却されます.
    ret.deleteObject = function(bucket, prefix, key) {
        const originKey = key;
        if(prefix != null && prefix != undefined) {
            key = prefix + "/" + key;
        }
        return s3cl.deleteObject(
            _createS3Params(bucket, null, key)
        ).promise().catch((e) => {
            console.error("## [ERROR]deleteObject bucket: " +
                bucket + " prefix: " + prefix + " key: " + originKey);
            throw e;
        })
    }

    return ret;
}

/////////////////////////////////////////////////////
// 外部定義.
/////////////////////////////////////////////////////
exports.create = create;

})();
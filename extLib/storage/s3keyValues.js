//////////////////////////////////////////////////////////
// S3のKeyValue構造を利用したKeyValue情報管理を行います.
//////////////////////////////////////////////////////////
(function() {
'use strict'

//
// AWSのS3は、基本的にKeyValue形式です.
// 
// AWSのS3は、容量単価として 1TByteで 約25$(東京リージョン)と非常に安い.
// ただS3の1blockが128kbyte単位なので、1byteであっても最低128kbyteとなる.
// しかし1TByteで月25$なので、128kbyteの1オブジェクトは 月$0.0000025 と
// 非常に安価だ(たとえば10万データ=$0.25=1USD:140円で月額約35円)
//
// 一方でRDSを使った場合最低(mysql, t3-micro, 20Gbyteの１台で月額約3000円
// ちょい)とバージョンアップ等のメンテナンス費用やレプリケーション等、
// 非常に高くついてしまう.
//
// ある程度使いやすいS3を使ったKeyValue形式のものを作成する事で、非常に
// 安価なデータ管理が行える仕組みが作れる可能性があると言えます.
//

// aws-sdk javascript V2.
const AWS = require('aws-sdk');

// インデックスであるKey=base64(value)の条件を取得.
const getIndexKeyValueName = function(key, value) {
    // valueが空でない場合.
    if(value != null && value != undefined) {
        // valueを文字列変換.
        value = "" + value;
        // 文字列が存在する場合.
        if(value.length > 0) {
            // base64変換.
            value = Buffer.from("" + value).toString('base64');
            const len = value.length;
            // base64の最後の`=`を除外.
            for(var i = len - 1; i >= 0; i --) {
                if(value[i] != "=") {
                    value = value.substring(0, i + 1);
                    break;
                }
            }
        }
    // valueが存在しない場合.
    } else {
        value = "";
    }
    // ={key}={base64(value)}
    return "=" +
        key +
        "=" +
        value;
}

// S3パラメータを作成.
// bucketName s3バケット名を設定します.
// prefixName s3プレフィックス名を設定します.
// tableName 対象のテーブル名を設定します.
// keys 対象のKey郡 {key: value .... } を設定します.
// 戻り値: S3パラメータが返却されます.
const getS3Params = function(
    bucketName, prefixName, tableName, keys) {
    let count = 0;
    const list = [];
    // keysを["={key}=base64{keys[key]}", ...] に生成.
    for(let key in keys) {
        list[count ++] = getIndexKeyValueName(
            key, keys[key]);
    }
    // keys = zeroの場合はエラー.
    if(count == 0) {
        throw new Error("No index key is set");
    }
    // keysをソート.
    list.sort();
    // 基本プレフィックスが存在しない.
    let keyName = null;
    if(prefixName == undefined || prefixName == null) {
        keyName = tableName;
    // 基本プレフィックスが存在する.
    } else {
        keyName = prefixName + "/" + tableName;
    }
    // １つのKeyに直結.
    const len = list.length;
    for(let i = 0; i < len; i ++) {
        keyName += "/" + list[i];
    }
    // BucketとKeyを登録.
    return {Bucket: bucketName, Key: keyName};
}

// 設定リージョンが存在しない場合`東京`を設定するようにする.
const getRegion = function(options) {
    if(options == undefined || options == null) {
        // iptionsが無い場合は、東京リージョンを返却.
        return "ap-northeast-1";
    }
    const region = options["region"];
    if(region == undefined || region == null) {
        // 指定が無い場合は東京をセット.
        return "ap-northeast-1";
    }
    return region;
}


// オブジェクト生成処理.
// bucket 対象のS3バケット名を設定します.
// prefix 対象のプレフィックス名を設定します.
// options 対象のオプション群を設定します.
//         {region: string} S3先のリージョンを設定します.
//         設定してない場合は 東京リージョンが設定されます.
const create = function(bucket, prefix, options) {
    // 基本バケット名.
    let bucketName = null;

    // 基本プレフィックス名.
    let prefixName = null;

    // S3Client.
    let s3Client = null;

    // 初期設定.
    (function() {
        // bucket名が設定されていない.
        if(typeof(bucket) != "string") {
            throw new Error("S3 bucket name is not set.");
        }

        // bucket名の整形.
        let flg = false;
        bucket = bucket.trim();
        // s3:// などの条件が先頭に存在する場合.
        let p = bucket.indexOf("://");
        if(p != -1) {
            // 除外.
            bucket = bucket.substring(p + 3);
            flg = true;
        }
        // 終端の / が存在する場合.
        if(bucket.endsWith("/")) {
            // 除外.
            bucket = bucket.substring(0, bucket.length - 1);
            flg = true;
        }
        // 除外があった場合trimをかける.
        if(flg) {
            bucket = bucket.trim();
        }

        // prefixの整形.
        if(typeof(prefix) != "string") {
            // 設定されていない場合.
            prefix = undefined;
        }  else {
            // prefixの整形.
            flg = false;
            prefix = prefix.trim();
            // 開始に / が存在する場合.
            if(prefix.startsWith("/")) {
                // 除外.
                prefix = prefix.substring(1);
                flg = true;
            }
            // 終端に / が存在する場合.
            if(prefix.endsWith("/")) {
                // 除外.
                prefix = prefix.substring(0, prefix.length - 1);
                flg = true;
            }
            // 除外があった場合trimをかける.
            if(flg) {
                prefix = prefix.trim();
            }
        }
        // 条件セット.
        bucketName = bucket;
        prefixName = prefix;
        // s3接続設定を行う.
        s3Client = new AWS.S3({
            region: getRegion(options)
        });
    })();

    // オブジェクト.
    const ret = {};

    // put.
    // tableName 対象のテーブル名を設定します.
    // keys インデックスキー {key: value ... } を設定します.
    // value 出力する内容(json)を設定します.
    ret.put = function(tableName, keys, value) {
        return exrequire("storage/jsonb.js")
        .then((jsonb) => {
            const params = getS3Params(
                bucketName, prefixName, tableName, keys);
            params.Body = jsonb.encode(value);
            return s3Client.putObject(params).promise()
            .catch((e) => {
                console.error("## [ERROR] _putValue bucket: " +
                    params.Bucket + " key: " + params.Key);
                throw e;
            });    
        })
    }

    // get.
    // tableName 対象のテーブル名を設定します.
    // keys インデックスキー {key: value ... } を設定します.
    // 戻り値: 検索結果(json)が返却されます.
    ret.get = function(tableName, keys) {
        return s3Client.putObject(
            getS3Params(
                bucketName, prefixName, tableName, keys))
        .promise()
        .catch(() => {
            return null; 
        })
        .then((value) => {
            return exrequire("storage/jsonb.js")
            .then((jsonb) => {
                return jsonb.decode(value);
            });
        });
    }

    // delete.
    // tableName 対象のテーブル名を設定します.
    // keys インデックスキー {key: value ... } を設定します.
    // 戻り値: 削除に成功した場合 trueが返却されます.
    ret.delete = function(tableName, keys) {
        return s3Client.deleteObject(
            getS3Params(
                bucketName, prefixName, tableName, keys))
        .promise()
        .catch(() => {
            return false;
        })
        .then(() => {
            return true;
        });
    }

    return ret;
}

/////////////////////////////////////////////////////
// 外部定義.
/////////////////////////////////////////////////////
exports.create = create;

})();

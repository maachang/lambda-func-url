///////////////////////////////////////////////////////////////////////
// S3のKeyValueStorage構造を利用したKeyValue情報管理を行います.
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
///////////////////////////////////////////////////////////////////////
(function() {
'use strict'

// frequireが設定されていない場合.
let frequire = global.frequire;
if(frequire == undefined) {
    // frequire利用可能に設定.
    require("../../freqreg.js");
    frequire = global.frequire;
}

// s3restApi.
const s3 = frequire("./lib/s3restApi.js");

// convb.
const convb = frequire("./lib/storage/convb.js");

// convb => jsonbエンコード.
const convbEncode = function(value) {
    const bin = [];
    convb.encodeValue(bin, value);
    return Buffer.from(bin);
}

// convb => jsonbデコード.
const convbDecode = function(bin) {
    const pos = [0];
    return convb.decodeValue(pos, bin);
}

// インデックスである `=Key=base64(value)` の条件を取得.
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

// オブジェクト生成処理.
// prefix 対象のプレフィックス名を設定します.
//        未設定(undefined)の場合、prefixは""(空)となります.
// options {bucket: string, region: string}
//        - bucket 対象のS3バケット名を設定します.
//          未設定(undefined)の場合、環境変数 "MAIN_S3_BUCKET" 
//          で設定されてるバケット名が設定されます.
//        - region 対象のリージョンを設定します.
//          未設定(undefined)の場合東京リージョン(ap-northeast-1)
//          が設定されます.
const create = function(prefix, options) {
    // 基本バケット名.
    let bucketName = null;

    // 基本プレフィックス名.
    let prefixName = null;

    // リージョン名.
    let regionName = null;

    // optionsが設定されていない場合.
    if(options == undefined || options == null) {
        options = {};
    }

    // bucket名が設定されていない.
    if(typeof(options.bucket) != "string") {
        // バケットから空セット.
        // 環境変数から取得.
        options.bucket = process.env["MAIN_S3_BUCKET"];
        if(options.bucket == null || options.bucket == undefined ||
            options.bucket.length == 0) {
            throw new Error("Bucket name is empty.");
        }
    } else {
        // bucket名の整形.
        let flg = false;
        options.bucket = options.bucket.trim();
        // s3:// などの条件が先頭に存在する場合.
        let p = options.bucket.indexOf("://");
        if(p != -1) {
            // 除外.
            options.bucket = bucket.substring(p + 3);
            flg = true;
        }
        // 終端の / が存在する場合.
        if(options.bucket.endsWith("/")) {
            // 除外.
            options.bucket = options.bucket.substring(0, bucket.length - 1);
            flg = true;
        }
        // 除外があった場合trimをかける.
        if(flg) {
            options.bucket = bucket.trim();
        }
    }

    // prefixの整形.
    if(typeof(prefix) != "string") {
        // 設定されていない場合.
        prefix = undefined;
    } else {
        // prefixの整形.
        let flg = false;
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
    // メンバー変数条件セット.
    prefixName = prefix;
    bucketName = options.bucket;
    regionName = options.region;
    options = undefined;
    prefix = undefined;
    
    // オブジェクト.
    const ret = {};

    // put.
    // tableName 対象のテーブル名を設定します.
    // keys インデックスキー {key: value ... } を設定します.
    // value 出力する内容(json)を設定します.
    // 戻り値: trueの場合設定に成功しました.
    ret.put = async function(tableName, keys, value) {
        const pm = getS3Params(
            bucketName, prefixName, tableName, keys);
        value = convbEncode(value);
        const response = {};
        const ret = await s3.putObject(
            response, regionName, pm.Bucket, pm.Key, value);
        return response.status <= 299;
    }

    // get.
    // tableName 対象のテーブル名を設定します.
    // keys インデックスキー {key: value ... } を設定します.
    // 戻り値: 検索結果(json)が返却されます.
    //         情報取得に失敗した場合は null が返却されます.
    ret.get = async function(tableName, keys) {
        const pm = getS3Params(
            bucketName, prefixName, tableName, keys);
        const response = {};
        const bin = await s3.getObject(
            response, regionName, pm.Bucket, pm.Key);
        return response.status >= 400 ?
            null: convbDecode(bin);
    }

    // delete.
    // tableName 対象のテーブル名を設定します.
    // keys インデックスキー {key: value ... } を設定します.
    // 戻り値: trueの場合削除に成功しました.
    ret.delete = async function(tableName, keys) {
        const pm = getS3Params(
            bucketName, prefixName, tableName, keys);
        const response = {};
        await s3.deleteObject(
            response, regionName, pm.Bucket, pm.Key);
        return response.status <= 299;
    }

    return ret;
}

/////////////////////////////////////////////////////
// 外部定義.
/////////////////////////////////////////////////////
exports.create = create;

})();

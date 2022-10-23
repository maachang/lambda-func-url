/////////////////////////////////////////////////////
// ローカルファイルのenv定義を対応confファイルで反映する.
/////////////////////////////////////////////////////
(function(_g) {
'use strict';

// fs.
const fs = require("fs");

// fcipher.
const cip = require("./modules/fcipher.js");

// 未暗号のファイル拡張子.
const DEF_EXTENSION = ".env";

// 暗号済みのファイル拡張子.
const CIPHER_EXTENSION = ".envc";

// [環境変数]Env定義Confファイル名.
// 拡張子を除いて設定.
const ENV_TO_CONF_ENV_NAME = "LFU_ENV_CONF";

// [環境変数]暗号キー条件のKey条件.
const ENV_CIPHER_KEY = "LFUS_CIPHOER_KEY";

// [環境変数]暗号キー条件のPass条件.
const ENV_CIPHER_PASS = "LFUS_CIPHOER_PASS";

// 終端の=を取る.
const catLastEq = function(n) {
    const len = n.length;
    for(let i = len-1; i >= 0; i --) {
        if(n.charAt(i) != '=') {
            return n.substring(0, i + 1);
        }
    }
    return "";
}

// ファイル存在を取得.
// name 対象のファイル名を設定します.
// 戻り値: trueの場合、存在します.
const isFile = function(name) {
    try {
        return fs.statSync(name).isFile();
    } catch(e) {
        return false;
    }
}

// confEnvを暗号化するためのkeyコードを生成.
// このコードはランダムな値で生成されます.
// 引数はあくまで「乱数のヒント」となります.
// key 対象の文字列を設定します.
// pass 対象のパスを設定します.
// 戻り値: {key: string, pass: string}
// - key 対象のキーコードが設定されます.
// - pass 対象のパスコードが設定されます.
const getKeyCode = function(key, pass) {
    if(typeof(key) != "string") {
        key = "!@A$#%^&*()";
    }
    if(typeof(pass) != "string") {
        pass = "%^b*()!@#$";
    }
    // wordのキーとパスを生成.
    const resKey = [].concat(
        cip.fhash("_" + key, false), cip.fhash("@" + pass + "$", false));
    const resPass = [].concat(
        cip.fhash("$" + pass + "@", false), cip.fhash("_" + key, false));
    key = catLastEq(cip.benc(resKey, pass));
    key = key.substring(0, (key.length / 1.5)|0);
    // 戻り値.
    return {key: key,
        pass: catLastEq(cip.benc(resPass, key))};
}

// 指定confEnv情報を暗号化.
// value 暗号対象の confEnvを設定します.
// key 対象のキーコードを設定します.
// pass 対象のパスコードを設定します.
// 戻り値: 変換結果が返却されます.
const encodeCipher = function(value, key, pass) {
    if(typeof(value) != "string") {
        throw new Error("The cryptographic target does not exist.");
    } else if(typeof(key) != "string" || typeof(pass) != "string") {
        throw new Error(
            "The key or value to be encrypted does not exist.")
    }
    return cip.enc(value, cip.key(key, pass));
}

// 指定confEnv情報を復号化.
// value 暗号対象の confEnvを設定します.
// key 対象のキーコードを設定します.
// pass 対象のパスコードを設定します.
// 戻り値: 変換結果が返却されます.
const decodeCipher = function(value, key, pass) {
    if(typeof(value) != "string") {
        throw new Error("The decryption target does not exist.");
    } else if(typeof(key) != "string" || typeof(pass) != "string") {
        throw new Error(
            "The key or value to be decrypted does not exist.")
    }
    return cip.dec(value, cip.key(key, pass));
}

// ファイルをロード.
// fileName対象のファイル名を設定します.
const loadFile = function(fileName) {
    if(typeof(fileName) != "string") {
        throw new Error("filename does not exist.")
    }
    return fs.readFileSync(fileName);
}

// ロードConfEnvを反映.
// file 対象のConfEnvファイル内容を設定します.
const flushConfEnv = function(file) {
    if(typeof(file) != "string") {
        throw new Error("file content does not exist.")
    }
    file = JSON.parse(file);
    for(let k in file) {
        prodess.env[k] = file[k];
    }
}

// 環境変数に設定されているConfEnv名を取得.
// 戻り値: 環境変数に定義されているconfEnv名が返却されます.
const getEnvToConfEnvName = function() {
    return process.env[ENV_TO_CONF_ENV_NAME];
}

// confEnvファイルをロード.
// fileName 対象のconfEnv(拡張子抜き)を設定します.
// key 対象のキーコードを設定します.
// pass 対象のパスコードを設定します.
const loadConfEnv = function(fileName, key, pass) {
    if(typeof(fileName) != "string") {
        // ファイル名が存在しない場合環境変数から取得.
        fileName = getEnvToConfEnvName()
    }
    // 暗号化されたconfEnvが存在する場合.
    if(isFile(fileName + CIPHER_EXTENSION)) {
        // 暗号キーやパスが存在しない場合環境変数から取得.
        if(typeof(key) != "string" || typeof(pass) != "string") {
            key = process.env[ENV_CIPHER_KEY];
            pass = process.env[ENV_CIPHER_PASS];
        }
        const file = loadFile(fileName + CIPHER_EXTENSION);
        file = decodeCipher(file, key, pass);
        flushConfEnv(file);
    // confEnvが存在する場合.
    } else if(isFile(fileName + DEF_EXTENSION)) {
        const file = loadFile(fileName + DEF_EXTENSION);
        flushConfEnv(file);
    // 存在しない場合.
    } else {
        throw new Error("Specified name '" +
            fileName + "' is not a confEnv file.");
    }
}

// confEnvファイルを暗号化.
// fileName 対象のconfEnv(拡張子抜き)を設定します.
// key 対象のキーコードを設定します.
// pass 対象のパスコードを設定します.
// 戻り値: {src: string, dest: string}
//         - src 変換元のファイル名が設定されます.
//         - dest 変換先のファイル名が設定されます.
const encodeCipherConfEnv = function(fileName, key, pass) {
    if(typeof(fileName) != "string") {
        // ファイル名が存在しない場合環境変数から取得.
        fileName = getEnvToConfEnvName();
        // ファイル名が存在しない場合.
        if(typeof(fileName) != "string") {
            throw new Error("The target file name does not exist.");
        }
    }
    // confEnvが存在する場合.
    if(isFile(fileName + DEF_EXTENSION)) {
        const file = loadFile(fileName + DEF_EXTENSION);
        // 暗号キーやパスが存在しない場合環境変数から取得.
        if(typeof(key) != "string" || typeof(pass) != "string") {
            key = process.env[ENV_CIPHER_KEY];
            pass = process.env[ENV_CIPHER_PASS];
        }
        // 暗号化.
        file = encodeCipher(file, key, pass);
        // 暗号化拡張子で保存する.
        fs.writeFileSync(fileName + CIPHER_EXTENSION, file);
    } else {
        throw new Error("Specified name '" +
            fileName + "' is not a confEnv file.");
    }
    return {
        src: fileName + DEF_EXTENSION,
        dest: fileName + CIPHER_EXTENSION
    };
}

// 暗号化したconfEnvファイルを復号化.
// fileName 対象のconfEnv(拡張子抜き)を設定します.
// key 対象のキーコードを設定します.
// pass 対象のパスコードを設定します.
// 戻り値: {src: string, dest: string}
//         - src 変換元のファイル名が設定されます.
//         - dest 変換先のファイル名が設定されます.
const decodeCipherConfEnv = function(fileName, key, pass) {
    if(typeof(fileName) != "string") {
        // ファイル名が存在しない場合環境変数から取得.
        fileName = getEnvToConfEnvName();
        // ファイル名が存在しない場合.
        if(typeof(fileName) != "string") {
            throw new Error("The target file name does not exist.");
        }
    }
    // 暗号化されたconfEnvが存在する場合.
    if(isFile(fileName + CIPHER_EXTENSION)) {
        const file = loadFile(fileName + CIPHER_EXTENSION);
        // 暗号キーやパスが存在しない場合環境変数から取得.
        if(typeof(key) != "string" || typeof(pass) != "string") {
            key = process.env[ENV_CIPHER_KEY];
            pass = process.env[ENV_CIPHER_PASS];
        }
        // 復号化.
        file = decodeCipher(file, key, pass);
        // confEnv拡張子で保存する.
        fs.writeFileSync(fileName + DEF_EXTENSION, file);
    } else {
        throw new Error("Specified name '" +
            fileName + "' is not a confEnv file.");
    }
    return {
        src: fileName + CIPHER_EXTENSION,
        dest: fileName + DEF_EXTENSION
    };
}

/////////////////////////////////////////////////////
// 外部定義.
/////////////////////////////////////////////////////
exports.getKeyCode = getKeyCode;
exports.getEnvToConfEnvName = getEnvToConfEnvName;
exports.loadConfEnv = loadConfEnv;
exports.encodeCipherConfEnv = encodeCipherConfEnv;
exports.decodeCipherConfEnv = decodeCipherConfEnv;

})(global);
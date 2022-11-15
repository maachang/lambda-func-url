# [LFU]lambda-func-url

## LFUの作成動機

AWSのLambdaにおいて昨今(2022年ちょっと)から `関数URL` と言うものがサポートされ、これにより `AWS-Gateway` + `Lambda` の定義を必要とせずに URLから当該Lambdaが呼び出せると言う仕組みが提供されている.

詳しくは、以下のように

### [関数URLの仕様内容](https://docs.aws.amazon.com/ja_jp/lambda/latest/dg/urls-invocation.html)

> https：//{関数URLのID}.lambda-url.{region}.on.aws

のような形のEND-POINTが設定できて、ブラウザ等から「パブリック」アクセスが実現できるものである.

これに伴い、以下のように対象のLambdaに `関数URL` を定義すると対象EndPointのURLが定義されるので以下のように

~~~js
exports.handler = async function(event) {
    return {
        'statusCode': 200,
        'body': JSON.stringify(event, null, "  ");
    }
}
~~~

実装すると、関数URLにアクセスすると、以下のような内容が呼び出し元に返却される.

### eventパラメータ

~~~json
{
  "version": "2.0",
  "routeKey": "$default",
  "rawPath": "/",
  "rawQueryString": "param1=hoge",
  "headers": {
    "x-amzn-trace-id": "Root=1-624efbbc-13cb25d619ceadfe0cb469bc",
    "x-forwarded-proto": "https",
    "host": "hogehoge.lambda-url.ap-northeast-1.on.aws",
    "x-forwarded-port": "443",
    "x-forwarded-for": "1.2.3.4",
    "accept": "*/*",
    "user-agent": "curl/7.68.0"
  },
  "queryStringParameters": {
    "param1": "hoge"
  },
  "requestContext": {
    "accountId": "anonymous",
    "apiId": "hogehoge",
    "domainName": "hogehoge.lambda-url.ap-northeast-1.on.aws",
    "domainPrefix": "hogehoge",
    "http": {
      "method": "GET",
      "path": "/",
      "protocol": "HTTP/1.1",
      "sourceIp": "1.2.3.4",
      "userAgent": "curl/7.68.0"
    },
    "requestId": "21e5f8ee-bf99-4643-8f19-386978967955",
    "routeKey": "$default",
    "stage": "$default",
    "time": "07/Apr/2022:14:57:00 +0000",
    "timeEpoch": 1649343420924
  },
  "isBase64Encoded": false
} 
~~~

このような形で lamda実行main(index.js)のevent が渡され `"event.rawPath": "/"` のアクセスパス＋ファイル名が取れるので、たとえば定義された関数URLのURLに対して、当該設定されたLambdaの `関数URL` の後に指定されたURLが、ここから取得できる.

なので１つの `関数URL` を割り当てたLambdaに対して、この `event.rawPath` の挙動を１つのLambdaで差配できるわけで、これを「S3バケット+プレフィックスにあるコンテンツ」や「対象Githubリポジトリに直接アクセス」できるようにすれば `serverless` で安価なWebアプリ環境が利用する事ができるようになる.

また懸念点としては、Lambdaの関数URLの実験では、現状コールドスタートが 起動まで5～6秒ぐらい経過している遅すぎる問題がある.

ただ、ping応答用の最小の呼び出しを、URLからコールドスタートでアクセスすると600ミリ秒程度で返却されたので、別途６秒かかる原因を調査した。

その結果 `aws-sdk(v2)` を初めて読み込む時に５秒ぐらいかかっており、これがボトルネックとなっていた.

ただ、AWS環境で他のAWSにアクセスするには `aws-sdk` が必須であるので、代替えとしては `aws-sdk(v3)` があり、これはS3だけ利用したいなど、個別の呼び出しができるが、lambdaの場合別途利用モジュールを登録する必要があるので、導入が面倒であるが、別途 `ES6` でなくとも `require` からも読み込めるようだ
> const { SESClient, CloneReceiptRuleSetCommand } = require("@aws-sdk/client-ses");

あとコールドスタート対応として `プロビジョニングされた同時実行` の設定が２０１９年頃にサポートされ、これによりコールドスタートを回避できるが、一方で`有効とした場合、時間単位でコストが発生` するので、通常より高くなり無料枠外の料金発生が発生し、またLambdaは実行時単位でコストが発生するので、全く動かさなくても`一定期間コスト発生`するので、600ミリ秒が許容できるなら、利用しないほうが良さそう.

ただ現状ではLFUでは `aws-sdkを使わない実装` を行っていく(aws sdk3もそれなりに大きいのでrest apiを利用する)事で、コールドスタート1000ミリ程度で利用可能にしていきたい.

### aws-sdkを使わず s3 rest api利用の結果

- aws-sdk(v2)を利用したコールドスタート
  > Duration: 6378.64 ms Billed Duration: 6379 ms Memory Size: 128 MB Max Memory Used: 81 MB Init Duration: 136.09 ms

- s3 rest api呼び出しでのコールドスタート
  > Duration: 1169.33 ms Billed Duration: 1170 ms Memory Size: 128 MB Max Memory Used: 61 MB Init Duration: 140.79 ms

aws-sdk(v2)の呼び出しをしないだけで、速度が 約18%に短縮された.

aws-sdk(v2)の呼び出しをしないだけで、メモリ利用量が 約75%に収まった.

コールドスタート時に 1秒ならば、使う人数が少ない社内システムなら、この `関数URL`機能で「あまり問題ない」と思うし、何より運用コストの安さは、非常に魅力的であると言える.

## LFU概要

LFUは `aws lambda` に対して `lang = javascript` に対して、対応するものとする.

LFUは、昨今導入された `関数URL`を利用して、AWSのLambdaで管理するjsファイルやコンテンツに対して、S3バケット+プレフィックスやGithubのリポジトリ以下の内容を参照取得できることで、AWS Lambdaとコンテンツの分離管理が可能とする仕組みを提供する.

また `関数URL` を使う事で `Api Gateway + Lambda` よりも「安価なコスト」で、Webアプリ環境を提供する「簡易的な仕組み」を提供する.

あと、簡単な応答確認として URL + `/~ping` パス実行で最短な応答確認ができる(コールドスタート回避用).

また、grequire, s3require, frequire のキャッシュをクリアしたい場合は `/~clearRequireCache` パス実行を行います.

また上記だと curl等のHTTPリクエスト送信が必要となるが、他のAWSサービスから LFU環境にpingアクセスする場合は

~~~json
{
  "rawPath": "/~ping"
}
~~~

をパラメータとしてセットする事で同様の対応が行える.

## LFUを利用したaws Lambda側の実装について

LFUのAWS Lambda側の実装は非常にシンプル具体的には `src/index.js` で、作成時のAWS Lambda関数定義に対して以下のように実装する事で対応できる.

### index.js

~~~js
//////////////////////////////////////////////////////////
// lambda main.
// 対象のLambdaのindex.jsを置き換えてください.
//////////////////////////////////////////////////////////
(function() {
'use strict'

// lambda main.
exports.handler = async (event, context) => {
    return await (require("./LFUSetup.js").start(
        event, filterFunc, originMime))
        (event, context);
};

// filterFunc.
// function(out, resState, resHeader, request);
//  out [0]にレスポンスBodyが設定されます.
//  resState: レスポンスステータス(httpStatus.js).
//  resHeader レスポンスヘッダ(httpHeader.js)
//  request Httpリクエスト情報.
//  戻り値: true / false.
//         trueの場合filter処理で処理終了となります.
const filterFunc = undefined;

// originMime.
// function(extention);
//  extention ファイルの拡張子を設定します.
//  戻り値: {type:string, gz: boolean}
//    - type: mimeTypeが設定されます.
//    - gz: gzip圧縮可能な場合は true.
const originMime = undefined;

})();
~~~

これをLambdaが自動生成した `index.js` を含む、[src](https://github.com/maachang/lambda-func-url/tree/main/src)ディレクトリ配下の全jsファイルLambda側の `/` パス以下に配置して `再デプロイ` することで実行環境の構築は完了となる.

また `require("./LFUSetup.js").start(evemt, filterFunc, originMime)` に対して、処理の拡張性を定義できる.

1. filterFunc<br>
  コンテンツ実行の事前処理を行いたい場合は設定する.<br>
  たとえば、何らかのアクセス認証を行いたい場合は、filterFuncを設定して行う.<br>
  function(out, resState, resHeader, request);<br>
   out Array[0]に返却対象の処理結果のレスポンスBodyを設定します.<br>
   resState: レスポンスステータス(httpStatus.js).<br>
   resHeader レスポンスヘッダ(httpHeader.js).<br>
   request Httpリクエスト情報.<br>
   戻り値: true / false(boolean).<br>
          trueの場合filter処理で処理終了となります.<br>
  また、環境変数 `FILTER_FUNCTION`でも設定が可能.

2. originMime<br>
  拡張MimeTypeを設定.<br>
  function(extends)が必要で、拡張子の結果に対して戻り値が {type: mimeType, gz: boolean}を返却する必要がある(対応しない場合は undefinedで設定しない).<br>
  また、環境変数 `ORIGIN_MIME`でも設定が可能.

これら定義に対して `環境変数` で定義する場合は `exports` で返却が必要(require系呼び出し).<br>
なので、この場合は以下のような形での実装が必要となる.

~~~javascript
exports["function"] = function(out, resState, resHeader, request) {
    return false;
}
~~~

このように `exports` の返却条件に `["function"]` を設定する必要があるので注意.

## LFUの内部で利用されるメインのパラメータについて

次に `return await (require("./LFUSetup.js").start())(event, contxt);` で渡されたevent引数は以下のように、変換されて実行処理に設定される.

~~~js
// HTTPリクエスト.
request = {
    // httpメソッド(GET, POSTなど).
    method: string
    // プロトコル(HTTP/1.1など)
    ,protocol: string
    // EndPointパス(/から始まるパス).
    ,path: string
    // リクエストヘッダ(httpHeader.jsオブジェクト).
    ,header: (httpHeader.js)
    // [method=GET] => queryParamsと同じもの.
    // [method=POST] => requestBody内容が展開されたもの(Formデータ or JSON).
    ,params: object
    // URLパラメータ(URLの?xxx=yyy&zzz=hoge...が解析された内容).
    ,queryParams: object
    // EndPoint(string)パスに対するファイルの拡張子.
    // undefinedの場合、js実行結果を返却させる.
    ,extension: string
    // 拡張子mimeType変換用(getMimeType(extension=拡張子)).
    ,mimeType: function(extension)
    // 元のeventをセット.
    ,srcEvent: object
};
~~~

この情報は以下

- filterFunc
- jhtmlテンプレート実行.
- js実行ファイル

のHTTPリクエスト情報として設定される.

## LFUで必要な環境変数[env]定義説明

LFUでは、Lambdaで[環境変数](https://docs.aws.amazon.com/ja_jp/lambda/latest/dg/configuration-envvars.html)が利用できる.

LFU では、以下`環境変数` の設定が必要条件となっている.

- `MAIN_EXTERNAL`<br>
  [環境変数]メインで利用するrequireやrequest先.<br>
  この条件は[必須]条件.<br>
  `MAIN_EXTERNAL`=`s3`: S3をメインで利用する場合.<br>
  `MAIN_EXTERNAL`=`git`: github repogitoryをメインで利用する場合.<br>

- `REQUEST_PATH`<br>
  [環境変数]request時のカレントパス設定.<br>
  この条件は[必須]条件<br>
  設定方法は<br>
  　`REQUEST_PATH`=`currentPath`<br>
  とリクエストに対する `currentPath` を設定.<br>

- `S3_CONNECT`<br>
  ※ この定義を行わないと `s3require` は利用できません.
  [環境変数]s3require, s3request時の接続設定.<br>
  　`MAIN_EXTERNAL`=`s3` の場合は、この条件は[必須]条件.<br>
  設定方法は<br>
  　`S3_CONNECT`=`requirePath, region`<br>
  とカンマ[,]単位で区切って設定する.<br>
  - `requirePath` [必須]は、s3のrequireでの `currentPath` を設定.<br>
  - `reagion` [任意]は、AWSのリージョンを設定.<br>
    最後の "region" は、省略された場合、東京リージョン「ap-northeast-1」になる.<br>

- `GIT_CONNECT`<br>
  ※ この定義を行わないと `grequire` は利用できません.
  [環境変数]grequire, grequest時の接続設定.<br>
  　`MAIN_EXTERNAL`=`git` の場合は、この条件は[必須]条件.<br>
  設定方法は<br>
  　`GIT_CONNECT`=`organization, repo, branch, requirePath, token`<br>
  とカンマ[,]単位で区切って設定する.<br>
  - `organization` [必須]Githubの `organization` を設定.<br>
  - `repo` [必須]Githubの `repogitory` を設定.<br>
  - `branch` [必須]Githubの `branch` を設定.<br>
    古い場合は `master` 比較的新しい場合は `main` がMainBranchとなる.<br>
  - `requirePath` [必須]githubのrequireでの `currentPath` を設定.<br>
  - `token` [任意]githubの対象リポジトリが `private` の場合必要となる.<br>

- `CACHE_TIMEOUT`<br>
  [環境変数]grequire, grequestのキャッシュタイムアウト値.<br>
  キャッシュタイムアウト値を `ミリ秒単位` で設定.<br>
  この値は[任意]で、デフォルト値は30000ミリ秒.<br>

- `NONE_CACHE`<br>
  [環境変数]grequire, grequestのキャッシュを行わない場合設定.<br>
  キャッシュをしない場合は `NONE_CACHE`=`true` と設定.<br>
  この値は[任意]で、デフォルト値はキャッシュON(false)となる.<br>

- `NONE_GZIP`<br>
  [環境変数]GZIP圧縮を行わない場合設定.<br>
  GZIP圧縮をしない場合は `NONE_GZIP`=`true` と設定.<br>
  この値は[任意]で、デフォルト値はGZIPはON(false)となる.<br>

- `MAIN_S3_BUCKET`<br>
  [環境変数]MAINバケット名.<br>
  メインで利用するS3Bucket名を設定.<br>
  この値は[任意]ですが、メインS3バケット名を設定しておくとハードコーディングが不要となるので設定を推奨する.<br>

- `FILTER_FUNCTION`<br>
  [環境変数]filterFunc読み込み先を指定.<br>
  この条件はexrequire(getEnv("FILTER_FUNCTION"), true, "")で取得されます(カレントパスなし、キャッシュなし).<br>
  また `start` メソッドで渡された場合は、そちらが優先となります.<br>
  この環境変数によって、ターゲットとなるストレージでfilterFuncが実装できます(Lambda側の実装に定義する必要がない).<br>

- `ORIGIN_MIME`<br>
  [環境変数]originMime読み込み先を指定.<br>
  この条件はexrequire(getEnv("ORIGIN_MIME"), true, "")で取得されます(カレントパスなし、キャッシュなし).<br>
  また `start` メソッドで渡された場合は、そちらが優先となります.<br>
  この環境変数によって、ターゲットとなるストレージでoriginMimeが実装できます(Lambda側の実装に定義する必要がない).<br>

また、環境変数の値は `global.ENV` で取得可能.

## LFUのexternalリソース利用概要

これまでの説明に対する `LFU` での `externalリソース` の利用概要について説明する.

externalのリソース定義は、先程の `環境変数` でリソース利用先の定義を行う.

例として、GitHubを `externalリソース` 利用先とした場合.

- MAIN_EXTERNAL = `git`

こうすることで `externalリソースの接続先` は

- GIT_CONNECT

で、ここで設定された値

＜例＞

- GIT_CONNECT = "maachang, testLFU, main, extLib"
  > https://raw.githubusercontent.com/maachang/testLFU/main/extLib

  が `exrequire` の読み込みカレントディレクトリとなる.

### exrequire説明と対象リポジトリのディレクトリ構成例

```
[maachang/testLFU/main]
  |
  +- [extLib]
       |
       +- [storage]
           |
           +- convb.js
           |
           +- jsonb.js
           |
           +- s3client.js
           |
           +- s3KeyValues.js
```

先程のgithubリポジトリ内容が上記構成になってたとして、これに対して `extLib/storage/jsonb.js` が `extLib/storage/convb.js` を `require` したいとする.

この場合
> https://raw.githubusercontent.com/maachang/testLFU/main/extLib

にあるように `exrequire` のカレントパスとなっており

### extLib/storage/jsonb.js

~~~js
const convb = await exrequire("storage/convb.js");
~~~

とすることで `カレントパス` 以降の条件指定で `require` に対してソースコードの環境依存が無くす事ができる.

このようにexternalリソースのjsリソースは、requireの代わりに `exrequire` を利用する必要がある.

### externalリソースのrequestコンテンツ

次にexternalリソースのrequestコンテンツについて説明する.

ここでのrequestコンテンツとは `関数URL` でアクセスされた時の `"event.rawPath": "/"` と連動先を指す.

実際の設定方法は `環境変数` の

- REQUEST_PATH

を利用する.

＜例＞

- REQUEST_PATH = "public"
  > https://raw.githubusercontent.com/maachang/testLFU/main/public

  が `requestカレントパス` となる.

ここで `関数URL` のURLが

> https：//{関数URLのID}.lambda-url.{region}.on.aws/test.html

とした場合、実際のrequestコンテンツは
> https://raw.githubusercontent.com/maachang/testLFU/main/public/test.html

が読み込まれる.

このような形で lambdaの `関数URL` を利用した githubリポジトリ環境利用が行える.

## LFUのrequestコンテンツについて

LFUでは、現状3つの requestコンテンツが利用できる.

1. staticコンテンツ

2. [dynamic] js実行コンテンツ

3. [dynamic] jhtmlテンプレートコンテンツ

### 1. staticコンテンツ

staticコンテンツ = 静的コンテンツは `html` や `javascript` や `css` や `jpeg` などのファイルコンテンツを指すもの.

また補足として Lambdaの使用上 レスポンスの最大値は `6MByte` となっており、大きな情報の静的コンテンツの利用は別のサービスを利用する必要がある.

### 2. js実行コンテンツ

主に `json返却` を想定して利用する.

拡張子は `.lfu.js` を設定する.

また、これを呼び出す場合は「拡張子なし」で行う.

実装方法は以下の通り.

＜例＞

#### public/test.lfu.js

~~~js
(function() {
'use strict'

// 実行メイン.
// exports.handler or exports.execute でメイン実行定義が行える.
// resStatus レスポンスステータス(httpStatus.js)が設定される.
// resHeader レスポンスヘッダ(httpHeader.js)が設定される.
// request リクエスト情報が設定される.
// 戻り値: レスポンスBody情報を返却.
//         JSON形式で返却する場合は {} や [] で始まる Object型を返却.
//         文字列を返却すると html形式の返却となる.
//         返却形式を制御したい場合は resHeader.setContentTypeでmimeTypeを
//         設定する事で対応できる.
exports.handler = function(resStatus, resHeader, request) {
// 以下の形でも定義が可能.
// exports.execute = function(resStatus, resHeader, request)

    return {hello: "urlPath: " + request.path};
}

})();
~~~

実行結果

~~~js
content-type: application/json

{"hello": "urlPath: /test.js"}
~~~

### 3. jhtmlテンプレートコンテンツ

主に `html返却` を想定して利用する.

拡張子は `.js.html` を設定する.

また、これを呼び出す場合は「.jhtml」で行う.

実装方法は以下の通り.

＜例＞

#### public/test.js.html

~~~html
<%# テスト jhtml %>
<html>
  <body>
    ${ "path: " + $request.path }
  </body>
</html>
~~~

実行結果

~~~html
content-type: text/html

<html>
  <body>
    path: /test.jhtml
  </body>
</html>
~~~

jhtmlテンプレートは、サーバー側で動的なHTMLを作成するためのテンプレート.

注意として、URLから呼び出す場合の拡張子は `.jhtml`

一方、コンテンツのファイルは `js.html` とファイルの拡張子とURLの拡張子は違うので注意が必要.

#### jhtmlカスタムタグ

テンプレートとして利用できるカスタムタグは以下の通り.

- `<% ... %>`<br>
   基本的な組み込みタグ情報
- `<%= ... %>`<br>
   実行結果をhtmlとして出力する組み込みタグ.
- `<%# ... %>`<br>
   コメント用の組み込みタグ.
- `${ ... }`<br>
   実行結果をテンプレートとして出力する組み込みタグ.<br>
   内容は `<%= ... %>` と機能的に同じ.
   ただ利用推奨としては、変数出力時に利用する.

またjsのプログラムは `...` の部分に記載が可能.

＜例＞

~~~html

<%
let list = [1, 2, 3, 4, 5];
%>

<%# リスト一覧を出力する. %>
<%for(let i = 0; i < list.length; i ++) {%>
  ${list[i]}<br>
<%}%>

~~~

結果

~~~bash
  1<br>
  2<br>
  3<br>
  4<br>
  5<br>
~~~

#### jhtml組み込み変数

jhtmlでは、以下のような組込変数が存在する.

- `$out` = function(string)<br>
  stringをhtmlとして出力するFunction.<br>
- `$params` = object<br>
  getまたはpostで渡されたパラメータ情報.<br>
  - getパラメータの場合 {key: value} のような形で格納される.<br>
  - postパラメータの場合 `application/x-www-form-urlencoded`の場合は {key: value} のような形で格納される.<br>
    また`application/json` の場合は、JSONで渡された内容が格納される.<br>
- `$request` = object<br>
  リクエストオブジェクトが設定される.<br>
- `$status` = httpStatus.js<br>
  レスポンス用のステータスが設定される.<br>
- `$response` = httpHeader.js<br>
  レスポンス用のHTTPヘッダが設定される.<br>

このように、Webアプリを作成する上で最低限の機能を `LFU` は提供する.

## LFUのrequireの扱い

通常の node.js や Lambda(node.js) では `require` を使って、node.jsのライブラリや、外部ライブラリを読み込む.

一方で LFU環境では3つの条件から requireする事ができる.

1. s3
2. github repogitory.
3. lambda上のlocal環境.

これに対して、それぞれ

1. s3 = s3require
2. github repogitory = grequire
3. lambda上 = require

が用意されているが、この場合問題となるものがある.

### require問題1 `s3require` 及び `grequire` から `3. lambda上のlocal環境` の jsファイル読み込みが面倒

`require` は実行するjsの格納位置をカレントパスとするので、これに対して `s3require` や `grequire` で読み込んだjsファイル内で `require` を利用したい場合、フルパス以外からのlambdaローカル内の jsファイルを読み込むのが難しい問題がある.

### require問題2 `s3require` 及び `grequire` で読み込むjsファイルから `require` が利用できない

もう１つの問題として s3やgithubのjsファイルから `require` の利用ができないので、結果的にnode.jsのライブラリが利用できない点にある.

理由として、s3先の `s3require` github repogitory先の `grequire` 先のjsファイルの読み込んでjsとして実行させるために `vm.runInContext(...)` を利用しているが、ここで実行される jsファイル内では `require` が利用できなくなる（セキュリティ上).

### LFUでのrequire問題解決内容

これに対して、対応策として `frequire` を提供することで ２つの問題 `lambda上のlocal環境のJSファイル` の読み込みと、`require("vm")` 等の nodejsのライブラリの読み込みを可能としている.

ただし、この `frequire` は、通常利用する `require` と異なり、`frequire` を生成する `fregreq.js`が設定されている場所を、カレントディレクトリとして、読み込む方式となっている.

具体的に、以下環境を元に説明をしたい.

```
[root]
  |
  +--[cost]
  |   |
  |   +--monthCost.js
  |
  +--[lib]
  |   |
  |   +-- costCalc.js
  |   |
  |   +-- util.js
  |
  +-- fregreq.js
```

この環境で、通常の `require` を利用する場合 `/root/cost/monthCost.js` が `/root/lib/costCalc.js` を `require` で参照する場合は `require("../lib/costCalc.js")` と定義をする必要がある。

また `/root/lib/costCalc.js` が `/root/lib/util.js` を参照する場合は `require("./util.js")` を `require` で定義する必要がある.

一方LFU環境では `frequire` を提供する事で、上記の場合は `fregreq.js` が存在するのは `root` 直下にあるので、カレントパスは `root` となり、これに準じた呼び出しとなる.

`frequire` の場合、冒頭の説明で説明しなおすと `/root/cost/monthCost.js` が `/root/lib/costCalc.js` を `frequire` で参照する場合は カレントディレクトリが `[root]` なので `frequire("lib/costCalc.js")` として利用する事ができる.

またこれは Lambdaローカルに定義されている環境以外に `s3require` や `grequire` も カレントディレクトリ環境が設定されており、呼び出しに対して同じような形となっている。

また `frequire` は `s3require` や `grequire` のjsファイル内でも、`require` と違って利用する事ができる.

このような形で LFUの 各種 `require` は従来とは違うが、それぞれの分散したソースコードの読み込みに対して、最適な形で提供をしている.

## lambdaではこの環境変数を入れとくほうが良いらしい

> AWS_NODEJS_CONNECTION_REUSE_ENABLED=1

HTTPのKeepAliveが効くので、レスポンスが向上するんだとか.

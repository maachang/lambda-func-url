# [LFU]lambda-func-url

## LFU作成経緯

AWSのLambdaにおいて昨今(2022年ちょっと)から `関数URL` と言うものがサポートされ、これにより `AWS-Gateway` + `Lambda` の定義を必要とせずに URLから当該Lambdaが呼び出せると言う仕組みが提供されている.

詳しくは、以下のように

### [関数URLの仕様内容](https://docs.aws.amazon.com/ja_jp/lambda/latest/dg/lambda-urls.html)

> https：//{関数URLのID}.lambda-url.{region}.on.aws

のような形のEND-POINTが設定できて、ブラウザ等から「パブリック」アクセスが実現できるものである.

これに伴い、以下のように対象のLambdaに `関数URL` を定義すると対象EndPointのURLが定義されるので以下のように

~~~js
exports.handler = function(event) {
    return {
        'statusCode': 200,
        'body': JSON.stringify(event, null, "  ");
    }
}
~~~

実装すると、アクセスしたブラウザ側に対して以下の内容が返却される.

### event

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

こんな風に event から `"rawPath": "/"` のアクセスパス＋ファイル名が取れるので、たとえば定義された関数URLのURLに対して、当該設定されたLambdaの `関数URL` の後に指定されたURLが、ここから取得できるわけで、なので１つの `関数URL` を割り当てたLambdaに対して、この `event.rawPath` の挙動を１つのLambdaで差配できるわけで、これを「S3バケット+プレフィックスにあるコンテンツ」や、対象Githubリポジトリに直接アクセスできるようにすれば `serverless` なWebアプリ開発環境が便利で簡単にできる可能性がある.

なるべく `楽な形` で `serverless なframework` で `最小限の環境提供` たとえば、従来のserverless Frameworkを使うのではなく、terraformだけでLambdaの `serverless` 環境構築が実行できる形を作りたいと思う.

## LFU概要

LFUは `aws lambda` に対して `lang = javascript` に対して、対応するものとする.

LFUでは、AWSのLambdaで管理するjsファイルやコンテンツに対して、S3バケット+プレフィックスやGithubのリポジトリ以下の内容を参照取得できることで、AWS Lambdaとコンテンツの分離管理が可能となる.

現状では `serverless framework` と言うnodejsのnpmで、便利な仕組みが存在するが、この場合 `terraform + circleci` などの「よくある」管理体制で行おうとする場合、別途serverless frameworkを利用してデプロイすると言う条件をcircleciのyaml定義に記載が必要で、結果的に新しいデプロイ管理条件が１つ増える事になる.

経験上管理対象が増えると、シンプルなデプロイ環境を管理のほうが、扱いやすいし「ナレッジの共有」ができるわけで、条件が増えれば管理が面倒になるのは、当たり前の話である.

LFUでは、これら `serverless framework` のように一括で `aws lambda` の `service` 単位で管理するのではなく `aws lambda` から `S3bucket` や `github repogitory` にアクセスして、そこからjavascriptやHTTP関連のリソースを詠み込む形の `external` な情報にアクセスすることで `aws lambda` 側ではアクセス先を管理するだけで、実際のコンテンツ管理は `aws lambda` で管理しない(疎結合)で行う.

そして昨今導入された `関数URL` と合わせて、別に `serverless framework` を使って `api gateway` をトリガーとしたものでなく `LFU` では `関数URL` + `aws lambda` + `externalなリソース` とシンプルな管理が行える.

`LFU` では、このように現状の `serverless framework` を使わずに `external(s3, github)` なリソースに簡単にアクセスできるようにする事で、管理コストを楽にして、運用管理を楽にすることを目的とする.

また、個人的に `aws でserverless` な環境で webアプリを作成する場合、特別 `terraform` や `circleci` を使わずに、aws-console だけで完結できる仕組みとして、利用できるような `シンプルな仕組み` を提供できるようにしたいと思う.

## LFUを利用したaws Lambda側の実装について

LFUのAWS Lambda側の実装事態は非常に簡単で、作成時のAWS Lambda関数定義に対して以下のように実装する事で対応できる.

### index.js

~~~js
exports.handler async (event) => {
  return await (require("./LFUSetup.js").start())(event);
}
~~~

たったこれだけで、実装が完了できる.

また `require("./LFUSetup.js").start(arguments)` に対して、処理の拡張性を定義できる.

`start(arguments)` のパラメータは以下の内容が設定可能.

1. arguments[0]=filterFunc<br>
  コンテンツ実行の事前処理を行いたい場合は設定する.<br>
  たとえば、何らかのアクセス認証を行いたい場合は、filterFuncを設定して行う.<br>
  仕様: `filterFunc = function(resStatus, resHeader, params)`<br>
    - resStatus: httpStatus.jsのオブジェクトが設定される.<br>
      HTTPレスポンスステータスが変更された場合(200以外)、filterFunc実行結果が有効となる.<br>
    - resHeader: httpHeader.jsのオブジェクトが設定される.<br>
    - params: LFUStatus.jsでのparamsが設定される.<br>

2. arguments[1]=originMime<br>
  拡張MimeTypeを設定.<br>
  function(extends)が必要で、拡張子の結果に対して戻り値が {type: mimeType, gz: boolean}を返却する必要がある(対応しない場合は undefinedで設定しない).

### LFUの内部で利用されるメインのパラメータについて

次に `return await (require("./LFUSetup.js").start())(event);` で渡されたevent引数は以下のように、変換されて実行処理に設定される.

~~~js
// AWSLambdaの関数URLパラメータから必要な内容を取得.
params = {
    // httpメソッド(GET, POSTなど).
    method: string
    // EndPointパス(/から始まるパス).
    ,path: string
    // リクエストヘッダ(httpHeader.jsオブジェクト).
    ,requestHeader: (httpHeader.js)
    // リクエストパラメータ(URLの?xxx=yyy&zzz=hoge...が解析された内容).
    ,requestParams: object
    // EndPoint(string)パスに対するファイルの拡張子.
    // undefinedの場合、js実行結果を返却させる.
    ,extension: string
    // 拡張子mimeType変換用(getMimeType(extension=拡張子)).
    ,mimeType: function(extension)
    // 元のeventをセット.
    ,srcEvent: object
};
~~~

これらの値が先程の
- `filterFunc(httpStatus.jsオブジェクト, httpStatus.jsオブジェクト, params)` 

実行時のjsリクエスト
- `request.handler(httpStatus.jsオブジェクト, httpStatus.jsオブジェクト, params)`

  or

- `request.execute(httpStatus.jsオブジェクト, httpStatus.jsオブジェクト, params)`

に対して、第三引数の `params` に渡される.

## LFUで必要な環境変数[env]定義説明

LFUでは、Lambdaで[環境変数](https://docs.aws.amazon.com/ja_jp/lambda/latest/dg/configuration-envvars.html)が利用できる.

それら利用可能な `環境変数` として以下が定義可能です.

- `MAIN_EXTERNAL`<br>
  [環境変数]メインで利用するrequireやrequest先.<br>
  この条件は[必須]です.<br>
  `MAIN_EXTERNAL`=`s3`: S3をメインで利用する場合.<br>
  `MAIN_EXTERNAL`=`git`: github repogitoryをメインで利用する場合.<br>

- `REQUEST_PATH`<br>
  [環境変数]request時のカレントパス設定.<br>
  この条件は[必須]です<br>
  設定方法は<br>
  　`REQUEST_PATH`=`currentPath`<br>
  とリクエストに対する `currentPath` を設定します.<br>

- `S3_CONNECT`<br>
  [環境変数]s3require, s3request時の接続設定.<br>
  　`MAIN_EXTERNAL`=`s3` の場合は、この条件は[必須]です.<br>
  設定方法は<br>
  　`S3_CONNECT`=`requirePath, region`<br>
  とカンマ[,]単位で区切って設定します.<br>
  - `requirePath` [必須]は、s3のrequireでの `currentPath` を設定します.<br>
  - `reagion` [任意]は、AWSのリージョンを設定します.<br>
    最後の "region" は、省略された場合、東京リージョン「ap-northeast-1」になります.<br>

- `GIT_CONNECT`<br>
  [環境変数]grequire, grequest時の接続設定.<br>
  　`MAIN_EXTERNAL`=`git` の場合は、この条件は[必須]です.<br>
  設定方法は<br>
  　`GIT_CONNECT`=`organization, repo, branch, requirePath, token`<br>
  とカンマ[,]単位で区切って設定します.<br>
  - `organization` [必須]Githubの `organization` を設定します.<br>
  - `repo` [必須]Githubの `repogitory` を設定します.<br>
  - `branch` [必須]Githubの `branch` を設定します.<br>
    古い場合は `master` 比較的新しい場合は `main` がMainBranchです.<br>
  - `requirePath` [必須]githubのrequireでの `currentPath` を設定します.<br>
  - `token` [任意]githubの対象リポジトリが `private` の場合必要です.<br>

- `TIMEOUT`<br>
  [環境変数]grequire, grequestのキャッシュタイムアウト値.<br>
  キャッシュタイムアウト値を `ミリ秒単位` で設定します.<br>
  この値は[任意]で、デフォルト値は30000ミリ秒です.<br>

- `NONE_CACHE`<br>
  [環境変数]grequire, grequestのキャッシュを行わない場合設定します.<br>
  キャッシュをしない場合は `NONE_CACHE`=`true` と設定します.<br>
  この値は[任意]で、デフォルト値はキャッシュON(false)です.<br>

- `NONE_GZIP`<br>
  [環境変数]GZIP圧縮を行わない場合設定します.<br>
  GZIP圧縮をしない場合は `NONE_GZIP`=`true` と設定します.<br>
  この値は[任意]で、デフォルト値はGZIPはON(false)です.<br>

- `MAIN_S3_BUCKET`<br>
  [環境変数]MAINバケット名.<br>
  メインで利用するS3Bucket名を設定します.<br>
  この値は[任意]ですが、メインS3バケット名を設定しておくとハードコーディングが不要なので設定を推奨します.<br>

また、環境変数の値は `global.ENV` で取得可能です.

## LFUのexternalリソース利用概要

これまでの説明に対する `LFU` での `externalリソース` の利用について説明する.

まず `aws lambda` で「関数」を新規作成する。

名前は「管理可能な任意(把握できる名前)」で良く、ひとまず作成した後 [以下のように](#indexjs) メインである `index.js` に実装する事で、ひとまず実装は完了となる.

そして「関数URL」は有効にする必要があり、場合によっては `cross origin` をONに設定する必要もあるが、これにて表の `LFU` 設定は完了である.

次に [LFUの環境変数定義](#lfuで必要な環境変数env定義説明) で説明した内容、これが実際の `external` 先の設定であり、これらを明確に設定する必要がある.




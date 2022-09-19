# lambda-func-url

## 概要

AWSのLambdaにおいて昨今(2022年ちょっと)から `関数URL` と言うものがサポートされ、これにより `AWS-Gateway` + `Lambda` の定義を必要とせずに URLから当該Lambdaが呼び出せると言う仕組みが提供されている.

 https://tech.nri-net.com/entry/lambda_url

詳しくは、以下のように

 https://docs.aws.amazon.com/ja_jp/lambda/latest/dg/lambda-urls.html

>URL　https：//{関数URLのID}.lambda-url.{region}.on.aws

のような形のEND-POINTが設定できて、ブラウザ等から「パブリック」アクセスが実現できるものである。

これに伴い、以下のように対象のLambdaに `関数URL` を定義すると対象EndPointのURLが定義されるので以下のように

~~~js
exports.handler = function(event, context) {
    return {
        'statusCode': 200,
        'body': JSON.stringify(event, null, "  ");
    }
}
~~~

実装すると、アクセスしたブラウザ側に対して以下の内容が返却される。

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

こんな風に event から `"rawPath": "/"` が取れるので、たとえば定義された関数URLのURLに対して、当該設定されたLambdaの `関数URL` の後に指定されたURLが、ここから取得できるわけで、なので１つの `関数URL` を割り当てたLambdaに対して、この `event.rawPath` の挙動を１つのLambdaで差配できるわけで、これを「S3バケット+プレフィックスにあるコンテンツ」や、対象Githubリポジトリに直接アクセスできるようにすれば `serverless` なWeb開発が簡単にできるか可能性がある.

なるべく `楽な形` で `serverless なframework`  `最小限の環境` でLambdaの `serverless` 環境構築が実行できる形を作りたいと思う.

## lambda-func-urlの実装について




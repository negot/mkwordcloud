import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  Annotations,
  CfnOutput,
  Duration,
  RemovalPolicy,
  Stack,
  type StackProps,
  aws_apigatewayv2 as apigwv2,
  aws_apigatewayv2_integrations as integrations,
  aws_cloudfront as cloudfront,
  aws_cloudfront_origins as origins,
  aws_cloudwatch as cloudwatch,
  aws_dynamodb as dynamodb,
  aws_lambda as lambda,
  aws_lambda_nodejs as nodejs,
  aws_logs as logs,
  aws_s3 as s3,
  aws_s3_deployment as s3deploy,
} from 'aws-cdk-lib';
import type { Construct } from 'constructs';
import { DEFAULT_EXTENSION_ID, WS_STAGE_NAME } from './config.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

export interface WordcloudStackProps extends StackProps {
  /** 拡張機能ID。未指定なら context `extensionId`、さらに既定値。 */
  extensionId?: string;
  /** 表示Webアプリのビルド成果物(既定: packages/web/dist)。 */
  webDistPath?: string;
  /**
   * true にすると esbuild によるバンドルとWebアセットの読み込みを省く(テスト用)。
   * context `skipBundling=true` でも指定できる。
   */
  skipBundling?: boolean;
}

export class WordcloudStack extends Stack {
  constructor(scope: Construct, id: string, props: WordcloudStackProps = {}) {
    super(scope, id, props);

    const extensionId =
      props.extensionId ?? (this.node.tryGetContext('extensionId') as string | undefined) ?? DEFAULT_EXTENSION_ID;
    const skipBundling =
      props.skipBundling ?? ['true', true].includes(this.node.tryGetContext('skipBundling') as string | boolean);
    const webDist = props.webDistPath ?? resolve(ROOT, 'packages/web/dist');

    // ------------------------------------------------------------ DynamoDB
    const table = new dynamodb.Table(this, 'Table', {
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'ttl',
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // ------------------------------------------------------------ S3 + CloudFront
    const bucket = new s3.Bucket(this, 'WebBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const csp = [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      `connect-src 'self' https://*.execute-api.${this.region}.amazonaws.com wss://*.execute-api.${this.region}.amazonaws.com`,
      "base-uri 'none'",
      "frame-ancestors 'none'",
    ].join('; ');

    const headersPolicy = new cloudfront.ResponseHeadersPolicy(this, 'SecurityHeaders', {
      securityHeadersBehavior: {
        strictTransportSecurity: {
          accessControlMaxAge: Duration.days(365),
          includeSubdomains: true,
          override: true,
        },
        contentTypeOptions: { override: true },
        frameOptions: { frameOption: cloudfront.HeadersFrameOption.DENY, override: true },
        referrerPolicy: {
          referrerPolicy: cloudfront.HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN,
          override: true,
        },
        contentSecurityPolicy: { contentSecurityPolicy: csp, override: true },
      },
    });

    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultRootObject: 'index.html',
      priceClass: cloudfront.PriceClass.PRICE_CLASS_200,
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(bucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        responseHeadersPolicy: headersPolicy,
        compress: true,
      },
    });

    const webOrigin = `https://${distribution.distributionDomainName}`;
    const allowedOrigins = `${webOrigin},chrome-extension://${extensionId}`;

    // ------------------------------------------------------------ Lambda
    const logGroup = (name: string) =>
      new logs.LogGroup(this, `${name}Logs`, {
        retention: logs.RetentionDays.TWO_WEEKS,
        removalPolicy: RemovalPolicy.DESTROY,
      });

    const makeFunction = (
      name: string,
      entry: string,
      opts: { memorySize: number; timeout: Duration; environment: Record<string, string>; kuromojiDict?: boolean },
    ): lambda.Function => {
      const common = {
        runtime: lambda.Runtime.NODEJS_24_X,
        architecture: lambda.Architecture.ARM_64,
        memorySize: opts.memorySize,
        timeout: opts.timeout,
        environment: opts.environment,
        logGroup: logGroup(name),
      };
      if (skipBundling) {
        return new lambda.Function(this, name, {
          ...common,
          handler: 'index.handler',
          code: lambda.Code.fromInline('exports.handler = async () => ({ statusCode: 200 });'),
        });
      }
      return new nodejs.NodejsFunction(this, name, {
        ...common,
        entry: resolve(ROOT, entry),
        handler: 'handler',
        projectRoot: ROOT,
        depsLockFilePath: resolve(ROOT, 'package-lock.json'),
        bundling: {
          target: 'node24',
          minify: true,
          sourceMap: false,
          commandHooks: {
            beforeBundling: () => [],
            beforeInstall: () => [],
            // kuromoji の辞書を出力先の dict/ にコピーする
            afterBundling: (inputDir: string, outputDir: string) =>
              opts.kuromojiDict ? [`cp -R "${inputDir}/node_modules/kuromoji/dict" "${outputDir}/dict"`] : [],
          },
        },
      });
    };

    const wsHandler = makeFunction('WsHandler', 'packages/server/src/lambda/ws.ts', {
      memorySize: 1024,
      timeout: Duration.seconds(10),
      kuromojiDict: true,
      environment: {
        TABLE_NAME: table.tableName,
        ALLOWED_ORIGINS: allowedOrigins,
        DICT_PATH: '/var/task/dict',
      },
    });

    // ------------------------------------------------------------ WebSocket API
    const wsApi = new apigwv2.WebSocketApi(this, 'WsApi', {
      apiName: 'wordcloud-ws',
      connectRouteOptions: { integration: new integrations.WebSocketLambdaIntegration('WsConnect', wsHandler) },
      disconnectRouteOptions: { integration: new integrations.WebSocketLambdaIntegration('WsDisconnect', wsHandler) },
      defaultRouteOptions: { integration: new integrations.WebSocketLambdaIntegration('WsDefault', wsHandler) },
    });
    const wsStage = new apigwv2.WebSocketStage(this, 'WsStage', {
      webSocketApi: wsApi,
      stageName: WS_STAGE_NAME,
      autoDeploy: true,
      throttle: { rateLimit: 100, burstLimit: 200 },
    });

    const httpHandler = makeFunction('HttpHandler', 'packages/server/src/lambda/http.ts', {
      memorySize: 256,
      timeout: Duration.seconds(5),
      environment: {
        TABLE_NAME: table.tableName,
        ALLOWED_ORIGINS: allowedOrigins,
        WS_MANAGEMENT_ENDPOINT: `https://${wsApi.apiId}.execute-api.${this.region}.${this.urlSuffix}/${WS_STAGE_NAME}`,
      },
    });

    // 最小権限: 必要な操作だけをテーブルに許可する
    table.grant(
      wsHandler,
      'dynamodb:GetItem',
      'dynamodb:PutItem',
      'dynamodb:UpdateItem',
      'dynamodb:DeleteItem',
      'dynamodb:Query',
    );
    table.grant(
      httpHandler,
      'dynamodb:GetItem',
      'dynamodb:PutItem',
      'dynamodb:DeleteItem',
      'dynamodb:Query',
      'dynamodb:BatchWriteItem',
    );
    wsApi.grantManageConnections(wsHandler);
    wsApi.grantManageConnections(httpHandler);

    // ------------------------------------------------------------ HTTP API
    // CORS は Lambda 側(handleRest)で処理する。API Gateway の corsPreflight は http/https のOriginしか受け付けず、
    // chrome-extension:// のOriginを指定するとデプロイが失敗するため使わない。許可Originは Lambda の ALLOWED_ORIGINS で制限する。
    const httpApi = new apigwv2.HttpApi(this, 'HttpApi', {
      apiName: 'wordcloud-http',
      createDefaultStage: false,
    });
    new apigwv2.HttpStage(this, 'HttpStage', {
      httpApi,
      autoDeploy: true,
      throttle: { rateLimit: 20, burstLimit: 40 },
    });
    const httpIntegration = new integrations.HttpLambdaIntegration('HttpIntegration', httpHandler);
    httpApi.addRoutes({
      path: '/rooms',
      methods: [apigwv2.HttpMethod.POST, apigwv2.HttpMethod.OPTIONS],
      integration: httpIntegration,
    });
    httpApi.addRoutes({
      path: '/rooms/{code}',
      methods: [apigwv2.HttpMethod.GET, apigwv2.HttpMethod.DELETE, apigwv2.HttpMethod.OPTIONS],
      integration: httpIntegration,
    });
    httpApi.addRoutes({
      path: '/rooms/{code}/reset',
      methods: [apigwv2.HttpMethod.POST, apigwv2.HttpMethod.OPTIONS],
      integration: httpIntegration,
    });

    // ------------------------------------------------------------ Webアプリの配置
    const apiUrl = httpApi.apiEndpoint;
    const wsUrl = wsStage.url;
    new s3deploy.BucketDeployment(this, 'DeployWeb', {
      destinationBucket: bucket,
      distribution,
      distributionPaths: ['/*'],
      sources: [
        skipBundling || !existsSync(webDist)
          ? s3deploy.Source.data('index.html', '<!doctype html><title>placeholder</title>')
          : s3deploy.Source.asset(webDist),
        s3deploy.Source.jsonData('config.json', { apiUrl, wsUrl }),
      ],
    });
    if (!skipBundling && !existsSync(webDist)) {
      Annotations.of(this).addWarningV2(
        'wordcloud:web-dist-missing',
        'packages/web/dist がありません。先に `npm run build:web` を実行してください。',
      );
    }

    // ------------------------------------------------------------ CloudWatch
    for (const [name, fn] of [
      ['WsHandler', wsHandler],
      ['HttpHandler', httpHandler],
    ] as const) {
      new cloudwatch.Alarm(this, `${name}ErrorAlarm`, {
        metric: fn.metricErrors({ period: Duration.minutes(1), statistic: 'Sum' }),
        threshold: 1,
        evaluationPeriods: 3,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        alarmDescription: `${name} のエラーが3分連続で発生しています`,
      });
    }

    // ------------------------------------------------------------ Outputs
    new CfnOutput(this, 'WebUrl', { value: webOrigin });
    new CfnOutput(this, 'ApiUrl', { value: apiUrl });
    new CfnOutput(this, 'WsUrl', { value: wsUrl });
    new CfnOutput(this, 'ExtensionId', { value: extensionId });
  }
}

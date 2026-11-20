import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_EXTENSION_ID } from '../lib/config.js';
import { WordcloudStack } from '../lib/wordcloud-stack.js';

describe('WordcloudStack (NFR2〜NFR5)', () => {
  let template: Template;
  beforeAll(() => {
    const app = new App();
    const stack = new WordcloudStack(app, 'TestStack', {
      env: { account: '123456789012', region: 'ap-northeast-1' },
      skipBundling: true,
    });
    template = Template.fromStack(stack);
  });

  it('DynamoDB は オンデマンドで、TTL 属性 ttl が有効 (NFR3.2, NFR4.1)', () => {
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      BillingMode: 'PAY_PER_REQUEST',
      TimeToLiveSpecification: { AttributeName: 'ttl', Enabled: true },
      KeySchema: [
        { AttributeName: 'pk', KeyType: 'HASH' },
        { AttributeName: 'sk', KeyType: 'RANGE' },
      ],
    });
    template.hasResource('AWS::DynamoDB::Table', { DeletionPolicy: 'Delete' });
  });

  it('S3 は公開をすべてブロックする (NFR2.1)', () => {
    template.hasResourceProperties('AWS::S3::Bucket', {
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
    });
  });

  it('CloudFront は HTTPS へリダイレクトし、セキュリティヘッダーを付ける (NFR2.1)', () => {
    template.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: Match.objectLike({
        DefaultRootObject: 'index.html',
        DefaultCacheBehavior: Match.objectLike({ ViewerProtocolPolicy: 'redirect-to-https' }),
      }),
    });
    template.hasResourceProperties('AWS::CloudFront::ResponseHeadersPolicy', {
      ResponseHeadersPolicyConfig: Match.objectLike({
        SecurityHeadersConfig: Match.objectLike({
          FrameOptions: { FrameOption: 'DENY', Override: true },
          StrictTransportSecurity: Match.objectLike({ Override: true }),
        }),
      }),
    });
    const policies = template.findResources('AWS::CloudFront::ResponseHeadersPolicy');
    const csp = JSON.stringify(Object.values(policies)[0]);
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it('CORS は Lambda 側で許可Originを制限し、ワイルドカードを使わない。HTTP API に corsPreflight は無い (NFR2.6)', () => {
    const apis = template.findResources('AWS::ApiGatewayV2::Api', {
      Properties: { ProtocolType: 'HTTP' },
    });
    // API Gateway の corsPreflight は chrome-extension:// のOriginを受け付けずデプロイが失敗するため使わない
    expect(Object.values(apis)[0].Properties.CorsConfiguration).toBeUndefined();
    const fns = Object.values(template.findResources('AWS::Lambda::Function')) as Array<{
      Properties: { Environment?: { Variables?: Record<string, unknown> } };
    }>;
    const origins = fns
      .map((f) => JSON.stringify(f.Properties.Environment?.Variables?.ALLOWED_ORIGINS ?? ''))
      .filter((s) => s !== '""');
    expect(origins.length).toBe(2);
    for (const o of origins) {
      expect(o).toContain(`chrome-extension://${DEFAULT_EXTENSION_ID}`);
      expect(o).not.toContain('*');
    }
    const keys = Object.values(template.findResources('AWS::ApiGatewayV2::Route')).map(
      (r) => (r as { Properties: { RouteKey: string } }).Properties.RouteKey,
    );
    expect(keys).toEqual(
      expect.arrayContaining(['OPTIONS /rooms', 'OPTIONS /rooms/{code}', 'OPTIONS /rooms/{code}/reset']),
    );
    template.hasResourceProperties('AWS::ApiGatewayV2::Stage', {
      DefaultRouteSettings: { ThrottlingRateLimit: 20, ThrottlingBurstLimit: 40 },
    });
  });

  it('WebSocket API は3つのルートとスロットリングを持つ (NFR2.5)', () => {
    const routes = template.findResources('AWS::ApiGatewayV2::Route');
    const keys = Object.values(routes).map((r) => r.Properties.RouteKey);
    expect(keys).toEqual(expect.arrayContaining(['$connect', '$disconnect', '$default']));
    template.hasResourceProperties('AWS::ApiGatewayV2::Stage', {
      StageName: 'prod',
      DefaultRouteSettings: { ThrottlingRateLimit: 100, ThrottlingBurstLimit: 200 },
    });
  });

  it('Lambda は Node 24 / arm64 で、ログ保持は14日 (NFR3.3)', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      Runtime: 'nodejs24.x',
      Architectures: ['arm64'],
      MemorySize: 1024,
      Timeout: 10,
    });
    template.hasResourceProperties('AWS::Lambda::Function', { MemorySize: 256, Timeout: 5 });
    const groups = template.findResources('AWS::Logs::LogGroup');
    expect(Object.values(groups).some((g) => g.Properties.RetentionInDays === 14)).toBe(true);
  });

  it('DynamoDB の権限は必要な操作だけで、ワイルドカードや * リソースを使わない (NFR2.8)', () => {
    const policies = template.findResources('AWS::IAM::Policy');
    const statements = Object.values(policies).flatMap((p) => p.Properties.PolicyDocument.Statement as any[]);
    const ddb = statements.filter((s) => JSON.stringify(s.Action).includes('dynamodb:'));
    expect(ddb.length).toBeGreaterThanOrEqual(2);
    for (const s of ddb) {
      const actions: string[] = Array.isArray(s.Action) ? s.Action : [s.Action];
      for (const a of actions) expect(a).not.toMatch(/\*/);
      expect(s.Resource).not.toBe('*');
      expect(JSON.stringify(s.Resource)).not.toBe('"*"');
    }
    const manage = statements.filter((s) => JSON.stringify(s.Action).includes('execute-api:ManageConnections'));
    expect(manage.length).toBeGreaterThanOrEqual(2);
    for (const s of manage) expect(JSON.stringify(s.Resource)).toContain('@connections');
  });

  it('エラーアラームと出力 (NFR4.3, NFR5.2)', () => {
    template.resourceCountIs('AWS::CloudWatch::Alarm', 2);
    template.hasResourceProperties('AWS::CloudWatch::Alarm', {
      MetricName: 'Errors',
      Threshold: 1,
      EvaluationPeriods: 3,
      Period: 60,
    });
    const out = template.toJSON().Outputs;
    for (const k of ['WebUrl', 'ApiUrl', 'WsUrl', 'ExtensionId', 'DashboardUrl']) expect(out).toHaveProperty(k);
  });

  it('監視用ダッシュボードが1枚あり、Lambda・WebSocket・HTTP API・DynamoDB の指標を含む (NFR4.3)', () => {
    template.resourceCountIs('AWS::CloudWatch::Dashboard', 1);
    template.hasResourceProperties('AWS::CloudWatch::Dashboard', { DashboardName: 'wordcloud-workshop' });
    const body = JSON.stringify(Object.values(template.findResources('AWS::CloudWatch::Dashboard'))[0]);
    for (const m of ['Errors', 'Duration', 'ConcurrentExecutions', 'ConnectCount', 'MessageCount', '4xx', '5xx', 'ThrottledRequests']) {
      expect(body).toContain(m);
    }
  });
});

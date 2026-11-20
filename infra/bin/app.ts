import { App } from 'aws-cdk-lib';
import { WordcloudStack } from '../lib/wordcloud-stack.js';

const app = new App();
new WordcloudStack(app, 'WordcloudStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    // リージョンは WORDCLOUD_REGION で指定する(未設定なら東京)。AWS CLI の既定リージョンには従わない。
    region: process.env.WORDCLOUD_REGION ?? 'ap-northeast-1',
  },
  description: 'Realtime word cloud for workshops (CloudFront + S3 / API Gateway + Lambda / DynamoDB)',
});

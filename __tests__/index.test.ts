import { getSecretValue, listSecrets, getSecretValueMap, getSecretNamesToFetch } from '../src';
import { getPOSIXString } from '../src/utils';
import { SecretsManager } from 'aws-sdk';
import { Inputs } from '../src/constants';
import { resolve } from 'path';
import { config } from 'dotenv';

jest.mock('aws-sdk');

config({path: resolve(__dirname, '../.env')});

// In case we want to make actual AWS calls during integration tests instead of jest mock calls
const AWSConfig = {
  accessKeyId: process.env[getPOSIXString(Inputs.AWS_ACCESS_KEY_ID)],
  secretAccessKey: process.env[getPOSIXString(Inputs.AWS_SECRET_ACCESS_KEY)],
  region: process.env[getPOSIXString(Inputs.AWS_REGION)]
};

const secretsManagerClient = new SecretsManager(AWSConfig);


test('Fetch Secret Value: Valid Secret Name', () => {
  expect.assertions(2);
  return getSecretValue(secretsManagerClient, 'my_secret_1').then(secretValue => {
    expect(Object.keys(secretValue)).toContain('SecretString');
    expect(secretValue['SecretString']).toEqual('test-value-1');
  });
});

test('Fetch Secret Value: Invalid Secret Name', () => {
  expect.assertions(1);
  return getSecretValue(secretsManagerClient, 'foobarbaz').catch(err => {
    expect(err).not.toBeNull();
  });
});


test('List Secrets', () => {
  expect.assertions(1);
  return listSecrets(secretsManagerClient).then(secretNames => {
    expect(secretNames.sort()).toEqual(['my_secret_1', 'my_secret_2', 'my/secret/3'].sort());
  });
});

test('Get Secret Value Map, plain-text value', () => {
  expect.assertions(1);
  return getSecretValueMap(secretsManagerClient, 'my_secret_1').then(secretValueMap => {
    expect(secretValueMap).toMatchObject({'TF_VAR_my_secret_1': 'test-value-1'});
  });
});

test('Get Secret Value Map, JSON string value', () => {
  expect.assertions(1);
  return getSecretValueMap(secretsManagerClient, 'my_secret_2').then(secretValueMap => {
    expect(secretValueMap).toMatchObject({'TF_VAR_fooBar': 'baz'});
  });
});

test('Get Secret Value Map, Base64 encoded JSON string value', () => {
  expect.assertions(1);
  return getSecretValueMap(secretsManagerClient, 'my/secret/3').then(secretValueMap => {
    expect(secretValueMap).toMatchObject({'TF_VAR_foo': 'bar'});
  });
});

test('Get Secret Value Map: Invalid Secret Name', () => {
  expect.assertions(1);
  return getSecretValueMap(secretsManagerClient, 'foobarbaz').catch(err => {
    expect(err).not.toBeNull();
  });
});

test('Get Secret Names To Fetch: Single Wild Card Name', () => {
  expect.assertions(1);
  return getSecretNamesToFetch(secretsManagerClient, ['*secret*']).then(secretNames => {
    expect(secretNames.sort()).toEqual(['my_secret_1', 'my_secret_2', 'my/secret/3'].sort());
  });
});

test('Get Secret Names To Fetch: Multiple Wild Card Names', () => {
  expect.assertions(1);
  return getSecretNamesToFetch(secretsManagerClient, ['my*', 'my_secret*', 'invalidfoobarbaz']).then(secretNames => {
    expect(secretNames.sort()).toEqual(['my_secret_1', 'my_secret_2', 'my/secret/3'].sort());
  });
});

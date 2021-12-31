import * as core from '@actions/core';
import { SecretsManager } from 'aws-sdk';
import { Inputs } from './constants';
import {
  isJSONObjectString,
  filterBy,
  getPOSIXString,
  mapJSONObject,
  getVariableName
} from './utils';

// secretNames input string is a new line separated list of secret names. Take distinct secret names.
const inputSecretNames: string[] = [...new Set(core.getInput(Inputs.SECRETS).split(',').filter(x => x !== ''))];
// Check if any secret name contains a wildcard '*'
const hasWildcard: boolean = inputSecretNames.some(secretName => secretName.includes('*'));

const AWSConfig = {
  accessKeyId: core.getInput(Inputs.AWS_ACCESS_KEY_ID),
  secretAccessKey: core.getInput(Inputs.AWS_SECRET_ACCESS_KEY),
  region: core.getInput(Inputs.AWS_REGION)
};

const getSecretsManagerClient = (config): SecretsManager => new SecretsManager(config);
const getSecretValue = (secretsManagerClient: SecretsManager, secretName: string) =>
  secretsManagerClient.getSecretValue({ SecretId: secretName }).promise();
const listSecretsPaginated = (secretsManagerClient, nextToken) =>
  secretsManagerClient.listSecrets({ NextToken: nextToken }).promise();

const listSecrets = (secretsManagerClient: SecretsManager): Promise<Array<string>> => {
  return new Promise<Array<string>>((resolve, reject) => {
    let nextToken: string = null;
    const allSecretNames: string[] = [];
    do {
      listSecretsPaginated(secretsManagerClient, nextToken)
        .then(res => {
          // fetch nextToken if it exists, reset to null otherwise
          if ('NextToken' in res) {
            nextToken = res['NextToken'];
          } else {
            nextToken = null;
          }
          // get all non-deleted secret names
          res['SecretList'].forEach(secret => {
            if (!('DeletedDate' in secret)) {
              allSecretNames.push(secret['Name']);
            }
          });
          resolve(allSecretNames);
        })
        .catch(err => {
          reject(err);
        });
    }
    while (nextToken);
  });
};

const getSecretValueMap = (secretsManagerClient: SecretsManager, secretName: string) => {
  return new Promise((resolve, reject) => {
    getSecretValue(secretsManagerClient, secretName)
      .then(data => {
        let secretValue;
        // Decrypts secret using the associated KMS CMK.
        // Depending on whether the secret is a string or binary, one of these fields will be populated.
        if ('SecretString' in data) {
          secretValue = data['SecretString'];
        } else {
          const buff = Buffer.from(data['SecretBinary'].toString(), 'base64');
          secretValue = buff.toString('ascii');
        }
        let secretValueMap = {};

        // If secretName = 'mySecret' and secretValue='{ "foo": "bar" }'
        // and if secretValue is a valid JSON object string,
        // injected secrets will be of the form 'TF_VAR_foo' = 'bar'
        if (isJSONObjectString(secretValue)) {
          const secretJSON = JSON.parse(secretValue);
          const secretJSONWrapped = {};
          secretJSONWrapped[secretName] = secretJSON;
          const secretJSONMapped = mapJSONObject(secretJSON);
          secretValueMap = secretJSONMapped;
        }
        // Else, injected secrets will be of the form 'mySecret' = '{ "foo": "bar" }' (raw secret value string)
        else {
          secretValueMap[getVariableName(secretName)] = secretValue;
        }
        resolve(secretValueMap);
      })
      .catch(err => {
        if ('code' in err) {
          if (err.code === 'DecryptionFailureException')
            // Secrets Manager can't decrypt the protected secret text using the provided KMS key.
            // Deal with the exception here, and/or rethrow at your discretion.
            reject(err);
          else if (err.code === 'InternalServiceErrorException')
            // An error occurred on the server side.
            // Deal with the exception here, and/or rethrow at your discretion.
            reject(err);
          else if (err.code === 'InvalidParameterException')
            // You provided an invalid value for a parameter.
            // Deal with the exception here, and/or rethrow at your discretion.
            reject(err);
          else if (err.code === 'InvalidRequestException')
            // You provided a parameter value that is not valid for the current state of the resource.
            // Deal with the exception here, and/or rethrow at your discretion.
            reject(err);
          else if (err.code === 'ResourceNotFoundException')
            // We can't find the resource that you asked for.
            // Deal with the exception here, and/or rethrow at your discretion.
            reject(err);
        } else {
          reject(err);
        }
      });
  });
};

const getSecretNamesToFetch =
  (secretsManagerClient: SecretsManager, inputSecretNames: string[]): Promise<Array<string>> => {
    return new Promise<Array<string>>((resolve, reject) => {
      // list secrets, filter against wildcards and fetch filtered secrets
      // else, fetch specified secrets directly
      const secretNames: string[] = [];
      listSecrets(secretsManagerClient)
        .then(secrets => {
          inputSecretNames.forEach(inputSecretName => {
            secretNames.push(...filterBy(secrets, inputSecretName));
          });
          resolve([...new Set(secretNames)]);
        })
        .catch(err => {
          reject(err);
        });
    });
  };

const injectSecretValueMapToEnvironment = (secretValueMap: Record<string, any>,
  core: typeof import('@actions/core')): void => {
  for (const secretName in secretValueMap) {
    const secretValue: string = secretValueMap[secretName];
    core.setSecret(secretValue);
    // If secretName contains non-posix characters, it can't be read by the shell
    // Get POSIX compliant name secondary env name that can be read by the shell
    const secretNamePOSIX = getPOSIXString(secretName);
    core.warning(`Injecting environment variable '${secretNamePOSIX}'.`);
    core.exportVariable(secretNamePOSIX, secretValue);
  }
};

const secretsManagerClient = getSecretsManagerClient(AWSConfig);
if (hasWildcard) {
  getSecretNamesToFetch(secretsManagerClient, inputSecretNames)
    .then(secretNamesToFetch => {
      secretNamesToFetch.forEach((secretName) => {
        getSecretValueMap(secretsManagerClient, secretName).then(map => {
          injectSecretValueMapToEnvironment(map, core);
        });
      });
    })
    .catch(err => {
      core.setFailed(`Action failed with error: ${err}`);
    });
} else {
  inputSecretNames.forEach((secretName) => {
    getSecretValueMap(secretsManagerClient, secretName)
      .then(map => {
        injectSecretValueMapToEnvironment(map, core);
      })
      .catch(err => {
        core.setFailed(`Action failed with error: ${err}`);
      });
  });
}

export {
  getSecretValue,
  listSecrets,
  getSecretValueMap,
  getSecretNamesToFetch,
  injectSecretValueMapToEnvironment
};

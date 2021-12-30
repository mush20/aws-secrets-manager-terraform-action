# AWS Secrets Manager Terraform GitHub Action
[![Tests](https://github.com/mush20/aws-secrets-manager-terraform-action/workflows/Tests/badge.svg?branch=main)](https://github.com/mush20/aws-secrets-manager-terraform-action/actions?query=workflow%3A%22Tests%22)
[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/mush20/aws-secrets-manager-terraform-action/blob/master/LICENSE)

GitHub Action to fetch secrets from AWS Secrets Manager and inject them as Terraform environment variables into your GitHub Actions workflow. 

The injected environment variable names will only contain upper case letters, digits and underscores. It will not begin with a digit. 

If your secret name contains any characters other than upper case letters, digits and underscores, it will not be used directly as the environment variable name. Rather, it will be transformed into a string that only contains upper case letters, digits and underscores. 

For example:
- If your secret name is `dev/foo`, value is `{ "bar": "baz" }`, the injected environment variable name will be `TF_VAR_BAR` (and value will be `baz`).

## Usage
```yaml
steps:
- name: Read secrets from AWS Secrets Manager into environment variables
  uses: mush20/aws-secrets-manager-terraform-action@v1.0
  with:
    aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
    aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
    aws-region: ${{ secrets.AWS_REGION }}
    secrets: |
      my_secret_1
      app1/dev/*

```
- `aws-access-key-id`
  - Access Key ID of an IAM user with the required [AWS Secrets Manager permissions](#iam-policy).
  - Empty string can be used ONLY IF you are using a self-hosted GitHub Actions Runner on AWS EC2 instances with an IAM instance profile attached (should have the required [AWS Secrets Manager permissions](#iam-policy)).
- `aws-secret-access-key`
  - Corresponding Secret Access Key of the IAM user.
  - Empty string can be used ONLY IF you are using a self-hosted GitHub Actions Runner on AWS EC2 instances with an IAM instance profile attached (should have the required [AWS Secrets Manager permissions](#iam-policy)).
- `aws-region`
  - AWS region code which has your AWS Secrets Manager secrets.
  - Example: `us-east-1`.
- `secrets`: 
  - List of secret names to be retrieved.
  - Examples:
    - To retrieve a single secret, use `secrets: my_secret_1`.
    - To retrieve multiple secrets, use: 
      ```yaml
      secrets: |
        my_secret_1
        my_secret_2
      ```
    - To retrieve "all secrets having names that contain `dev`" or "begin with `app1/dev/`", use:
      ```yaml
      secrets: |
        *dev*
        app1/dev/*
      ```

#### Note:
- `${{ secrets.YOUR_SECRET_NAME }}` refers to [GitHub Secrets](https://help.github.com/en/actions/configuring-and-managing-workflows/creating-and-storing-encrypted-secrets). Create the required secrets (e.g.: AWS credentials) in your GitHub repository before using this GitHub Action.
- If your secret name contains any characters other than upper case letters, digits and underscores, it will not be used directly as the environment variable name. Rather, it will be transformed into a string that only contains upper case letters, digits and underscores. 

## Features
- Can fetch secrets from AWS Secrets Manager and inject them into environment variables which can be used in subsequent steps in your GitHub Actions workflow. 
- Injects environment variables in a format compatible with most shells.
- Can fetch multiple secrets at once.
- Supports wildcards
  - `secrets: 'app1/dev/*'` will fetch all secrets having names that begin with `app1/dev/`.
  - `secrets: '*dev*'` will fetch all secrets that have `dev` in their names.

## IAM Policy
The `aws-access-key-id` and `aws-secret-access-key` provided by you should belong to an IAM user with the following minimum permissions:
- `secretsmanager:GetSecretValue`
- `kms:Decrypt`
  - Required only if you use a customer-managed AWS KMS key to encrypt the secret. You do not need this permission to use your account's default AWS managed encryption key for Secrets Manager.

#### Example 1 (Simple):
 If your secrets are encrypted using the default AWS managed encryption key, then the IAM user needs to have a policy attached similar to:
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Action": [
                "secretsmanager:GetSecretValue"
            ],
            "Effect": "Allow",
            "Resource": "*"
        }
    ]
}
```

#### Example 2 (Advanced):
 If your secrets are encrypted using a customer managed AWS Key Management Service (KMS) key, then the IAM user needs a policy similar to the one below. We can restrict access to specific secrets (resources) in a specific region or we can use `*` for 'Any'.
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Action": [
                "secretsmanager:GetSecretValue",
                "kms:Decrypt"
            ],
            "Effect": "Allow",
            "Resource": [
              "arn:aws:secretsmanager:us-east-1:000000000000:secret:*",
              "arn:aws:secretsmanager:*:000000000000:secret:mySecretID"
            ]
        }
    ]
}
```
Here `us-east-1` is the region code which has the secrets, `000000000000` is your [AWS account ID](https://console.aws.amazon.com/billing/home?#/account) and `mySecretID` is the ID of your secret (usually different from a secret name, refer to AWS Secrets Manager console for the exact ID).

## License
The scripts and documentation in this project are released under the [MIT License](https://github.com/mush20/aws-secrets-manager-terraform-action/blob/master/LICENSE).

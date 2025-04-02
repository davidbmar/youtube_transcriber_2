# RunPod Lambda Manager

A serverless solution for managing GPU instances on RunPod through AWS Lambda.

## Overview

This project provides a serverless approach to managing RunPod GPU instances through AWS Lambda. The Lambda function acts as a bridge between AWS and RunPod's API, allowing you to create, start, stop, and terminate GPU instances programmatically.

## Features

- Create GPU pods with specified configurations
- Start, stop, and terminate pods
- List available GPU types
- Find GPU types by name pattern
- Secure storage of API keys using AWS SSM Parameter Store
- Support for RunPod secrets for secure credential management

## Prerequisites

- AWS CLI installed and configured with appropriate permissions
- Docker installed (for building the Lambda deployment package)
- RunPod API key
- Python 3.9+

## Setup Instructions

Follow these steps in order to set up and use the RunPod Lambda Manager:

### 1. Set Your RunPod API Key

```bash
export RUNPOD_API_KEY="your-runpod-api-key"
```

### 2. Create the Lambda Execution Role

```bash
chmod +x 10.CreateLambdaExecutionRole.sh
./10.CreateLambdaExecutionRole.sh
```

This script:
- Creates an IAM role named `runpod-lambda-role`
- Attaches the necessary policies for Lambda execution
- Adds permissions to access AWS SSM Parameter Store

### 3. Install Docker (if not already installed)

```bash
chmod +x 15.InstallDocker.sh
./15.InstallDocker.sh
```

Docker is used to build the Lambda deployment package with compatible dependencies.

### 4. Prepare the Deployment Package

```bash
chmod +x 20.PrepareDeploymentPackage.sh
./20.PrepareDeploymentPackage.sh
```

This script:
- Creates a Docker container with Amazon Linux environment
- Installs the required Python dependencies
- Packages everything into a ZIP file for Lambda deployment
- Verifies the package contents

### 5. Create/Update the Lambda Function

```bash
chmod +x 30.CreateLambdaFunction.sh
./30.CreateLambdaFunction.sh
```

This script:
- Stores your RunPod API key in AWS SSM Parameter Store (securely)
- Creates a new Lambda function if it doesn't exist
- Updates the function code if it already exists

### 6. Test the Lambda Function

```bash
chmod +x 40.TestLambdaFunction.sh
./40.TestLambdaFunction.sh
```

This script:
- Invokes the Lambda function with a command to list available GPU types
- Processes and displays the results in a readable format
- Verifies that the function can communicate with RunPod's API

### 7. Launch a GPU Pod

```bash
chmod +x 50.Launch3080GPURunpod.sh
./50.Launch3080GPURunpod.sh
```

This script:
- Creates a configuration for a pod with an RTX 3080 GPU
- Invokes the Lambda function to create the pod
- Processes and displays the creation response
- Shows important information about the newly created pod

## Understanding the Components

### `runpod_manager.py`

The core module that interfaces with RunPod's API. It provides methods for:
- Listing, creating, starting, stopping, and terminating pods
- Listing available GPU types
- Finding GPU types by name/pattern

### `lambda_handler.py`

The AWS Lambda handler function that processes events, interacts with the RunPod Manager, and returns responses.

### `trust-policy.json`

Defines the trust relationship that allows Lambda to assume the IAM role.

### Script Files

- `10.CreateLambdaExecutionRole.sh`: Creates the IAM role
- `15.InstallDocker.sh`: Installs Docker for packaging
- `20.PrepareDeploymentPackage.sh`: Builds the Lambda deployment package
- `30.CreateLambdaFunction.sh`: Creates/updates the Lambda function
- `40.TestLambdaFunction.sh`: Tests the Lambda function
- `50.Launch3080GPURunpod.sh`: Launches a GPU pod

## Troubleshooting

### "Function does not exist" Error

If you haven't created the function yet, run the `30.CreateLambdaFunction.sh` script first.

### Lambda Invocation Failures

Check the CloudWatch Logs for the Lambda function for specific error details. Common issues include:
- RUNPOD_API_KEY not set or incorrect
- IAM role missing necessary permissions
- Network connectivity issues

### RunPod Pod Creation Failures

- Verify that the requested GPU type is available
- Check your RunPod account has sufficient credits
- Ensure the Docker image specified exists and is accessible

### AWS CLI Version Issues

The scripts are designed to work with both AWS CLI v1 and v2, but if you encounter command format issues:
- Check your AWS CLI version with `aws --version`
- Modify the scripts if necessary for your specific AWS CLI version

## Security Considerations

- The RunPod API key is stored in AWS SSM Parameter Store as a SecureString
- AWS Lambda's execution role has minimal permissions
- RunPod secrets can be used to securely provide credentials to pods

## Advanced Usage

### Using RunPod Secrets

When creating a pod, you can specify secrets to be injected as environment variables:

```json
{
  "command": "create_pod",
  "params": {
    "name": "my-pod",
    "image": "my-image:latest",
    "gpu_type_id": "RTX 3080",
    "secrets": ["my_secret_key"],
    "env_vars": {
      "API_KEY": "{{ RUNPOD_SECRET_my_secret_key }}"
    }
  }
}
```

### Finding GPU Types By Name

Instead of using specific GPU IDs, you can search by name:

```json
{
  "command": "find_gpu",
  "params": {
    "pattern": "3080"
  }
}
```

## License

[Include your license information here]

## Acknowledgements

- RunPod for their GPU cloud platform
- AWS for their serverless Lambda service

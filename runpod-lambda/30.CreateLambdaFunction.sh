#!/bin/bash

# Ensure the API key is set before proceeding
if [ -z "$RUNPOD_API_KEY" ]; then
    echo "Error: RUNPOD_API_KEY is not set. Please export it before running this script."
    exit 1
fi

# Store the API key in SSM Parameter Store
aws ssm put-parameter \
    --name "/runpod/api_key" \
    --value "$RUNPOD_API_KEY" \
    --type "SecureString" \
    --overwrite

# Check if the function already exists
if aws lambda get-function --function-name runpod-manager &>/dev/null; then
    echo "Function already exists. Updating code..."
    # Update existing function
    aws lambda update-function-code \
        --function-name runpod-manager \
        --zip-file fileb://runpod-lambda.zip
else
    echo "Creating new function..."
    # Create new function
    aws lambda create-function \
        --function-name runpod-manager \
        --zip-file fileb://runpod-lambda.zip \
        --handler lambda_handler.lambda_handler \
        --runtime python3.9 \
        --timeout 30 \
        --memory-size 256 \
        --role arn:aws:iam::$(aws sts get-caller-identity --query Account --output text):role/runpod-lambda-role
fi

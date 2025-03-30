#!/bin/bash
# Create a directory for your package using Amazon Linux environment
echo "Creating Lambda deployment package using Docker..."

# Pull the Lambda Python Docker image if you don't have it
docker pull amazon/aws-lambda-python:3.9

# Create a clean package directory
rm -rf ./package
mkdir -p ./package

# Use Docker to install dependencies in a Lambda-compatible environment
docker run --rm -v $(pwd):/var/task amazon/aws-lambda-python:3.9 \
  pip install runpod python-dotenv -t /var/task/package

# Copy your Python files to the package directory
cp lambda_handler.py runpod_manager.py ./package/

# Create the ZIP file
cd package
zip -r ../runpod-lambda.zip .
cd ..

echo "Deployment package created: runpod-lambda.zip"#

#!/bin/bash
# Create a Lambda deployment package using Docker

echo "Creating Lambda deployment package using Docker..."

# Pull the Lambda Python Docker image if needed
docker pull amazon/aws-lambda-python:3.9

# Create a temporary directory for the deployment package
rm -rf ./package
mkdir -p ./package

# Copy your Python files to the package directory
cp lambda_handler.py runpod_manager.py ./package/

# Create requirements.txt in the package directory
cat > ./package/requirements.txt << EOF
runpod
python-dotenv
EOF

# Use Docker to install dependencies in a Lambda-compatible environment
docker run --rm -v $(pwd)/package:/var/task amazon/aws-lambda-python:3.9 pip install -r /var/task/requirements.txt -t /var/task

# Create the ZIP file
cd package
zip -r ../runpod-lambda.zip .
cd ..

echo "Deployment package created: runpod-lambda.zip"

# Update the Lambda function
aws lambda update-function-code \
    --function-name runpod-manager \
    --zip-file fileb://runpod-lambda.zip

echo "Lambda function updated with new deployment package"

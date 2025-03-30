#!/bin/bash
# file: ./20.PrepareDeploymentPackage.sh
# Create a Lambda deployment package using Docker

echo "Creating Lambda deployment package using Docker..."

# Create a temporary directory for the deployment package
rm -rf ./deployment
mkdir -p ./deployment

# Copy your Python files and requirements.txt to the deployment directory
cp lambda_handler.py runpod_manager.py ./deployment/

# Create an updated requirements.txt file
cat > ./deployment/requirements.txt << EOF
runpod==1.3.0
python-dotenv==1.0.0
EOF

# Create a Dockerfile for building the Lambda package
cat > ./deployment/Dockerfile << EOF
FROM amazon/aws-lambda-python:3.9

# Copy function code
COPY lambda_handler.py runpod_manager.py ./

# Install the dependencies
COPY requirements.txt .
RUN pip install -r requirements.txt --target .

# Verify installation
RUN ls -la /var/task/runpod

# Command to run when creating a container from this image
CMD ["lambda_handler.lambda_handler"]
EOF

# Build the Docker image
cd ./deployment
docker build -t runpod-lambda:latest .

# Create a temporary container to extract the package
CONTAINER_ID=$(docker create runpod-lambda:latest)
docker cp $CONTAINER_ID:/var/task ./package
docker rm $CONTAINER_ID

# Create the deployment ZIP
cd package
zip -r ../../runpod-lambda.zip .
cd ../..

echo "Deployment package created: runpod-lambda.zip"

# Verify the contents of the ZIP file
echo "Verifying deployment package contents..."
unzip -l runpod-lambda.zip | grep -i runpod

# Update the Lambda function
echo "Updating Lambda function..."
aws lambda update-function-code \
    --function-name runpod-manager \
    --zip-file fileb://runpod-lambda.zip

echo "Lambda function updated with new deployment package"

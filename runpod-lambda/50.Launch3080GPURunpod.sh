#!/bin/bash
#!/bin/bash

#############################################################################
# RunPod GPU Pod Launch Script
# 
# This script launches a GPU instance on RunPod through an AWS Lambda function.
# The Lambda function acts as a bridge between AWS and RunPod's API.
#############################################################################

# Display initial message about what we're doing
echo "Launching 4080 GPU pod on RunPod..."

# Create a JSON file containing the payload for our Lambda function
# This payload includes all the parameters needed to create a pod on RunPod
cat > create-pod-payload.json << EOF
{
  "command": "create_pod",
  "params": {
    "name": "whisper-pod-alt",
    "image": "davidbmar/whisper-runpod:latest",
    "gpu_type_id": "RTX 3080",
    "cloud_type": "COMMUNITY",
    "use_aws_secrets": true,
    "env_vars": {
      "AWS_ACCESS_KEY_ID": "{{ RUNPOD_SECRET_aws_access_key_id }}",
      "AWS_SECRET_ACCESS_KEY": "{{ RUNPOD_SECRET_aws_secret_access_key }}",
      "AWS_DEFAULT_REGION": "{{ RUNPOD_SECRET_aws_region }}"
    },
    "secrets": [
      "aws_access_key_id",
      "aws_secret_access_key",
      "aws_region"
    ]
  }
}
EOF

#############################################################################
# EXPLANATION OF RUNPOD SECRETS:
# 
# RunPod has a secrets management system that allows you to store sensitive values
# like API keys and access credentials securely. When you create a pod, you can
# inject these secrets as environment variables.
#
# The syntax "{{ RUNPOD_SECRET_aws_access_key_id }}" is a template that RunPod
# processes when the pod starts up:
#
# 1. You first store secrets in your RunPod account (through their web UI or API)
# 2. In the "secrets" array, we list which stored secrets we want available to this pod
# 3. In the "env_vars" object, we use the template syntax to tell RunPod:
#    "Replace this template with the actual secret value when the pod starts"
#
# So when RunPod processes "{{ RUNPOD_SECRET_aws_access_key_id }}", it will:
# - Look for a secret named "aws_access_key_id" in your RunPod account
# - Replace the template with the actual value of that secret
# - Set the environment variable AWS_ACCESS_KEY_ID to that value
#
# This way, sensitive credentials never need to be hardcoded in scripts or
# Docker images, and they can be rotated centrally in your RunPod account.
#############################################################################

# Determine which version of AWS CLI we're using
# This affects how we format the command to invoke Lambda
AWS_CLI_VERSION=$(aws --version)

# Choose the appropriate command format based on AWS CLI version
if [[ $AWS_CLI_VERSION == *"aws-cli/2"* ]]; then
    echo "Using AWS CLI v2 format"
    # AWS CLI v2 uses the --cli-binary-format flag to control how the payload is processed
    aws lambda invoke \
      --function-name runpod-manager \
      --cli-binary-format raw-in-base64-out \
      --payload file://create-pod-payload.json \
      create-pod-output.json
else
    echo "Using AWS CLI v1 format"
    # AWS CLI v1 requires the payload to be manually base64 encoded
    PAYLOAD=$(cat create-pod-payload.json | base64)
    aws lambda invoke \
      --function-name runpod-manager \
      --payload "$PAYLOAD" \
      create-pod-output.json
fi

# Process and display the result from our Lambda function
if [ -f create-pod-output.json ]; then
  echo "Pod creation response:"
  echo ""
  
  # Create a separate Python script to process the output
  cat > process_output.py << 'EOF'
import json
import sys

try:
    # Read input from stdin (piped from cat command)
    with open('create-pod-output.json', 'r') as file:
        data = file.read()
    
    if data:
        try:
            # Try to parse the data as JSON
            lambda_response = json.loads(data)
            
            # Lambda responses typically contain a "body" field with the actual response
            if "body" in lambda_response:
                # The body is a JSON string, so we need to parse it again
                body = json.loads(lambda_response["body"])
                
                # Pretty print the result with proper indentation
                print(json.dumps(body, indent=2))
                
                # Extract and display important information if pod creation was successful
                if body.get("status") == "success" and "result" in body:
                    pod_info = body["result"]
                    if isinstance(pod_info, dict):
                        print("\n================================================")
                        print("Pod created successfully!")
                        print(f"Pod ID: {pod_info.get('id', 'N/A')}")
                        print(f"Pod Name: {pod_info.get('name', 'N/A')}")
                        print(f"GPU Type: {pod_info.get('gpuTypeId', 'N/A')}")
                        print(f"Machine ID: {pod_info.get('machineId', 'N/A')}")
                        print(f"Memory (GB): {pod_info.get('memoryInGb', 'N/A')}")
                        print("================================================")
            else:
                # If there's no body field, just print the whole response
                print(json.dumps(lambda_response, indent=2))
        except json.JSONDecodeError:
            # Handle the case where the response isn't valid JSON
            print(data)
except Exception as e:
    # Handle any other errors that might occur
    print(f"Error processing output: {str(e)}")
    print("Raw output:")
    with open('create-pod-output.json', 'r') as file:
        print(file.read())
EOF

  # Execute the Python script
  python3 process_output.py
  
  # Clean up the Python script
  rm process_output.py
  
  echo ""
fi

# Clean up temporary files
rm create-pod-payload.json

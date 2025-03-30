#!/bin/bash

# Invoke Lambda function with properly formatted JSON payload
aws lambda invoke \
  --function-name runpod-manager \
  --payload '{"command":"list_gpu_types"}' \
  output.json

# Display the result if successful
if [ -f output.json ]; then
  cat output.json
fi

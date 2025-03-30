#!/bin/bash
# Create a simpler test script
cat > test-lambda.sh << 'EOF'
#!/bin/bash

# Invoke Lambda function with explicit JSON payload
aws lambda invoke \
  --function-name runpod-manager \
  --cli-binary-format raw-in-base64-out \
  --payload '{"command":"list_gpu_types"}' \
  output.json

# Display the result if successful
if [ -f output.json ]; then
  cat output.json
fi
EOF

# Make the script executable
chmod +x test-lambda.sh

# Run the test
./test-lambda.sh

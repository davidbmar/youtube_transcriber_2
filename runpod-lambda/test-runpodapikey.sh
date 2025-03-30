#!/bin/bash
#file: test-runpodapikey.sh

#!/bin/bash

# Test Lambda function with pretty-printed output
echo "Testing Lambda function..."

# Invoke Lambda function
aws lambda invoke \
  --function-name runpod-manager \
  --payload '{"command":"list_gpu_types"}' \
  raw-output.json

# Pretty print the result if successful
if [ -f raw-output.json ]; then
  echo "Lambda execution response:"
  echo ""
  # Extract the JSON body from the response and pretty-print it
  cat raw-output.json | python3 -c '
import json
import sys

try:
    # Parse the Lambda response
    lambda_response = json.load(sys.stdin)

    # Check if the response has a body field
    if "body" in lambda_response:
        # Parse the body as JSON
        body = json.loads(lambda_response["body"])

        # Check if there was an error
        if body.get("status") == "error":
            print("ERROR:", body.get("message", "Unknown error"))
        else:
            # Pretty print the result
            print(json.dumps(body, indent=2))
    else:
        # Just pretty print the whole response
        print(json.dumps(lambda_response, indent=2))
except Exception as e:
    print(f"Error processing output: {str(e)}")
    print("Raw output:")
    print(open("raw-output.json").read())
'
  echo ""
fi

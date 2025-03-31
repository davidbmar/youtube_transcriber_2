"""
RunPod Lambda Handler - AWS Lambda function to manage RunPod resources
"""

import os
import json
import logging
from runpod_manager import RunPodManager

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

def lambda_handler(event, context):
    """
    AWS Lambda handler function that processes events to manage RunPod resources
    
    Args:
        event: Lambda event data containing RunPod command and parameters
        context: Lambda context object
        
    Returns:
        Dictionary with status and result
    """
    logger.info(f"Received event: {json.dumps(event)}")
    
    try:
        # Get API key from environment variable
        api_key = os.environ.get('RUNPOD_API_KEY')
        if not api_key:
            return {
                'statusCode': 400,
                'body': json.dumps({
                    'status': 'error',
                    'message': 'RUNPOD_API_KEY environment variable not set'
                })
            }
        
        # Initialize RunPod manager
        manager = RunPodManager(api_key=api_key)
        
        # Get command and parameters from event
        command = event.get('command')
        params = event.get('params', {})
        
        if not command:
            return {
                'statusCode': 400,
                'body': json.dumps({
                    'status': 'error',
                    'message': 'Command not specified in event'
                })
            }
        
        # Process commands
        result = None
        
        if command == "list_pods":
            result = manager.list_pods()
            
        elif command == "get_pod":
            pod_id = params.get('pod_id')
            if not pod_id:
                return {
                    'statusCode': 400,
                    'body': json.dumps({
                        'status': 'error',
                        'message': 'pod_id is required for get_pod command'
                    })
                }
            result = manager.get_pod(pod_id)
            
        elif command == "create_pod":
            required_params = ['name', 'image', 'gpu_type_id']
            missing_params = [p for p in required_params if p not in params]
            
            if missing_params:
                return {
                    'statusCode': 400,
                    'body': json.dumps({
                        'status': 'error',
                        'message': f'Missing required parameters: {", ".join(missing_params)}'
                    })
                }
            
            # Extract parameters
            name = params.get('name')
            image = params.get('image')
            gpu_type_id = params.get('gpu_type_id')
            cloud_type = params.get('cloud_type', 'COMMUNITY')
            env_vars = params.get('env_vars', {})
            secrets = params.get('secrets', [])
            
            # Check if we need to look up the GPU type ID
            if not gpu_type_id.startswith("gpu-"):
                # Try to find the GPU by name
                gpu = manager.find_gpu_by_name(gpu_type_id)
                if gpu:
                    gpu_type_id = gpu['id']
                    logger.info(f"Resolved GPU name '{params.get('gpu_type_id')}' to ID: {gpu_type_id}")
                else:
                    return {
                        'statusCode': 400,
                        'body': json.dumps({
                            'status': 'error',
                            'message': f"No GPU found matching '{params.get('gpu_type_id')}'"
                        })
                    }
            
            # AWS secrets handling
            if params.get('use_aws_secrets', False):
                secrets.extend(['aws_access_key_id', 'aws_secret_access_key', 'aws_region'])
                env_vars['AWS_ACCESS_KEY_ID'] = "{{ RUNPOD_SECRET_aws_access_key_id }}"
                env_vars['AWS_SECRET_ACCESS_KEY'] = "{{ RUNPOD_SECRET_aws_secret_access_key }}"
                env_vars['AWS_DEFAULT_REGION'] = "{{ RUNPOD_SECRET_aws_region }}"
            
            result = manager.create_pod(
                name=name,
                image=image,
                gpu_type_id=gpu_type_id,
                cloud_type=cloud_type,
                env_vars=env_vars,
                secrets=secrets
            )
            
        elif command == "start_pod":
            pod_id = params.get('pod_id')
            if not pod_id:
                return {
                    'statusCode': 400,
                    'body': json.dumps({
                        'status': 'error',
                        'message': 'pod_id is required for start_pod command'
                    })
                }
            result = manager.start_pod(pod_id)
            
        elif command == "stop_pod":
            pod_id = params.get('pod_id')
            if not pod_id:
                return {
                    'statusCode': 400,
                    'body': json.dumps({
                        'status': 'error',
                        'message': 'pod_id is required for stop_pod command'
                    })
                }
            result = manager.stop_pod(pod_id)
            
        elif command == "terminate_pod":
            pod_id = params.get('pod_id')
            if not pod_id:
                return {
                    'statusCode': 400,
                    'body': json.dumps({
                        'status': 'error',
                        'message': 'pod_id is required for terminate_pod command'
                    })
                }
            result = manager.terminate_pod(pod_id)
            
        elif command == "list_gpu_types":
            result = manager.list_gpu_types()
            
        elif command == "find_gpu":
            pattern = params.get('pattern')
            if not pattern:
                return {
                    'statusCode': 400,
                    'body': json.dumps({
                        'status': 'error',
                        'message': 'pattern is required for find_gpu command'
                    })
                }
            result = manager.find_gpu_by_name(pattern)
            
        else:
            return {
                'statusCode': 400,
                'body': json.dumps({
                    'status': 'error',
                    'message': f'Unknown command: {command}'
                })
            }
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'status': 'success',
                'result': result
            }, default=lambda obj: str(obj))  # Handle non-serializable objects
        }
        
    except Exception as e:
        logger.error(f"Error processing command: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({
                'status': 'error',
                'message': str(e)
            })
        }

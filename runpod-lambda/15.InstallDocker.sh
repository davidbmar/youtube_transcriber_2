#!/bin/bash
# For Ubuntu/Debian
sudo apt-get update
sudo apt-get install docker.io

# For Amazon Linux/RHEL/CentOS
#sudo yum install docker

# Start the Docker service
sudo systemctl start docker


#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}RALA API - AWS Deployment Script${NC}"
echo -e "${BLUE}========================================${NC}\n"

# Check if terraform is installed
if ! command -v terraform &> /dev/null; then
    echo -e "${RED}Error: Terraform is not installed${NC}"
    echo "Install from: https://www.terraform.io/downloads"
    exit 1
fi

# Check if AWS CLI is configured
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}Error: AWS CLI is not configured${NC}"
    echo "Run: aws configure"
    exit 1
fi

echo -e "${GREEN}✓ Prerequisites check passed${NC}\n"

# Check if terraform.tfvars exists
if [ ! -f "terraform.tfvars" ]; then
    echo -e "${YELLOW}terraform.tfvars not found. Creating from example...${NC}"
    cp terraform.tfvars.example terraform.tfvars
    echo -e "${YELLOW}Please edit terraform.tfvars with your configuration:${NC}"
    echo -e "  ${BLUE}1. Set your Anthropic API key${NC}"
    echo -e "  ${BLUE}2. Configure SSH access${NC}"
    echo -e "  ${BLUE}3. Update Git repository URL${NC}"
    echo -e ""
    echo -e "${YELLOW}Then run this script again.${NC}"
    exit 0
fi

# Validate required variables
echo -e "${YELLOW}Validating configuration...${NC}"

# Check if SSH key is configured
if ! grep -q "ssh_public_key = \"ssh-" terraform.tfvars; then
    if ! grep -q "existing_key_name = \"" terraform.tfvars || grep -q "existing_key_name = \"\"" terraform.tfvars; then
        echo -e "${YELLOW}SSH key not configured. Generating new key pair...${NC}"

        SSH_KEY_PATH="$HOME/.ssh/rala-api-key"

        if [ ! -f "$SSH_KEY_PATH" ]; then
            ssh-keygen -t rsa -b 4096 -f "$SSH_KEY_PATH" -N "" -C "rala-api-deployment"
            echo -e "${GREEN}✓ SSH key generated at $SSH_KEY_PATH${NC}"
        fi

        # Read public key and update terraform.tfvars
        PUBLIC_KEY=$(cat "$SSH_KEY_PATH.pub")

        # Update terraform.tfvars with the public key
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS
            sed -i '' "s|ssh_public_key = \".*\"|ssh_public_key = \"$PUBLIC_KEY\"|" terraform.tfvars
        else
            # Linux
            sed -i "s|ssh_public_key = \".*\"|ssh_public_key = \"$PUBLIC_KEY\"|" terraform.tfvars
        fi

        echo -e "${GREEN}✓ SSH key added to configuration${NC}"
    fi
fi

# Check for Anthropic API key
if grep -q "anthropic_api_key = \"your-anthropic-api-key-here\"" terraform.tfvars || \
   grep -q "anthropic_api_key = \"\"" terraform.tfvars; then
    echo -e "${RED}Error: Anthropic API key not set in terraform.tfvars${NC}"
    echo -e "Please update the ${YELLOW}anthropic_api_key${NC} variable"
    exit 1
fi

echo -e "${GREEN}✓ Configuration valid${NC}\n"

# Initialize Terraform
echo -e "${YELLOW}Initializing Terraform...${NC}"
terraform init

# Validate configuration
echo -e "${YELLOW}Validating Terraform configuration...${NC}"
terraform validate

if [ $? -ne 0 ]; then
    echo -e "${RED}Terraform validation failed${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Validation successful${NC}\n"

# Show plan
echo -e "${YELLOW}Generating deployment plan...${NC}"
terraform plan -out=tfplan

echo -e "\n${BLUE}========================================${NC}"
echo -e "${YELLOW}Ready to deploy!${NC}"
echo -e "${BLUE}========================================${NC}\n"

# Estimate cost
echo -e "${YELLOW}Estimated Monthly Cost:${NC}"
echo -e "  EC2 t3.large:     ~$60/month"
echo -e "  EBS Volumes:      ~$8/month"
echo -e "  Data Transfer:    ~$9/month"
echo -e "  ${BLUE}Total: ~$77/month${NC}\n"

# Ask for confirmation
read -p "Do you want to proceed with deployment? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo -e "${YELLOW}Deployment cancelled${NC}"
    rm -f tfplan
    exit 0
fi

# Apply configuration
echo -e "\n${YELLOW}Deploying infrastructure...${NC}"
terraform apply tfplan

if [ $? -eq 0 ]; then
    rm -f tfplan

    echo -e "\n${GREEN}========================================${NC}"
    echo -e "${GREEN}✓ Deployment Successful!${NC}"
    echo -e "${GREEN}========================================${NC}\n"

    # Show access information
    terraform output quick_access_info

    echo -e "\n${YELLOW}Next Steps:${NC}"
    echo -e "  1. Wait ~5 minutes for services to fully start"
    echo -e "  2. SSH into instance: ${BLUE}ssh -i ~/.ssh/rala-api-key ec2-user@\$(terraform output -raw public_ip)${NC}"
    echo -e "  3. Check deployment: ${BLUE}docker ps${NC}"
    echo -e "  4. View logs: ${BLUE}~/manage-app.sh logs${NC}"
    echo -e "\n${YELLOW}Security Reminder:${NC}"
    echo -e "  • Change Grafana password (admin/admin)"
    echo -e "  • Restrict SSH access to your IP in terraform.tfvars"
    echo -e "  • Set up SSL/TLS for production use"

else
    echo -e "\n${RED}Deployment failed${NC}"
    rm -f tfplan
    exit 1
fi

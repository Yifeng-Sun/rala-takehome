#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${RED}========================================${NC}"
echo -e "${RED}RALA API - AWS Destroy Script${NC}"
echo -e "${RED}========================================${NC}\n"

echo -e "${YELLOW}⚠️  WARNING: This will destroy all infrastructure!${NC}"
echo -e "${YELLOW}⚠️  All data will be lost unless you have backups!${NC}\n"

# Check if terraform state exists
if [ ! -f "terraform.tfstate" ]; then
    echo -e "${RED}No Terraform state found. Nothing to destroy.${NC}"
    exit 0
fi

# Show what will be destroyed
echo -e "${YELLOW}The following resources will be destroyed:${NC}"
terraform show -no-color | grep -E "resource|aws_" | head -20
echo -e "\n${YELLOW}...and more${NC}\n"

# Option to create backup
echo -e "${BLUE}Would you like to create a final EBS snapshot backup?${NC}"
read -p "Create backup? (yes/no): " backup_confirm

if [ "$backup_confirm" = "yes" ]; then
    VOLUME_ID=$(terraform output -raw data_volume_id 2>/dev/null)

    if [ -n "$VOLUME_ID" ] && [ "$VOLUME_ID" != "" ]; then
        echo -e "${YELLOW}Creating EBS snapshot...${NC}"
        SNAPSHOT_ID=$(aws ec2 create-snapshot \
            --volume-id "$VOLUME_ID" \
            --description "Final backup before destroy $(date +%Y%m%d-%H%M%S)" \
            --query 'SnapshotId' \
            --output text)

        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✓ Snapshot created: $SNAPSHOT_ID${NC}"
            echo -e "${YELLOW}Waiting for snapshot to complete (this may take a few minutes)...${NC}"
            aws ec2 wait snapshot-completed --snapshot-ids "$SNAPSHOT_ID"
            echo -e "${GREEN}✓ Snapshot completed successfully${NC}"
        else
            echo -e "${RED}Failed to create snapshot${NC}"
            read -p "Continue with destroy anyway? (yes/no): " continue_confirm
            if [ "$continue_confirm" != "yes" ]; then
                exit 1
            fi
        fi
    else
        echo -e "${YELLOW}Could not find data volume. Skipping backup.${NC}"
    fi
fi

# Final confirmation
echo -e "\n${RED}========================================${NC}"
echo -e "${RED}FINAL CONFIRMATION${NC}"
echo -e "${RED}========================================${NC}"
echo -e "${YELLOW}Type 'destroy' to proceed with destruction:${NC}"
read -p "> " final_confirm

if [ "$final_confirm" != "destroy" ]; then
    echo -e "${GREEN}Destruction cancelled. Your infrastructure is safe.${NC}"
    exit 0
fi

# Destroy infrastructure
echo -e "\n${YELLOW}Destroying infrastructure...${NC}"
terraform destroy -auto-approve

if [ $? -eq 0 ]; then
    echo -e "\n${GREEN}========================================${NC}"
    echo -e "${GREEN}✓ Infrastructure Destroyed${NC}"
    echo -e "${GREEN}========================================${NC}\n"

    if [ -n "$SNAPSHOT_ID" ]; then
        echo -e "${YELLOW}Your backup snapshot: $SNAPSHOT_ID${NC}"
        echo -e "${YELLOW}To restore from this snapshot in the future:${NC}"
        echo -e "  1. Create a volume from snapshot in AWS Console"
        echo -e "  2. Update Terraform to use existing volume"
        echo -e "  3. Run terraform apply\n"
    fi

    echo -e "${YELLOW}Note: You may want to:${NC}"
    echo -e "  • Check for any orphaned resources in AWS Console"
    echo -e "  • Delete any EBS snapshots you don't need"
    echo -e "  • Remove SSH keys: rm -f ~/.ssh/rala-api-key*"

else
    echo -e "\n${RED}Destruction failed${NC}"
    echo -e "${YELLOW}You may need to:${NC}"
    echo -e "  1. Check AWS Console for resources in use"
    echo -e "  2. Manually remove dependencies"
    echo -e "  3. Run: terraform destroy"
    exit 1
fi

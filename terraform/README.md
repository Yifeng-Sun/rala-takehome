# RALA Event Collaboration API - AWS Deployment

This Terraform configuration deploys the complete RALA Event Collaboration API stack to AWS, including:
- Node.js API application
- PostgreSQL database
- Redis cache
- Apache Kafka + Zookeeper
- Complete monitoring stack (Prometheus + Grafana + Exporters)

## Architecture

```
┌─────────────────────────────────────────────────┐
│                  AWS Cloud                      │
│  ┌───────────────────────────────────────────┐ │
│  │         EC2 Instance (t3.large)           │ │
│  │  ┌─────────────────────────────────────┐ │ │
│  │  │  Docker Containers:                 │ │ │
│  │  │  • API (Node.js)                    │ │ │
│  │  │  • PostgreSQL                       │ │ │
│  │  │  • Redis                            │ │ │
│  │  │  • Kafka + Zookeeper                │ │ │
│  │  │  • Prometheus + Grafana             │ │ │
│  │  │  • Exporters (x4)                   │ │ │
│  │  └─────────────────────────────────────┘ │ │
│  │                                           │ │
│  │  Persistent EBS Volume (50GB)            │ │
│  │  └─ /data/{postgres,redis,grafana,...}  │ │
│  └───────────────────────────────────────────┘ │
│                                                 │
│  Elastic IP (Static Public IP)                 │
│  Security Group (Firewall Rules)               │
└─────────────────────────────────────────────────┘
```

## Prerequisites

1. **AWS Account** with appropriate credentials
2. **Terraform** >= 1.0 installed ([Download](https://www.terraform.io/downloads))
3. **AWS CLI** configured with credentials ([Guide](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-quickstart.html))
4. **SSH Key Pair** for EC2 access

## Cost Estimate

| Resource | Type | Monthly Cost (us-east-1) |
|----------|------|-------------------------|
| EC2 Instance | t3.large | ~$60 |
| EBS Volume | 50GB gp3 | ~$5 |
| EBS Root | 30GB gp3 | ~$3 |
| Elastic IP | 1 IP | $0 (while attached) |
| Data Transfer | ~100GB/month | ~$9 |
| **Total** | | **~$77/month** |

## Quick Start

### 1. Clone Repository (if not already done)

```bash
git clone <your-repo-url>
cd event-collaboration-api/terraform
```

### 2. Generate SSH Key Pair

```bash
# Generate new SSH key pair
ssh-keygen -t rsa -b 4096 -f ~/.ssh/rala-api-key -N ""

# This creates:
#   - Private key: ~/.ssh/rala-api-key
#   - Public key:  ~/.ssh/rala-api-key.pub
```

### 3. Configure Variables

```bash
# Copy example configuration
cp terraform.tfvars.example terraform.tfvars

# Edit with your values
nano terraform.tfvars
```

**Required variables to set:**
```hcl
# Get your IP address
# Run: curl ifconfig.me
ssh_allowed_cidrs = ["YOUR_IP/32"]

# Add your SSH public key content
# Run: cat ~/.ssh/rala-api-key.pub
ssh_public_key = "ssh-rsa AAAAB3NzaC1y..."

# Add your Anthropic API key
anthropic_api_key = "sk-ant-..."

# Update repository URL
git_repo_url = "https://github.com/yourusername/event-collaboration-api.git"
```

### 4. Deploy Infrastructure

```bash
# Initialize Terraform
terraform init

# Preview changes
terraform plan

# Apply configuration
terraform apply
```

Type `yes` when prompted.

### 5. Access Your Deployment

After ~5 minutes, Terraform will output access information:

```bash
# View outputs again
terraform output quick_access_info
```

Expected output:
```
========================================
RALA Event Collaboration API - Deployed
========================================

Instance Details:
  Public IP:   52.1.2.3
  SSH:         ssh -i ~/.ssh/rala-api-key ec2-user@52.1.2.3

Application URLs:
  API:        http://52.1.2.3:3000
  Swagger:    http://52.1.2.3:3000/api
  Grafana:    http://52.1.2.3:3001 (admin/admin)
  Prometheus: http://52.1.2.3:9090
========================================
```

### 6. Verify Deployment

```bash
# SSH into instance
ssh -i ~/.ssh/rala-api-key ec2-user@<PUBLIC_IP>

# Check Docker containers
docker ps

# View application logs
cd event-collaboration-api
docker-compose logs -f api

# Check startup logs
sudo journalctl -u cloud-final -f
```

## Managing Your Deployment

### Application Management Script

A convenience script is installed at `/home/ec2-user/manage-app.sh`:

```bash
# SSH into instance first
ssh -i ~/.ssh/rala-api-key ec2-user@<PUBLIC_IP>

# Start services
~/manage-app.sh start

# Stop services
~/manage-app.sh stop

# Restart services
~/manage-app.sh restart

# View logs
~/manage-app.sh logs

# Check status
~/manage-app.sh status
```

### Manual Docker Commands

```bash
cd /home/ec2-user/event-collaboration-api

# View running containers
docker ps

# View all logs
docker-compose -f docker-compose.yml -f docker-compose.monitoring.yml logs -f

# View specific service logs
docker logs rala-api -f
docker logs rala-postgres -f
docker logs rala-kafka -f

# Restart specific service
docker-compose restart api

# Rebuild and restart API
docker-compose build api
docker-compose up -d api
```

### Updating the Application

```bash
# SSH into instance
ssh -i ~/.ssh/rala-api-key ec2-user@<PUBLIC_IP>

# Pull latest changes
cd event-collaboration-api
git pull origin main

# Rebuild and restart
docker-compose build
docker-compose -f docker-compose.yml -f docker-compose.monitoring.yml -f docker-compose.prod.yml up -d
```

## Accessing Services

### API & Documentation
- **REST API**: http://PUBLIC_IP:3000
- **Swagger UI**: http://PUBLIC_IP:3000/api
- **Health Check**: http://PUBLIC_IP:3000/health

### Monitoring Dashboards
- **Grafana**: http://PUBLIC_IP:3001
  - Username: `admin`
  - Password: `admin` (change on first login)
- **Prometheus**: http://PUBLIC_IP:9090

### Metrics Endpoints
- **Node Exporter**: http://PUBLIC_IP:9100/metrics
- **PostgreSQL Exporter**: http://PUBLIC_IP:9187/metrics
- **Redis Exporter**: http://PUBLIC_IP:9121/metrics
- **Kafka Exporter**: http://PUBLIC_IP:9308/metrics

## Data Persistence

All critical data is stored on the EBS volume mounted at `/data`:

```
/data/
├── postgres/       # PostgreSQL database files
├── redis/          # Redis persistence files
├── prometheus/     # Prometheus time-series data
└── grafana/        # Grafana settings and dashboards
```

**Backup Strategy:**
```bash
# Create EBS snapshot via AWS CLI
aws ec2 create-snapshot \
  --volume-id $(terraform output -raw data_volume_id) \
  --description "RALA API data backup $(date +%Y%m%d)"

# Or create automated snapshots with AWS Backup
```

## Security Recommendations

### 🔐 After Initial Deployment

1. **Restrict SSH Access**
   ```hcl
   # In terraform.tfvars
   ssh_allowed_cidrs = ["YOUR_IP/32"]  # Your IP only
   ```

2. **Change Default Passwords**
   ```bash
   # Grafana: Change admin password in UI
   # PostgreSQL: Update in docker-compose and reconnect
   ```

3. **Restrict Monitoring Access**
   ```hcl
   monitoring_allowed_cidrs = ["YOUR_IP/32"]
   ```

4. **Set up SSL/TLS** (recommended for production)
   ```bash
   # Install and configure nginx with Let's Encrypt
   # See: docs/ssl-setup.md
   ```

5. **Enable AWS GuardDuty** for threat detection

## Troubleshooting

### Services Not Starting

```bash
# SSH into instance
ssh -i ~/.ssh/rala-api-key ec2-user@<PUBLIC_IP>

# Check user-data script logs
sudo cat /var/log/user-data.log

# Check cloud-init logs
sudo journalctl -u cloud-final

# Check Docker daemon
sudo systemctl status docker

# Check disk space
df -h
```

### Cannot Connect to Instance

```bash
# Verify security group allows your IP
terraform output security_group_id

# Check instance is running
aws ec2 describe-instances \
  --instance-ids $(terraform output -raw instance_id)

# Verify SSH key matches
ssh-keygen -l -f ~/.ssh/rala-api-key.pub
```

### Application Errors

```bash
# View API logs
docker logs rala-api --tail 100 -f

# Check environment variables
docker exec rala-api env | grep -E "DATABASE|REDIS|KAFKA|ANTHROPIC"

# Restart specific service
docker-compose restart api
```

### Grafana Shows "Data source not found"

```bash
# Already fixed in latest version, but if you see this:
cd event-collaboration-api
docker-compose -f docker-compose.monitoring.yml restart grafana
```

## Scaling Recommendations

### Upgrading Instance Size

```hcl
# In terraform.tfvars
instance_type = "t3.xlarge"  # 4 vCPU, 16GB RAM
```

Then run:
```bash
terraform apply
# Instance will be recreated (requires downtime)
```

### Expanding Storage

```hcl
# In terraform.tfvars
data_volume_size = 100  # Increase to 100GB
```

Then run:
```bash
terraform apply

# SSH into instance and resize filesystem
ssh -i ~/.ssh/rala-api-key ec2-user@<PUBLIC_IP>
sudo resize2fs /dev/xvdf
```

## Destroying Infrastructure

**⚠️ WARNING: This will delete all data!**

```bash
# Create final backup first
aws ec2 create-snapshot \
  --volume-id $(terraform output -raw data_volume_id) \
  --description "Final backup before destroy"

# Destroy all resources
terraform destroy
```

Type `yes` when prompted.

## Terraform Commands Reference

```bash
# Initialize (first time)
terraform init

# Validate configuration
terraform validate

# Format code
terraform fmt

# Plan changes
terraform plan

# Apply changes
terraform apply

# Show current state
terraform show

# List outputs
terraform output

# Destroy everything
terraform destroy

# Target specific resource
terraform apply -target=aws_instance.rala_api

# Import existing resource
terraform import aws_instance.rala_api i-1234567890abcdef0
```

## Files Overview

```
terraform/
├── main.tf                      # Main infrastructure definition
├── variables.tf                 # Input variable definitions
├── outputs.tf                   # Output values
├── user-data.sh                 # EC2 bootstrap script
├── terraform.tfvars.example     # Example configuration
├── terraform.tfvars             # Your configuration (git-ignored)
└── README.md                    # This file
```

## Support & Documentation

- [Terraform AWS Provider Docs](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [AWS EC2 Documentation](https://docs.aws.amazon.com/ec2/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)

## Next Steps

1. ✅ Deploy infrastructure with Terraform
2. ⏰ Wait ~5 minutes for services to start
3. 🔍 Verify all services are running
4. 🔐 Secure your deployment (change passwords, restrict IPs)
5. 📊 Set up monitoring alerts in Grafana
6. 🌐 Configure domain name and SSL/TLS
7. 📦 Set up automated backups
8. 🧪 Run load tests to validate performance

---

**Questions or Issues?** Check the troubleshooting section or review the application logs.

terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "event-collaboration-api"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

# Data source for latest Amazon Linux 2023 AMI
data "aws_ami" "amazon_linux_2023" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-*-x86_64"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# VPC - Use default VPC or create new one
data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

# Security Group for EC2 Instance
resource "aws_security_group" "rala_api" {
  name        = "rala-api-${var.environment}"
  description = "Security group for RALA Event Collaboration API"
  vpc_id      = data.aws_vpc.default.id

  # SSH access
  ingress {
    description = "SSH"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = var.ssh_allowed_cidrs
  }

  # HTTP access
  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # HTTPS access
  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # API access (Node.js)
  ingress {
    description = "API"
    from_port   = 3000
    to_port     = 3000
    protocol    = "tcp"
    cidr_blocks = var.api_allowed_cidrs
  }

  # Monitoring stack disabled for t3.micro to save memory
  # Uncomment these rules if you re-enable monitoring:
  #
  # ingress {
  #   description = "Grafana"
  #   from_port   = 3001
  #   to_port     = 3001
  #   protocol    = "tcp"
  #   cidr_blocks = var.monitoring_allowed_cidrs
  # }
  #
  # ingress {
  #   description = "Prometheus"
  #   from_port   = 9090
  #   to_port     = 9090
  #   protocol    = "tcp"
  #   cidr_blocks = var.monitoring_allowed_cidrs
  # }
  #
  # ingress {
  #   description = "Exporters"
  #   from_port   = 9100
  #   to_port     = 9400
  #   protocol    = "tcp"
  #   cidr_blocks = var.monitoring_allowed_cidrs
  # }

  # Outbound internet access
  egress {
    description = "Allow all outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "rala-api-sg-${var.environment}"
  }
}

# IAM Role for EC2 Instance
resource "aws_iam_role" "rala_api_role" {
  name = "rala-api-ec2-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })
}

# Attach CloudWatch and SSM policies
resource "aws_iam_role_policy_attachment" "cloudwatch" {
  role       = aws_iam_role.rala_api_role.name
  policy_arn = "arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy"
}

resource "aws_iam_role_policy_attachment" "ssm" {
  role       = aws_iam_role.rala_api_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

# IAM Instance Profile
resource "aws_iam_instance_profile" "rala_api_profile" {
  name = "rala-api-profile-${var.environment}"
  role = aws_iam_role.rala_api_role.name
}

# SSH Key Pair (optional - create if key_name not provided)
resource "aws_key_pair" "rala_api_key" {
  count      = var.existing_key_name == "" ? 1 : 0
  key_name   = "rala-api-${var.environment}"
  public_key = var.ssh_public_key

  tags = {
    Name = "rala-api-key-${var.environment}"
  }
}

# EBS Volume for persistent data
resource "aws_ebs_volume" "rala_data" {
  availability_zone = var.availability_zone
  size              = var.data_volume_size
  type              = "gp3"
  encrypted         = true
  iops              = 3000
  throughput        = 125

  tags = {
    Name = "rala-api-data-${var.environment}"
  }
}

# Elastic IP for stable public IP
resource "aws_eip" "rala_api" {
  domain = "vpc"

  tags = {
    Name = "rala-api-eip-${var.environment}"
  }
}

# EC2 Instance
resource "aws_instance" "rala_api" {
  ami                    = data.aws_ami.amazon_linux_2023.id
  instance_type          = var.instance_type
  key_name               = var.existing_key_name != "" ? var.existing_key_name : aws_key_pair.rala_api_key[0].key_name
  vpc_security_group_ids = [aws_security_group.rala_api.id]
  iam_instance_profile   = aws_iam_instance_profile.rala_api_profile.name
  availability_zone      = var.availability_zone

  root_block_device {
    volume_type = "gp3"
    volume_size = 30
    encrypted   = true
  }

  user_data = templatefile("${path.module}/user-data.sh", {
    anthropic_api_key = var.anthropic_api_key
    environment       = var.environment
    git_repo_url      = var.git_repo_url
    git_branch        = var.git_branch
  })

  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"
    http_put_response_hop_limit = 1
  }

  tags = {
    Name = "rala-api-${var.environment}"
  }

  depends_on = [aws_ebs_volume.rala_data]
}

# Attach EBS volume to instance
resource "aws_volume_attachment" "rala_data_attachment" {
  device_name = "/dev/xvdf"
  volume_id   = aws_ebs_volume.rala_data.id
  instance_id = aws_instance.rala_api.id
}

# Associate Elastic IP with instance
resource "aws_eip_association" "rala_api" {
  instance_id   = aws_instance.rala_api.id
  allocation_id = aws_eip.rala_api.id
}

# CloudWatch Log Group
resource "aws_cloudwatch_log_group" "rala_api" {
  name              = "/aws/ec2/rala-api-${var.environment}"
  retention_in_days = 7

  tags = {
    Name = "rala-api-logs-${var.environment}"
  }
}

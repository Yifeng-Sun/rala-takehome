variable "aws_region" {
  description = "AWS region to deploy resources"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "prod"
}

variable "availability_zone" {
  description = "Availability zone for EC2 instance and EBS volume"
  type        = string
  default     = "us-east-1a"
}

variable "instance_type" {
  description = "EC2 instance type"
  type        = string
  default     = "t3.large"

  validation {
    condition     = can(regex("^t[23]\\.(micro|small|medium|large|xlarge|2xlarge)$", var.instance_type))
    error_message = "Instance type must be t2.micro, t3.micro, t3.small, t3.medium, t3.large, t3.xlarge, or t3.2xlarge"
  }
}

variable "data_volume_size" {
  description = "Size of the EBS data volume in GB"
  type        = number
  default     = 50

  validation {
    condition     = var.data_volume_size >= 20 && var.data_volume_size <= 500
    error_message = "Data volume size must be between 20 and 500 GB"
  }
}

variable "ssh_allowed_cidrs" {
  description = "CIDR blocks allowed to SSH to the instance"
  type        = list(string)
  default     = ["0.0.0.0/0"] # WARNING: Change this to your IP for production!

  validation {
    condition     = length(var.ssh_allowed_cidrs) > 0
    error_message = "At least one CIDR block must be specified for SSH access"
  }
}

variable "api_allowed_cidrs" {
  description = "CIDR blocks allowed to access the API (port 3000)"
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "monitoring_allowed_cidrs" {
  description = "CIDR blocks allowed to access monitoring tools (Grafana, Prometheus)"
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "existing_key_name" {
  description = "Name of existing EC2 key pair (leave empty to create new one)"
  type        = string
  default     = ""
}

variable "ssh_public_key" {
  description = "SSH public key content (required if existing_key_name is empty)"
  type        = string
  default     = ""
}

variable "anthropic_api_key" {
  description = "Anthropic API key for the application"
  type        = string
  sensitive   = true

  validation {
    condition     = length(var.anthropic_api_key) > 0
    error_message = "Anthropic API key must not be empty"
  }
}

variable "git_repo_url" {
  description = "Git repository URL to clone the application from"
  type        = string
  default     = "https://github.com/yourusername/event-collaboration-api.git"
}

variable "git_branch" {
  description = "Git branch to checkout"
  type        = string
  default     = "main"
}
